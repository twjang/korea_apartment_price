#!/usr/bin/env python
import argparse
import datetime
import os
import sys


ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)

from typing import List, Tuple
import requests
import korea_apartment_price
import korea_apartment_price.db
from korea_apartment_price.config import get_cfg
from korea_apartment_price.utils import safe_int, safe_float
from korea_apartment_price.db import RowDepositInterestRate



class DepositInterestRateDownloader:
  def __init__(self):
    self._api_key = get_cfg()['KOSIS_API_KEY']
  
  def get(self, startym:int, endym:int)->List[any]:
    url = 'https://kosis.kr/openapi/Param/statisticsParameterData.do'
    params = {
      'method':	'getList',
      'apiKey':	self._api_key,
      'itmId':	'T1',
      'objL1':	'01',
      'objL2':	'a0 a703 a704 a705 a706 a707 a8 a9 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19 a20 a21 a22 a23',
      'objL3':	'01 02 03',
      'format':	'json',
      'jsonVD':	'Y',
      'prdSe':	'M',
      'startPrdDe':	startym,
      'endPrdDe':	endym,
      'orgId':	408,
      'tblId':	'DT_30404_N0009',
    }

    resp = requests.get(url, params=params)

    """
    Example data
      {'TBL_NM': '규모별 전월세전환율', 
      'ITM_ID': 'T1',
       'ORG_ID': '408',
       'UNIT_NM_ENG': '%',
       'C1_OBJ_NM': '주택유형별',
       'C2_OBJ_NM': '지역별',
       'C3_OBJ_NM': '주택규모별',
       'C2': 'a9',
       'C1_NM_ENG': 'Apartments',
       'C2_NM_ENG': 'Daegu',
       'C3_NM_ENG': 'Scale3',
       'PRD_DE': '202207',
       'ITM_NM': '규모별 전월세전환율',
       'TBL_ID': 'DT_30404_N0009',
       'UNIT_NM': '%',
       'C1_OBJ_NM_ENG': 'Type',
       'C2_OBJ_NM_ENG': 'Region',
       'C3_OBJ_NM_ENG': 'Scale',
       'C3': '03',
       'DT': '4.444444444',
       'PRD_SE': 'M',
       'C1': '01',
       'C1_NM': '아파트',
       'C2_NM': '대구',
       'C3_NM': '규모3'}
    """
    res = [] 
    required_keys = ['C1_NM', 'C2_NM', 'C3', 'PRD_DE', 'DT']
    for ent in resp.json():
      is_valid = True
      for k in required_keys:
        if not k in ent:
          is_valid = False
      if not is_valid: continue

      size_code = safe_int(ent['C3'])
      if size_code == 1:
        size_min = 0
        size_max = 19
      elif size_code == 2:
        size_min = 20
        size_max = 25
      elif size_code == 3:
        size_min = 26
        size_max = 10000
      else: continue

      row_ent:RowDepositInterestRate = {
        'region': ent['C2_NM'],
        'value': safe_float(ent['DT']),
        'date_serial': safe_int(ent['PRD_DE']),
        'year': safe_int(ent['PRD_DE'][:4]),
        'month': safe_int(ent['PRD_DE'][4:]),
        'size_min': size_min,
        'size_max': size_max,
      }
      res.append(row_ent)
    return res

def parse_args():
  parser = argparse.ArgumentParser()
  parser.add_argument('--truncate_db', action='store_true', help='drop collection before downloading')
  return parser.parse_args()


def list_entries_in_db()->List[Tuple[int, int]]:
  res = []
  col = korea_apartment_price.db.get_deposit_interest_rate_collection()
  entries = col.aggregate([{
    '$group': {
      "_id": {
        'year': '$year',
        'month': '$month'
      },
      "count": {'$sum':1}
    }
  }])

  for e in entries:
    year = safe_int(e['_id']['year'])
    month = safe_int(e['_id']['month'])
    if e['count'] > 0:
      res.append((year, month))
  return res


if __name__ == '__main__':
  now = datetime.datetime.now()
  args = parse_args()

  col = korea_apartment_price.db.get_deposit_interest_rate_collection()
  if args.truncate_db:
    print(f'[*] dropping deposit interest rate collection')
    col.drop()

  korea_apartment_price.db.create_indices()

  entries_in_db = sorted(list_entries_in_db())
  start_year, start_month = 2011, 1
  if len(entries_in_db) > 0:
    db_year, db_month = entries_in_db[-1]
    start_date = datetime.datetime(db_year, db_month, 1) + datetime.timedelta(days=32)
    start_year, start_month = start_date.year, start_date.month

  end_year, end_month = now.year, now.month

  start_ym = int(f'{start_year:04d}{start_month:02d}')
  end_ym   = int(f'{end_year:04d}{end_month:02d}')

  dn = DepositInterestRateDownloader()

  print(f'[*] Updating deposit interest rate from {start_ym} to {end_ym}')
  entries_to_insert = dn.get(start_ym, end_ym)
  if len(entries_to_insert) > 0:
    col.insert_many(entries_to_insert)

  print(f'[*] Done ({len(entries_to_insert)} entries added)')
