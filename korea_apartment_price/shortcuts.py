from typing import List, Dict

import korea_apartment_price
import korea_apartment_price.region_code
import korea_apartment_price.apartment

def search(addr:str, apart_name:str='')->List[Dict[str, str]]:
  codes = korea_apartment_price.region_code.search(addr)
  res = set()
  for code_ent in codes:
    aparts = korea_apartment_price.apartment.search([str(code_ent['code']), apart_name])
    for apart_ent in aparts:
      if str(apart_ent['addrcode']) == str(code_ent['code']):
        res.add((code_ent['address'], code_ent['code'], apart_ent['name']))
  reslst = sorted(list(res))
  final = []
  for addr, code, name in reslst:
    final.append({
      'address':addr,
      'code': code,
      'name': name,
    })
  return final
