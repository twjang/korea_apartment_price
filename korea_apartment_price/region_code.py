import os
from typing import Dict, List, Optional, TypedDict, Union

import pandas as pd
import pickle

from korea_apartment_price.utils import Finder
from korea_apartment_price.path import MISC_DATA_ROOT, CACHE_ROOT


__all__ = ('search', 'reload_region_codes')


path_code_txt = os.path.join(MISC_DATA_ROOT, 'region_code.txt')
path_finder_pkl = os.path.join(CACHE_ROOT, 'region_code_finder.pkl')

class RegionCode(TypedDict):
  lawaddrcode: str # 법정동코드 (시군구 + 읍면동)
  address: str     # 주소 


_region_code_finder: Optional[Finder] = None
_region_code_data: Optional[List[RegionCode]] = None
_region_code_to_ent: Optional[Dict[int, RegionCode]] = None

def get_region_code_data():
  global _region_code_data 
  if _region_code_data is None:
    res = []
    data = pd.read_csv(path_code_txt, sep='\t')
    data = data[data['폐지여부']=='존재']

    for idx in range(len(data)):
      row = data.iloc[idx]
      dong = row['법정동명']
      code = str(row['법정동코드'])

      ent: RegionCode = {
        'lawaddrcode': code,
        'address': dong,
      }
      res.append(ent)

    _region_code_data = res
  return _region_code_data

def get_region_code_dict():
  global _region_code_to_ent
  if _region_code_to_ent is None:
    _region_code_to_ent = {}
    data = get_region_code_data()
    for e in data:
      _region_code_to_ent[int(e['lawaddrcode'])] = e

  return _region_code_to_ent


def reload_region_codes():
  global _region_code_finder
  _region_code_finder = Finder()

  data = get_region_code_data()

  for ent in data:
    code = ent['lawaddrcode']
    dong = ent['address']

    tags = [e.strip() for e in dong.split() if len(e.strip()) > 0]

    for versatile_city_name in ['광역시', '특별자치시', '특별시']:
      if tags[0].find(versatile_city_name) > -1:
        tags.append(tags[0].replace(versatile_city_name, '시'))
    
    tags.append(str(code))
    _region_code_finder.register(tags, ent)


def get_region_code_finder():
  global _region_code_finder
  if _region_code_finder is None:
    if os.path.exists(path_finder_pkl):
      with open(path_finder_pkl, 'rb') as f:
        _region_code_finder = pickle.load(f)
    else:
      reload_region_codes()
      with open(path_finder_pkl, 'wb') as f:
        pickle.dump(_region_code_finder, f)
  return _region_code_finder

def search(query: Union[str, List[str]])->List[RegionCode]:
  s = get_region_code_finder()
  return s.search(query)

def decode(code:str)->List[RegionCode]:
  res = []
  for e in get_region_code_data():
    if e['lawaddrcode'].startswith(code):
      res.append(e)
  return res
