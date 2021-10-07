import os
from typing import Dict, List, Optional, Union

import pickle
from tqdm import tqdm

from korea_apartment_price.utils import Finder
from korea_apartment_price.path import CACHE_ROOT
from korea_apartment_price.db import get_trades_collection


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

def reload_apartment_names():
  global _apart_finder

  col = get_trades_collection()
  _apart_finder = Finder()

  entries = set()
  total_cnt = col.count_documents(filter={})
  for ent in tqdm(col.find(), total=total_cnt):
    addrcode = format_code(ent['lawaddrcode_city']) + format_code(ent['lawaddrcode_dong'])
    name = ent['name']
    kwd = name.replace(' ', '').split('(', 1)[0]
    entries.add((addrcode, kwd, name))
  
  for addrcode, kwd, name in tqdm(entries):
    ent = {
      'addrcode': addrcode,
      'name': name,
    }
    _apart_finder.register([addrcode] + _make_ngrams(kwd, 2), ent)

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


def search(query: Union[str, List[str]])->List[Dict[str, str]]:
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

