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
from typing import Dict, List, Optional, Tuple


import re
import pandas as pd
import requests
from bs4 import BeautifulSoup

from korea_apartment_price.path import TRADE_DATA_ROOT, SCRIPT_ROOT
from korea_apartment_price.config import get_cfg
from korea_apartment_price.db import RowTrade
from korea_apartment_price.utils import safe_int, safe_float


region_codes = pd.read_csv(os.path.join(SCRIPT_ROOT, 'trades_region_code.csv'))

class BuildingLedgerDownloader:
  def __init__(self, timeout:float=20.0):
    self.api_key = get_cfg()['BLD_LEDGER_API_KEY']
    self.timeout = timeout

  def get(self, 
          lawaddrcode_city:int, 
          lawaddrcode_dong: int,
          bun: Optional[str] = None, 
          ji: Optional[str] = None,
          )->List[RowTrade]:
    num_rows = 1000
    res_in_dict: Dict[str, Dict] = {}


    keylist = [
      ('newPlatPlc', 'addr_road'), # 도로명 주소
      ('platPlc', 'lawaddr'), # 예전 주소
      ('platArea', 'plat_area'), # 대지 면적
      ('bcRat', 'building_coverage_ratio'), # 건폐율
      ('vlRat', 'floor_area_ratio'), # 용적률
      ('bldNm', 'name'), # 이름
      ('hhldCnt', 'household_cnt'), # 세대수
      ('useAprDay', 'used_after'), # 사용승인일
      ('mgmBldrgstPk', 'pk'), # 건축물 관리대장 일련번호
    ]

    total_cnt = None
    cur_page = 1
    partial_res = []

    while total_cnt is None or total_cnt > len(partial_res):
      params = {
          'sigunguCd': lawaddrcode_city,
          'bjdongCd': lawaddrcode_dong,
          'serviceKey': self.api_key,
          'numOfRows': num_rows,
          'pageNo': cur_page,
      }
      if bun is not None: params['bun'] = bun
      if ji is not None: params['ji'] = ji

      target = 'getBrRecapTitleInfo' # 총괄표제부
      url = f'http://apis.data.go.kr/1613000/BldRgstService_v2/{target}'
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
          item_en[key_en] = item[key]

        partial_res.append(item_en)
      cur_page += 1

    for e in partial_res:
      res_in_dict[e['pk']] = e



    keylist = [
      ('mgmBldrgstPk', 'pk'), # 건축물 관리대장 일련번호
      ('jijiguCdNm', 'jigu'), # 지역지구구역
      ('jijiguGbCdNm', 'jigu_gb'), # 지역지구구역
      ('etcJijigu', 'jigu_etc'), # 지역지구구역
    ]

    total_cnt = None
    cur_page = 1
    partial_res = []

    while total_cnt is None or total_cnt > len(partial_res):
      params = {
          'sigunguCd': lawaddrcode_city,
          'bjdongCd': lawaddrcode_dong,
          'serviceKey': self.api_key,
          'numOfRows': num_rows,
          'pageNo': cur_page,
      }
      if bun is not None: params['bun'] = bun
      if ji is not None: params['ji'] = ji

      target = 'getBrJijiguInfo' # 지역지구구역
      url = f'http://apis.data.go.kr/1613000/BldRgstService_v2/{target}'
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
          item_en[key_en] = item[key]

        partial_res.append(item_en)
      cur_page += 1
    
    for e in partial_res:
      print(e)
      if e['pk'] in res_in_dict:
        if res_in_dict[e['pk']].get('jigu', None) is None:
          res_in_dict[e['pk']]['jigu'] = []
        if e.get('jigu', None) is not None:
          res_in_dict[e['pk']]['jigu'].append(e['jigu'])
        else:
          print(e)

    res = list(res_in_dict.values())
    return res




if __name__ == '__main__':
  d = BuildingLedgerDownloader()
  lawaddrcode_city=int(sys.argv[1])
  lawaddrcode_dong=int(sys.argv[2])
  res = d.get(lawaddrcode_city, lawaddrcode_dong)
  import pprint
  pprint.pprint(res)