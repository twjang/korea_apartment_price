from typing import List, Dict, Optional
import datetime

import korea_apartment_price
from korea_apartment_price import db
from korea_apartment_price.db import ApartmentId
from korea_apartment_price.kb_liiv import KBLiivCrawler
import korea_apartment_price.region_code
import korea_apartment_price.apartment
from korea_apartment_price.utils.converter import keyfilt, safe_float, safe_int

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

def _convert_date(d: str)->datetime.date:
  now = datetime.datetime.now()
  year = now.year
  cur_month = now.month
  ents = d.split('.')
  if len(ents) == 3: 
    year = int(ents[0])
    month = int(ents[1])
    date = int(ents[2])
  elif len(ents) == 2:
    month = int(ents[0])
    date = int(ents[1])
  else: 
    raise ValueError(f'cannot parse "{d}"')
  
  if cur_month < month:
    year -= 1
  
  return datetime.date(year, month, date)


def fetch_orderbook(apt_id: ApartmentId, sizes: Optional[List[float]]=None):
  crawler = KBLiivCrawler()
  apt_info = db.query_kb_apart(apt_id)
  data = crawler.orderbook(apt_info['id'])

  data = [keyfilt(e, [
    ('매매가', 'price', safe_float),
    ('전용면적', 'size', lambda x: int(x * 0.3)),
    ('매물확인년월일', 'confirmed_at', _convert_date),
    ('해당층수', 'floor'),
    ('건물호명', 'apt_dong'),
  ]) for e in data if e['매물거래구분'] == '1']

  if sizes is not None:
    new_data = []
    for e in data:
      size_diff = min([abs(s - e['size']) for s in sizes])
      if size_diff < 1.0:
        new_data.append(e)
    data = new_data

  data.sort(key=lambda e:(e['size'], e['price']))
  return data

