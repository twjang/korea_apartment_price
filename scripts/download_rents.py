#!/usr/bin/env python3
import datetime
import os
import sys
import traceback

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)


from tqdm import tqdm
import time
import json

import korea_apartment_price
from typing import List, Tuple


import re
import pandas as pd
import requests
from bs4 import BeautifulSoup

from korea_apartment_price.path import RENT_DATA_ROOT, SCRIPT_ROOT
from korea_apartment_price.config import get_cfg
from korea_apartment_price.db import RowRent
from korea_apartment_price.utils import safe_int, safe_float


region_codes = pd.read_csv(os.path.join(SCRIPT_ROOT, 'rents_region_code.csv'))

class RentDownloader:
  def __init__(self, timeout:float=20.0):
    self.api_key = get_cfg()['RENTS_API_KEY']
    self.timeout = timeout

  def get(self, ymd: int, region_code: int)->List[RowRent]:
    num_rows = 1000
    res = []
    keylist = [
      ('보증금액', 'price_deposit'),
      ('월세금액', 'price_monthly'),
      ('건축년도', 'created_at'),
      ('갱신요구권사용', 'rent_extended'),
      ('법정동', 'lawaddr_dong'),
      ('아파트', 'name'),
      ('계약구분', 'contract_type'),
      ('계약기간', 'contract_duration'),
      ('임대일', 'date_serial'),
      ('년', 'year'),
      ('월', 'month'),
      ('일', 'date'),
      ('전용면적', 'size'),
      ('종전계약보증금', 'prev_deposit'),
      ('종전계약월세', 'prev_monthly'),
      ('지번', 'jibun'),
      ('지역코드', 'location_code'),
      ('층', 'floor'),
    ]

    cur_page = 1
    total_cnt = None

    while total_cnt is None or total_cnt > len(res):
      params = {
          'LAWD_CD': region_code,
          'DEAL_YMD': ymd,
          'serviceKey': self.api_key,
          'numOfRows': num_rows,
          'pageNo': cur_page,
      }

      url = f'http://openapi.molit.go.kr:8081/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcAptRent'
      resp = requests.get(url, params=params, timeout=self.timeout)
      soup = BeautifulSoup(resp.content, 'lxml-xml')
      items = soup.findAll('item')
      try:
        total_cnt = int(soup.findAll('totalCount')[0].text)
      except IndexError as e:
        print(resp.content.decode('utf-8'))
        return None

      for v in items:
        item = {}
        item_en = {}
        for key, key_en in keylist:
          elem = v.find(key)
          item[key] = elem.text.strip() if elem is not None else None

        item['임대일'] = safe_int(item['년'], 0) * 10000 + safe_int(item['월'], 0) * 100 + safe_int(item['일'], 0)
        for pricekey in ['보증금액', '월세금액', '종전계약보증금', '종전계약월세']:
          item[pricekey] = safe_int(item[pricekey].replace(',', ''))
        item['전용면적'] = safe_float(item['전용면적'])
        item['층'] = safe_int(item['층'])
        item['건축년도'] = safe_int(item['건축년도'])
        item['갱신요구권사용'] = item.get('갱신요구권사용', '') != ''

        for intkey, _ in [
          ('지역코드', 'location_code'),
          ('년', 'year'),
          ('월', 'month'),
          ('일', 'date'),
          ('지번', 'jibun'),
        ]:
          if intkey in item: item[intkey] = safe_int(item[intkey])

        for key, key_en in keylist:
          if isinstance(item[key], str):
            item[key] = item[key].strip()
          item_en[key_en] = item[key]

        res.append(item_en)
      cur_page += 1
    return res


def list_rent_entries_in_db()->List[Tuple[int, int, int]]:
  col = korea_apartment_price.db.get_rents_collection()
  entries = col.aggregate([{
    "$group": {
      "_id": {
        "location_code": "$location_code",
        "year": "$year",
        "month": "$month",
      },
      "count": {'$sum':1}
    }
  }])
  res = []
  for entry in entries:
    year = safe_int(entry['_id']['year'])
    month = safe_int(entry['_id']['month'])
    location_code = safe_int(entry['_id']['location_code'])
    ymregion = (year, month, location_code)
    if entry['count'] > 0:
      res.append(ymregion)
  return res



def list_rent_entries_in_files()->List[Tuple[int, int, int]]:
  res = []
  regex = re.compile(r'^([0-9]{4})([0-9]{2})-([0-9]{5}).json$')

  for fname in os.listdir(RENT_DATA_ROOT):
    gp = regex.match(fname)
    if gp is None: continue
    year = safe_int(gp.group(1))
    month = safe_int(gp.group(2))
    location_code = safe_int(gp.group(3))
    res.append((year, month, location_code))
  return res


def remove_rent_entries_from_db(ymregions: List[Tuple[int, int, int]]):
  col = korea_apartment_price.db.get_rents_collection()

  for year, month, location_code in tqdm(ymregions):
    print(f' - deleting {(year, month, location_code)}')
    col.delete_many({
      '$and': [
        {'$expr': { '$eq': [ "$year", year ] }},
        {'$expr': { '$eq': [ "$month", month ] }},
        {'$expr': { '$eq': [ "$location_code", location_code ] }},
      ]
    })



def fetch_and_insert(arg: Tuple[int, int, int]):
  year, month, region_code = arg
  ymd_code = year * 100 + month

  fname = f'{year:04d}{month:02d}-{region_code}.json'
  fpath = os.path.join(RENT_DATA_ROOT, fname)

  os.makedirs(RENT_DATA_ROOT, exist_ok=True)
  dn = RentDownloader()
  data = None

  if not os.path.exists(fpath):
    while data is None:
      print(f'fetching {ymd_code}-{region_code}')
      try:
        time.sleep(0.1)
        data = dn.get(ymd_code, region_code)
      except requests.exceptions.Timeout:
        print(f'{ymd_code}: timeout')
      except Exception as e:
        print(f'{ymd_code}: exception ({e})')
        traceback.print_exc()

    if len(data) > 0:
      with open(fpath, 'w') as f:
        content = json.dumps(data, ensure_ascii=False)
        f.write(content)
  else:
    print(f'loading {ymd_code}-{region_code}')
    with open(fpath, 'r') as f:
      data = json.loads(f.read())

  if len(data) > 0:
    col = korea_apartment_price.db.get_rents_collection()
    col.insert_many(data)
    print(f'{fname}: {len(data)}')
  else:
    print(f'{fname}: 0 (nothing fetched)')



if __name__ == '__main__':
  entries_to_fetch = []
  now = datetime.datetime.now()
  for year in range(2010, now.year+1):
    for month in range(1, 13):
      if year > now.year or year == now.year and month > now.month:
        continue
      for region_code in region_codes['code5']:
        entries_to_fetch.append((year, month, int(region_code)))

  korea_apartment_price.db.create_indices()

  print('[*] checking db/file rent entries')
  entries_in_db = set(list_rent_entries_in_db())
  entries_in_files = set(list_rent_entries_in_files())

  to_be_removed_from_db = list(entries_in_db.difference(entries_in_files))
  print(f'[*] removing {len(to_be_removed_from_db)} entries from db not presenting in filesystem')
  remove_rent_entries_from_db(to_be_removed_from_db)

  print('[*] fetching rent entries and save them to db/fs')
  entries_to_fetch = list(set(entries_to_fetch).difference(entries_in_files))
  entries_to_fetch.sort()

  for jobidx, job in enumerate(tqdm(entries_to_fetch)):
    fetch_and_insert(job)
