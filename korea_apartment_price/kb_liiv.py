import datetime
import requests
from typing import Any, List, Optional
from enum import Enum
from korea_apartment_price.db import RowKBOrderbook, TradeType

from korea_apartment_price.utils.converter import keyfilt, safe_float, safe_int

class KBDo(Enum):
  SEOUL = '서울시'
  INCHEON = '인천시'
  GYEONGGI = '경기도'
  GANGWON = '강원도'
  SEJONG = '세종시'
  DAEJEON = '대전시'
  CHUNGBUK = '충청북도'
  CHUNGNAM = '충청남도'
  JEONBUK = '전라북도'
  JEONNAM = '전라남도'
  GWANGJU = '광주시'
  DAEGU = '대구시'
  BUSAN = '부산시'
  ULSAN = '울산시'
  KYONGBUK = '경상북도'
  KYONGNAM = '경상남도'
  JEJU = '제주도'

def _convert_date(d: str)->datetime.datetime:
  now = datetime.datetime.now()
  year = now.year
  cur_month = now.month
  ents = d.split('.')
  if len(ents) == 3: 
    year, month, date = [int(e) for e in ents]
  elif len(ents) == 2:
    month, date = [int(e) for e in ents]
  else: 
    raise ValueError(f'cannot parse "{d}"')
  
  if cur_month < month:
    year -= 1
  
  return datetime.datetime(year, month, date)


def _convert_trade_type(d: str)->Optional[TradeType]:
  idx = safe_int(d)
  if idx is None: return None
  return TradeType._value2member_map_[idx]


class KBLiivCrawler:
  def __init__(self, timeout:float=5.0):
    self.url = 'https://api.kbland.kr'
    self.timeout = timeout

  def list_city(self, city: KBDo):
    url = f'{self.url}/land-complex/map/siGunGuAreaNameList'
    params = {'시도명': city.value}
    resp = requests.get(url, params=params, timeout=self.timeout)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def list_gu(self, city: KBDo, gu_name: str):
    url = f'{self.url}/land-complex/map/stutDongAreaNameList'
    params = {'시도명': city.value, '시군구명': gu_name}
    resp = requests.get(url, params=params, timeout=self.timeout)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def list_apts(self, lawaddrcode: str):
    url = f'{self.url}/land-complex/complexComm/hscmList'
    params = {'법정동코드': lawaddrcode}
    resp = requests.get(url, params=params, timeout=self.timeout)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def apt_info(self, apt_id: int, apt_type: str):
    url = f'{self.url}/land-complex/complex/main'
    params = {'단지기본일련번호': apt_id, '매물종별구분': apt_type}
    resp = requests.get(url, params=params, timeout=self.timeout)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def apt_type_info(self, apt_id: int):
    url = f'{self.url}/land-complex/complex/typInfo'
    params = {'단지기본일련번호': apt_id}
    resp = requests.get(url, params=params, timeout=self.timeout)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def apt_price_info (self, apt_id: int, area_type_id: int):
    url = f'{self.url}/land-price/price/BasePrcInfoNew'
    params = {'단지기본일련번호': apt_id, '면적일련번호': area_type_id}
    resp = requests.get(url, params=params, timeout=self.timeout)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def kb_price(self, apt_id: int, area_type_id: int)->Optional[int]:
    data = self.apt_price_info(apt_id, area_type_id)
    prices = data.get('시세', [])
    if len(prices) == 0: return None
    return prices[0]['매매일반거래가']

  def partial_orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True, items_per_page:int=10, page_idx=1):
    url = f'{self.url}/land-property/propList/main'
    data = {
      '단지기본일련번호': apt_id,
      '정렬타입': order_by,
      '중복타입': '02' if aggregate else '01',
      '페이지목록수': items_per_page,
      '페이지번호': page_idx
    }
    resp = requests.post(url, json=data, timeout=self.timeout)
    data = resp.json()

    total_cnt = data.get('dataBody', {}).get('data', {}).get('총조회수', -1)
    res = data.get('dataBody', {}).get('data', {}).get('propertyList', list())

    return (total_cnt, res)

  def orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True):
    cnt, _ = self.partial_orderbook(apt_id, order_by, aggregate, 10, 1)
    cnt, res = self.partial_orderbook(apt_id, order_by, aggregate, cnt, 1)
    return res

  def cleansed_orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True, trade_types: Optional[List[TradeType]]=None, sizes: Optional[List[float]]=None, include_detail:bool=True)->List[RowKBOrderbook]:
    now = datetime.datetime.now()

    orig_data =self.orderbook(apt_id, order_by, aggregate)
    data = [keyfilt(e, [
      ('매매가', 'price', safe_float),
      ('전용면적', 'size', lambda x: int(x * 0.3)),
      ('매물확인년월일', 'confirmed_at', _convert_date),
      ('해당층수', 'floor'),
      ('건물동명', 'apt_dong'),
      ('건물호명', 'apt_ho'),
      ('매물거래구분', 'trade_type', _convert_trade_type),
      ('', 'fetched_at', lambda _: now),
      ('', 'apart_id', lambda _: apt_id),
    ]) for e in orig_data]

    for dataidx, e in enumerate(orig_data):
      cur_trade_type = data[dataidx]['trade_type']
      if cur_trade_type == TradeType.WHOLE:
        data[dataidx]['price'] = safe_float(e['매매가'])
      elif cur_trade_type == TradeType.FULL_RENT:
        data[dataidx]['price'] = safe_float(e['전세가'])
      elif cur_trade_type == TradeType.RENT:
        price_a = safe_float(e['월세보증금'])
        price_b = safe_float(e['월세가'])
        data[dataidx]['price'] = (price_a, price_b)

    if include_detail:
      for dataidx, e in enumerate(orig_data):
        data[dataidx]['detail'] = e

    if trade_types is None:
      trade_type_values = set([e.value for e in TradeType])
    else:
      trade_type_values = set([e.value for e in trade_types])

    new_data = []
    for e in data:
      if e['trade_type'] is not None and e['trade_type'].value in trade_type_values:
        new_data.append(e)
    data = new_data

    if sizes is not None:
      new_data = []
      for e in data:
        size_diff = min([abs(s - e['size']) for s in sizes])
        if size_diff < 1.0:
          new_data.append(e)
      data = new_data

    data.sort(key=lambda e:(e['size'], e['price']))
    return data
