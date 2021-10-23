import requests
from typing import Optional
from enum import Enum

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

  def orderbook(self, apt_id: int, order_by: str='date', aggregate: bool=True, items_per_page:int=10, page_idx=1):
    cnt, _ = self.partial_orderbook(apt_id, order_by, aggregate, 10, 1)
    cnt, res = self.partial_orderbook(apt_id, order_by, aggregate, cnt, 1)
    return res
