#!/usr/bin/env python3
import os
import sys


ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)


import io
import requests
import datetime
from typing import Any, Dict, List, Tuple, TypedDict
from bs4 import BeautifulSoup
import py7zr
import pyproj

import korea_apartment_price
from korea_apartment_price import db
from korea_apartment_price.db import RowGeocode
from korea_apartment_price.utils import safe_int, safe_float


class URLParams(TypedDict):
    url: str
    params: Dict[str, Any]


class GPSDBDownloader:
    def __init__(self):
        pass

    def get_db_urlparams(self, year: int)->List[Tuple[int, URLParams]]:
        params = {
          'year': year,
          'gubun': 'NAVIDATA'
        }

        url = 'https://www.juso.go.kr/support/monthChangeFileDown.do'

        resp = requests.get(url, params=params)
        html_doc = resp.content.decode('utf-8')
        soup = BeautifulSoup(html_doc, 'xml')

        entries = []
        cur_ent = None

        for tag in soup.find('monthChangeInfo'):
            if tag.name == 'stdde':
                if cur_ent is not None:
                    entries.append(cur_ent)
                cur_ent = {
                  'stdde': int(tag.text)
                }
            else:
                cur_ent[tag.name] = tag.text

        entries = [ent for ent in entries if ent['exist'].strip().lower() == 'y']

        res = []
        for ent in entries:
            params = {
                'regYmd': year,
                'indutyCd': '999',
                'purpsCd': '999',
                'logging': 'N',
                'boardId': 'NAVIDATA',
                'indutyRm': '수집종료',
                'purpsRm': '수집종료',
            }
            for key in ['num', 'fileNo', 'stdde', 'fileName']:
                params[key] = ent[key]
            params['realFileName'] = ent['tempFileName']

            res.append((ent['stdde'], {
              'url': 'https://www.juso.go.kr/dn.do',
              'params': params
            }))

        return res

    def get_latest_db_urlparams(self)->URLParams:
        cur_year = datetime.datetime.now().year
        lst = self.get_db_urlparams(cur_year - 1)
        lst += self.get_db_urlparams(cur_year)
        lst += self.get_db_urlparams(cur_year + 1)
        lst.sort()
        return lst[-1][1]

    def download(self, urlparams: URLParams, dst_dir: str, overwrite=False)->Tuple[bool, str]:
        os.makedirs(dst_dir, exist_ok=True)
        dst_path = os.path.join(dst_dir, urlparams['params']['realFileName'])

        if os.path.exists(dst_path):
          return (False, dst_path)

        with requests.get(**urlparams, stream=True) as resp:
          downloaded = korea_apartment_price.utils.download(resp, dst_path)
          return (downloaded, dst_path)

class BuildingCoord(TypedDict):
  lawaddrcode: str # 주소관할읍면동코드 = 시군구코드(5) + 읍면동코드(3) + 00
  si: str # 시도명
  gu: str # 시군구명
  dong: str # 읍면동명 
  addrcode: str # 도로명 코드 = 시군구코드(5) + 도로명번호(7)
  addr_road: str # 도로명 
  undergnd: bool # 지하여부 
  addrcode_bld: int     # 건물본번 
  addrcode_bld_sub: int # 건물부번 
  postal: str # 우편번호
  building_id: str # [[ PK ]] 건물관리번호
  name: str # 시군구용 건물명 
  type: str # 건축물 용도 구분
  hjdong_code: str # 행정동코드
  hjdong: str # 행정동명
  floors: int # 지상층수
  ugnd_floors: int # 지하층수
  jutack_type: int # 공동주택구분 - 0:비공동 / 1:아파트 / 2:연립/다세대 등
  num_build: int # 건물 수
  name_detail: str # 상세건물명
  name_history: str # 건물명 변경이력
  name_detail_history: str # 상세건물명 변경이력
  residential: bool # 거주여부
  center_x: float # 건물 중심점 x
  center_y: float # 건물 중심점 y
  ent_x: float # 출입구 x
  ent_y: float # 출입구 y
  en_si: str # 영문 시도명
  en_gu: str # 영문 시군구명
  en_dong: str # 영문 읍면동명
  en_roadaddr: str # 영문 도로명
  is_dong: bool # 0-읍면 1-동
  movement_reason: str # 이동사유코드 (31:신교, 34:변경, 63:삭제)


_proj_utmk = pyproj.Proj('+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs')
_proj_wgs84 = pyproj.Proj('+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs')
_transformer = pyproj.Transformer.from_proj(_proj_utmk, _proj_wgs84)

def parse_building_file(f: io.BytesIO, exclude_no_coord: bool=True) -> List[BuildingCoord]:
  wrapped_io = io.TextIOWrapper(f, encoding='uhc', errors='replace')
  res = []
  while True:
    line = wrapped_io.readline()
    if line == '': break
    line = line.strip()
    row: BuildingCoord = {}
    data = line.split('|')
    for entry, (field_name, field_type) in zip(data, BuildingCoord.__annotations__.items()):
      if field_type == float:
        row[field_name] = safe_float(entry.strip())
      elif field_type == int:
        row[field_name] = safe_int(entry.strip())
      elif field_type == bool:
        row[field_name] = safe_int(entry.strip(), 0) > 0
      else:
        row[field_name] = entry.strip()

    include = False
    if not exclude_no_coord:
      include = True
    elif (row['center_x'] is not None and row['center_y'] is not None) or (row['ent_x'] is not None or row['ent_y'] is not None):
      include = True
    if include: res.append(row)

  return res

def building_coord_to_db_entry(b: BuildingCoord)->RowGeocode:
  global _transformer
  res: RowGeocode = {}
  addrcode = b['addrcode'].strip()
  res['addrcode_city'] = int(addrcode[:5])
  res['addrcode'] = int(addrcode[5:])
  res['addrcode_bld'] = int(b['addrcode_bld'])
  res['addrcode_bld_sub'] = int(b['addrcode_bld_sub'])
  res['name'] = b['name']

  lng, lat = None, None
  coord_exists = False
  if b['center_x'] is not None and b['center_y'] is not None: 
    coord_exists = True
    x_coord, y_coord = float(b['center_x']), float(b['center_y'])
  elif b['ent_x'] is not None and b['ent_y'] is not None:
    coord_exists = True
    x_coord, y_coord = float(b['ent_x']), float(b['ent_y'])
  else: 
    coord_exists = False

  if coord_exists:
    lng, lat = _transformer.transform(x_coord, y_coord)

  res['lat'] = lat
  res['lng'] = lng
  return res


if __name__ == '__main__':
  dn = GPSDBDownloader()
  up = dn.get_latest_db_urlparams()
  print ('[*] Downloading latest address/coordinate data..') 
  downloaded, fpath = dn.download(up, korea_apartment_price.path.GPS_DATA_ROOT)
  print ('[+] GPS data prepaired' + (' (already downloaded)' if not downloaded else '')) 

  zipf = py7zr.SevenZipFile(fpath, mode='r')
  db_files = [fname for fname in zipf.getnames() if fname.endswith('.txt')]
  db_files = [fname for fname in db_files if fname.startswith('match_build_')]

  col = db.get_geocodes_collection()
  db.create_indices()

  for fname, f in zipf.read(targets=db_files).items():
    print (f'[*] Reading {fname}..')
    rows = parse_building_file(f)
    print (f'[*] Converting {fname} to DB format..')
    rows = [building_coord_to_db_entry(r) for r in rows]
    print (f'[*] Writing {fname} to DB..')
    col.insert_many(rows)

