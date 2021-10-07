import os
from typing import Dict, List, Optional, Union

import pandas as pd
import pickle

from korea_apartment_price.utils import Finder
from korea_apartment_price.path import MISC_DATA_ROOT, CACHE_ROOT


__all__ = ('search', 'reload_region_codes')


path_code_txt = os.path.join(MISC_DATA_ROOT, 'region_code.txt')
path_finder_pkl = os.path.join(CACHE_ROOT, 'region_code_finder.pkl')

_region_code_finder: Optional[Finder] = None

def reload_region_codes():
  global _region_code_finder
  _region_code_finder = Finder()

  data = pd.read_csv(path_code_txt, sep='\t')
  data = data[data['폐지여부']=='존재']

  for idx in range(len(data)):
    row = data.iloc[idx]
    dong = row['법정동명']
    code = row['법정동코드']

    ent = {
      'code': code,
      'address': dong,
    }

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

def search(query: Union[str, List[str]])->List[Dict[str, str]]:
  s = get_region_code_finder()
  return s.search(query)