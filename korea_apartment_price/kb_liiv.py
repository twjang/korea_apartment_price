import datetime
import random
import time
import traceback
import requests
from typing import Any, Callable, Dict, List, Optional, TypeVar
from enum import Enum
from korea_apartment_price.db import RowKBOrderbook, TradeType
from korea_apartment_price.utils.throttle import Throttler

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
  def __init__(self, timeout:float=60.0, reqeuests_args:Optional[Dict[str, any]]=None):
    datestr = datetime.date.today().strftime('%Y%m%d')
    randid = random.randint(1000, 9999)
    traceid = f'user_{datestr}{randid}'
    print(traceid)

    self.url = 'https://api.kbland.kr'
    self.timeout = timeout
    self.requests_args = reqeuests_args if reqeuests_args is not None else dict()
    self.requests_args['headers'] = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Content-Type': 'application/json;charset=UTF-8',
      'DNT': '1',
      'Host': 'api.kbland.kr',
      'Origin': 'https://kbland.kr',
      'Pragma': 'no-cache',
      'Traceid': traceid,
      'Referer': 'https://kbland.kr/',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'WebService': '1',
    }

  def list_city(self, city: KBDo):
    url = f'{self.url}/land-complex/map/siGunGuAreaNameList'
    params = {'시도명': city.value}
    resp = requests.get(url, params=params, timeout=self.timeout, **self.requests_args)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def list_gu(self, city: KBDo, gu_name: str):
    url = f'{self.url}/land-complex/map/stutDongAreaNameList'
    params = {'시도명': city.value, '시군구명': gu_name}
    resp = requests.get(url, params=params, timeout=self.timeout, **self.requests_args)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def list_apts(self, lawaddrcode: str):
    url = f'{self.url}/land-complex/complexComm/hscmList'
    params = {'법정동코드': lawaddrcode}
    resp = requests.get(url, params=params, timeout=self.timeout, **self.requests_args)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def apt_info(self, apt_id: int, apt_type: str):
    url = f'{self.url}/land-complex/complex/main'
    params = {'단지기본일련번호': apt_id, '매물종별구분': apt_type}
    print(params)
    resp = requests.get(url, params=params, timeout=self.timeout, **self.requests_args)
    data = resp.json()
    print(data)
    return data.get('dataBody', {}).get('data', {})

  def apt_type_info(self, apt_id: int):
    url = f'{self.url}/land-complex/complex/typInfo'
    params = {'단지기본일련번호': apt_id}
    resp = requests.get(url, params=params, timeout=self.timeout, **self.requests_args)
    data = resp.json()
    return data.get('dataBody', {}).get('data', list())

  def apt_price_info (self, apt_id: int, area_type_id: int):
    url = f'{self.url}/land-price/price/BasePrcInfoNew'
    params = {'단지기본일련번호': apt_id, '면적일련번호': area_type_id}
    resp = requests.get(url, params=params, timeout=self.timeout, **self.requests_args)
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
    resp = requests.post(url, json=data, timeout=self.timeout, **self.requests_args)
    data = resp.json()

    total_cnt = data.get('dataBody', {}).get('data', {}).get('총조회수', -1)
    res = data.get('dataBody', {}).get('data', {}).get('propertyList', list())

    return (total_cnt, res)

  def orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True):
    cnt, _ = self.partial_orderbook(apt_id, order_by, aggregate, 10, 1)

    final_res = []
    cnt_per_page = 50
    num_pages = int((cnt+cnt_per_page - 1) / cnt_per_page)
    for pageidx in range(num_pages):
      cnt, cur_res = self.partial_orderbook(apt_id, order_by, aggregate, cnt_per_page, pageidx + 1)
      final_res += cur_res
      print (f'Fetched apt_id={apt_id} cur_page={pageidx+1}/{num_pages} cnt={len(final_res)}/{cnt}')
    return final_res

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

T = TypeVar('T')

class KBLiivCrawlerWithProxy:
  def __init__(self, 
               timeout:float=60.0, 
               reqeuests_args:Optional[Dict[str, any]]=None, 
               proxy_list: list[str]=[],
               max_retry_cnt: int = 10,
               ):
    self.requests_args = reqeuests_args.copy() if reqeuests_args is not None else dict()
    self.proxy_list = [None] + proxy_list.copy()
    self.timeout = timeout
    self.active_proxy_index: int = 0
    self._crawler: Optional[KBLiivCrawler] = None
    self.max_retry_cnt = max_retry_cnt
    self._proxy_fail_cnt = 0

  
  def _get_crawler(self, with_new_proxy=False)->KBLiivCrawler:
    if self._crawler is None or with_new_proxy:
      if with_new_proxy:
        self.active_proxy_index += 1
      proxy_addr = self.proxy_list[self.active_proxy_index % len(self.proxy_list)]
      if proxy_addr is not None:
        print(f'[!] trying proxy: {proxy_addr}')
      else:
        print(f'[!] trying direct connection (no proxy)')

      new_request_args = self.requests_args.copy()
      if proxy_addr is not None:
        new_request_args.update ({
          "proxies": {
            "https": proxy_addr,
            "http": proxy_addr
          },
          "verify": False
        })
      self._crawler = KBLiivCrawler(timeout=self.timeout, reqeuests_args=new_request_args)
    return self._crawler
 
  
  def _retry(self, func: Callable[[KBLiivCrawler], T])->Optional[T]:
    retry_cnt = 0
    while retry_cnt < self.max_retry_cnt:
      try:
        with_new_proxy = False
        if self._proxy_fail_cnt >= 2: 
          with_new_proxy = True
          self._proxy_fail_cnt = 0

        res = func(self._get_crawler(with_new_proxy=with_new_proxy))
        return res 
      except KeyboardInterrupt:
        print('Ctrl+C encountered.. trying another proxy')
        self._proxy_fail_cnt += 2
        time.sleep(1.0)
      except requests.exceptions.ProxyError as e:
        print(traceback.format_exc())
        print('Encountered proxy error.. retrying')
        self._proxy_fail_cnt += 2
        time.sleep(1.0)
      except requests.exceptions.RequestException as e:
        print(traceback.format_exc())
        print(f'requests exception encountered.. retrying')
        self._proxy_fail_cnt += 1
        retry_cnt += 1
        time.sleep(1.0)
  
  def list_city(self, city: KBDo):
    return self._retry(lambda c: c.list_city(city))

  def list_gu(self, city: KBDo, gu_name: str):
    return self._retry(lambda c: c.list_gu(city=city, gu_name=gu_name))

  def list_apts(self, lawaddrcode: str):
    return self._retry(lambda c: c.list_apts(lawaddrcode=lawaddrcode))

  def apt_info(self, apt_id: int, apt_type: str):
    return self._retry(lambda c: c.apt_info(apt_id=apt_id, apt_type=apt_type))

  def apt_type_info(self, apt_id: int):
    return self._retry(lambda c: c.apt_type_info(apt_id=apt_id))

  def apt_price_info (self, apt_id: int, area_type_id: int):
    return self._retry(lambda c: c.apt_price_info(apt_id=apt_id, area_type_id=area_type_id))

  def kb_price(self, apt_id: int, area_type_id: int)->Optional[int]:
    return self._retry(lambda c: c.kb_price(apt_id=apt_id, area_type_id=area_type_id))

  def partial_orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True, items_per_page:int=10, page_idx=1):
    return self._retry(lambda c: c.partial_orderbook(
      apt_id=apt_id, order_by=order_by, aggregate=aggregate, items_per_page=items_per_page, page_idx=page_idx))

  def orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True):
    return self._retry(lambda c: c.orderbook(
      apt_id=apt_id, order_by=order_by, aggregate=aggregate))

  def cleansed_orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True, 
                         trade_types: Optional[List[TradeType]]=None, sizes: Optional[List[float]]=None, 
                         include_detail:bool=True)->List[RowKBOrderbook]:
    return self._retry(lambda c: c.cleansed_orderbook(
      apt_id=apt_id, order_by=order_by, aggregate=aggregate, trade_types=trade_types, 
      sizes=sizes, include_detail=include_detail))