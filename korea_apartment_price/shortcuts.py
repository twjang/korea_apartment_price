from typing import List, Dict

import korea_apartment_price
from korea_apartment_price.db import ApartmentId
import korea_apartment_price.region_code
import korea_apartment_price.apartment

def search(addr:str, apart_name:str='')->List[ApartmentId]:
  codes = korea_apartment_price.region_code.search(addr)
  res = set()
  for code_ent in codes:
    aparts = korea_apartment_price.apartment.search([str(code_ent['lawaddrcode']), apart_name])
    for apart_ent in aparts:
      if str(apart_ent['lawaddrcode']) == str(code_ent['lawaddrcode']):
        res.add((code_ent['address'], code_ent['lawaddrcode'], apart_ent['name']))
  reslst = sorted(list(res))
  final: List[ApartmentId] = []
  for addr, code, name in reslst:
    final.append({
      'address':addr,
      'lawaddrcode': code,
      'name': name,
    })
  return final
