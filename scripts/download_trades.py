#!/usr/bin/env python3
import os
import sys

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)


from tqdm import tqdm
import time
import json

import korea_apartment_price
from typing import Callable, List, Dict, Any, Optional, Tuple, TypeVar

import pandas as pd
import requests
from bs4 import BeautifulSoup

from korea_apartment_price.path import TRADE_DATA_ROOT, SCRIPT_ROOT
from korea_apartment_price.config import get_cfg


region_codes = pd.read_csv(os.path.join(SCRIPT_ROOT, 'region_code.csv'))
T = TypeVar('T')

def _safe_convert(val: Any, func: Callable[[Any], T], default: Optional[T]=None)->Optional[T]:
    res = default
    try: res = func(val)
    except: pass
    return res

def _safe_int(val: Any, default: Optional[int]=None)-> Optional[int]:
    return _safe_convert(val, int, default)

def _safe_float(val: Any, default: Optional[float]=None)-> Optional[float]:
    return _safe_convert(val, float, default)


class TradeDownloader:
    def __init__(self):
        self.api_key = get_cfg()['API_KEY']

    def get(self, ymd: int, region_code: int)->List[Dict[str, Any]]:
        num_rows = 1000
        res = []
        keylist = [
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
            resp = requests.get(url, params=params)
            soup = BeautifulSoup(resp.content, 'lxml-xml')
            items = soup.findAll('item')
            total_cnt = int(soup.findAll('totalCount')[0].text)

            for v in items:
                item = {}
                item_en = {}
                for key, key_en in keylist:
                    elem = v.find(key)
                    item[key] = elem.text if elem is not None else None

                item['매매일'] = _safe_int(item['년'], 0) * 10000 + _safe_int(item['월'], 0) * 100 + _safe_int(item['일'], 0)
                item['거래금액'] = _safe_int(item['거래금액'].replace(',', ''))
                item['전용면적'] = _safe_float(item['전용면적'])
                item['층'] = _safe_int(item['층'].strip())
                item['건축년도'] = _safe_int(item['건축년도'])

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
                    if intkey in item: item[intkey] = _safe_int(item[intkey])


                for key, key_en in keylist:
                    if isinstance(item[key], str):
                        item[key] = item[key].strip()
                    item_en[key_en] = item[key]

                res.append(item_en)
            cur_page += 1
        return res

jobs = []
for year in range(2006, 2022):
    for month in range(1, 13):
        ymd_code = year * 100 + month
        for region_code in region_codes['code5']:
            jobs.append([ymd_code, int(region_code)])


def fetch_and_insert(arg: Tuple[int, int]):
    ymd_code, region_code = arg
    fname = f'{ymd_code}-{region_code}.json'
    fpath = os.path.join(TRADE_DATA_ROOT, fname)

    if os.path.exists(fpath):
        return

    os.makedirs(TRADE_DATA_ROOT, exist_ok=True)
    dn = TradeDownloader()
    data = dn.get(ymd_code, region_code)

    if len(data) > 0:
        with open(fpath, 'w') as f:
            content = json.dumps(data, ensure_ascii=False)
            f.write(content)
        col = korea_apartment_price.db.get_trades_collection()
        col.insert_many(data)

    time.sleep(0.1)


korea_apartment_price.db.create_indices()

for jobidx, job in enumerate(tqdm(jobs)):
    fetch_and_insert(job)
