import os
from typing import Dict, List, Optional, TypedDict, Union

import pickle
from tqdm import tqdm
from korea_apartment_price import region_code

from korea_apartment_price.utils import Finder
from korea_apartment_price.path import CACHE_ROOT
from korea_apartment_price.db import get_rents_collection, get_trades_collection


__all__ = ('search', 'reload_apartment_names')

path_finder_pkl = os.path.join(CACHE_ROOT, 'apart_finder.pkl')
_apart_finder: Optional[Finder] = None


def _make_ngrams(s:str, n:int=2)->List[str]:
  res = []
  for i in range(len(s)-n):
    res.append(s[i:i+n])
  if len(res) == 0:
    res.append(s)
  return res


def format_code(x):
  if isinstance(x, int):
    return '{:05d}'.format(x)
  return x

class ApartmentAddress(TypedDict):
  lawaddrcode: str      # 법정동코드 (시군구 + 읍면동)
  name: str             # 이름
  addrcode_city: str    # 도로명시군구코드  
  addrcode_serial : str # 도로명일련번호코드
  addrcode_bld: int     # 도로명건물본번호코드
  addrcode_bld_sub: int # 도로명건물본번호코드

def reload_apartment_names():
  global _apart_finder

  col = get_trades_collection()
  _apart_finder = Finder()

  entries = {}
  total_cnt = col.count_documents(filter={})
  for ent in tqdm(col.find(), total=total_cnt):
    lawaddrcode = format_code(ent['lawaddrcode_city']) + format_code(ent['lawaddrcode_dong'])
    name = ent['name']
    kwd = name.replace(' ', '').split('(', 1)[0]
    entries[(lawaddrcode, kwd, name)] = {
      'lawaddrcode': lawaddrcode,
      'name': name,
      'addrcode_city': ent['addrcode_city'],
      'addrcode_serial': ent['addrcode_serial'],
      'addrcode_bld': ent['addrcode_bld'],
      'addrcode_bld_sub': ent['addrcode_bld_sub'],
    }
  
  for key in tqdm(entries.keys()):
    lawaddrcode, kwd, name = key
    ent = entries[key]
    _apart_finder.register([lawaddrcode] + _make_ngrams(kwd, 2), ent)


  col = get_rents_collection()

  entries = {}
  total_cnt = col.count_documents(filter={})
  for ent in tqdm(col.find(), total=total_cnt):
    region_ents = region_code.search([str(ent['location_code']), ent['lawaddr_dong']])
    region_ent = None
    if len(region_ents) > 0: region_ent = region_ents[0]
    if region_ent is None: continue
    lawaddrcode = region_ent['lawaddrcode']

    name = ent['name']
    kwd = name.replace(' ', '').split('(', 1)[0]
    key = (lawaddrcode, kwd, name)

    if not key in entries:
      entries[key] = {
        'lawaddrcode': lawaddrcode,
        'name': name,
        'addrcode_city': ent['location_code'],
        'addrcode_serial': 0,
        'addrcode_bld': 0,
        'addrcode_bld_sub': 0,
      }
  
  for key in tqdm(entries.keys()):
    lawaddrcode, kwd, name = key
    ent = entries[key]
    _apart_finder.register([lawaddrcode] + _make_ngrams(kwd, 2), ent)


def get_apart_finder():
  global _apart_finder
  if _apart_finder is None:
    if os.path.exists(path_finder_pkl):
      with open(path_finder_pkl, 'rb') as f:
        _apart_finder = pickle.load(f)
    else:
      reload_apartment_names()
      with open(path_finder_pkl, 'wb') as f:
        pickle.dump(_apart_finder, f)
  return _apart_finder

def _is_int(x)->bool:
  try:
    x = int(x)
    return True
  except ValueError: pass
  return False


def search(query: Union[str, List[str]])->List[ApartmentAddress]:
  s = get_apart_finder()
  if isinstance(query, str):
    query = query.split()

  new_query = []
  for q in query:
    if _is_int(q):
      new_query.append(q)
    else:
      new_query.extend(_make_ngrams(q))
  return s.search(new_query)

