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
from korea_apartment_price.utils.converter import safe_date_serial
from typing import List, Tuple


import re
import pandas as pd
import requests
from bs4 import BeautifulSoup

from korea_apartment_price.path import TRADE_DATA_ROOT, SCRIPT_ROOT
from korea_apartment_price.config import get_cfg
from korea_apartment_price.db import RowTrade
from korea_apartment_price.utils import safe_int, safe_float


region_codes = pd.read_csv(os.path.join(SCRIPT_ROOT, 'trades_region_code.csv'))

class TradeDownloader:
  def __init__(self, timeout:float=20.0):
    self.api_key = get_cfg()['TRADES_API_KEY']
    self.timeout = timeout

  def get(self, ymd: int, region_code: int)->List[RowTrade]:
    num_rows = 1000
    res = []
    keylist = [
      ('일련번호', 'serial'),
      ('거래금액', 'price'),
      ('건축년도', 'created_at'),
      ('도로명', 'addr_road'),
      ('도로명건물본번호코드', 'addrcode_bld'),
      ('도로명건물부번호코드','addrcode_bld_sub'),
      ('도로명시군구코드', 'addrcode_city'),
      ('도로명일련번호코드', 'addrcode_serial'),
      ('도로명코드', 'addrcode'),
      ('법정동', 'lawaddr_dong'),
      ('법정동본번코드', 'lawaddrcode_main'),
      ('법정동부번코드', 'lawaddrcode_sub'),
      ('법정동시군구코드', 'lawaddrcode_city'),
      ('법정동읍면동코드', 'lawaddrcode_dong'),
      ('법정동지번코드', 'lawaddrcode_jibun'),
      ('아파트', 'name'),
      ('매매일', 'date_serial'),
      ('년', 'year'),
      ('월', 'month'),
      ('일', 'date'),
      ('전용면적', 'size'),
      ('지번', 'jibun'),
      ('지역코드', 'location_code'),
      ('층', 'floor'),
      ('해제여부', 'is_canceled'),
      ('해제사유발생일', 'canceled_date'),
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

      url = f'http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcAptTradeDev'
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

        item['매매일'] = safe_int(item['년'], 0) * 10000 + safe_int(item['월'], 0) * 100 + safe_int(item['일'], 0)
        item['거래금액'] = safe_int(item['거래금액'].replace(',', ''))
        item['전용면적'] = safe_float(item['전용면적'])
        item['층'] = safe_int(item['층'].strip())
        item['건축년도'] = safe_int(item['건축년도'])
        item['해제여부'] = item.get('해제여부', '') != ''
        item['해제사유발생일'] = safe_date_serial(item.get('해제사유발생일', None))

        for intkey, _ in [
          ('도로명건물본번호코드', 'addrcode_bld'),
          ('도로명건물부번호코드', 'addrcode_bld_sub'),
          ('도로명시군구코드', 'addrcode_city'),
          ('도로명일련번호코드', 'addrcode_serial'),
          ('도로명코드', 'addrcode'),
          ('법정동본번코드', 'lawaddrcode_main'),
          ('법정동부번코드', 'lawaddrcode_sub'),
          ('법정동시군구코드', 'lawaddrcode_city'),
          ('법정동읍면동코드', 'lawaddrcode_dong'),
          ('법정동지번코드', 'lawaddrcode_jibun'),
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


def list_trade_entries_in_db()->List[Tuple[int, int, int]]:
  col = korea_apartment_price.db.get_trades_collection()
  entries = col.aggregate([{
    "$group": {
      "_id": {
        "lawaddrcode_city": "$lawaddrcode_city",
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
    lawaddrcode_city = safe_int(entry['_id']['lawaddrcode_city'])
    ymregion = (year, month, lawaddrcode_city)
    if entry['count'] > 0:
      res.append(ymregion)
  return res



def list_trade_entries_in_files()->List[Tuple[int, int, int]]:
  res = []
  regex = re.compile(r'^([0-9]{4})([0-9]{2})-([0-9]{5}).json$')

  for fname in os.listdir(TRADE_DATA_ROOT):
    gp = regex.match(fname)
    if gp is None: continue
    year = safe_int(gp.group(1))
    month = safe_int(gp.group(2))
    lawaddrcode_city = safe_int(gp.group(3))
    res.append((year, month, lawaddrcode_city))
  return res


def remove_trade_entries_from_db(ymregions: List[Tuple[int, int, int]]):
  col = korea_apartment_price.db.get_trades_collection()

  for year, month, lawaddrcode_city in tqdm(ymregions):
    print(f' - deleting {(year, month, lawaddrcode_city)}')
    col.delete_many({
      '$and': [
        {'$expr': { '$eq': [ "$year", year ] }},
        {'$expr': { '$eq': [ "$month", month ] }},
        {'$expr': { '$eq': [ "$lawaddrcode_city", lawaddrcode_city ] }},
      ]
    })



def fetch_and_insert(arg: Tuple[int, int, int]):
  year, month, region_code = arg
  ymd_code = year * 100 + month

  fname = f'{year:04d}{month:02d}-{region_code}.json'
  fpath = os.path.join(TRADE_DATA_ROOT, fname)

  os.makedirs(TRADE_DATA_ROOT, exist_ok=True)
  dn = TradeDownloader()
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
    col = korea_apartment_price.db.get_trades_collection()
    col.insert_many(data)
    print(f'{fname}: {len(data)}')
  else:
    print(f'{fname}: 0 (nothing fetched)')




if __name__ == '__main__':
  entries_to_fetch = []
  now = datetime.datetime.now()
  for year in range(2006, now.year+1):
    for month in range(1, 13):
      if year > now.year or year == now.year and month > now.month:
        continue
      for region_code in region_codes['code5']:
        entries_to_fetch.append((year, month, int(region_code)))

  korea_apartment_price.db.create_indices()

  print('[*] checking db/file trade entries')
  entries_in_db = set(list_trade_entries_in_db())
  entries_in_files = set(list_trade_entries_in_files())

  to_be_removed_from_db = list(entries_in_db.difference(entries_in_files))
  to_be_removed_from_db.sort()
  print(f'[*] removing {len(to_be_removed_from_db)} entries from db not presenting in filesystem')
  remove_trade_entries_from_db(to_be_removed_from_db)

  print('[*] fetching trade entries and save them to db/fs')
  entries_to_fetch = list(set(entries_to_fetch).difference(entries_in_files))
  entries_to_fetch.sort()

  for jobidx, job in enumerate(tqdm(entries_to_fetch)):
    fetch_and_insert(job)
