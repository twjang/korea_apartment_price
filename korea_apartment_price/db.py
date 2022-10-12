from enum import Enum
from typing import Callable, Optional, List, Tuple, TypedDict, Union, Dict, Any

import datetime
from pprint import pprint
import pymongo
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

from korea_apartment_price.config import get_cfg
from korea_apartment_price.utils import editdist
from korea_apartment_price.utils.converter import safe_int
from korea_apartment_price import region_code

__all__ = (
  'get_db',
  'get_trades_collection',
  'get_geocode_collection',
  'get_kbliiv_apt_collection',
  'get_kbliiv_apt_type_collection',
  'get_conn',
  'query_trades',
  'query_geocode',
  'pick_size',
  'pick_price',
  'create_indices',
)

_conn: Optional[MongoClient] = None
_db: Optional[Database]  = None

_rents_collection: Optional[Collection] = None
_trades_collection: Optional[Collection] = None
_geocodes_collection: Optional[Collection] = None
_kbliiv_apt_collection: Optional[Collection] = None
_kbliiv_apt_type_collection: Optional[Collection] = None
_kbliiv_apt_orderbook_collection: Optional[Collection] = None
_deposit_interest_rate_collection: Optional[Collection] = None


def get_conn()->MongoClient:
  global _conn
  if _conn is None:
    uri = get_cfg()['MONGO_URI']
    _conn = pymongo.MongoClient(uri)
  return _conn

def get_db()->Database:
  global _db
  if _db is None:
    conn = get_conn()
    _db = conn.get_default_database()
  return _db



### code related to trades

def get_trades_collection()->Collection:
  global _trades_collection
  if _trades_collection is None:
    _trades_collection = get_db()['trades']
  return _trades_collection

def get_rents_collection()->Collection:
  global _rents_collection
  if _rents_collection is None:
    _rents_collection = get_db()['rents']
  return _rents_collection


def pick_size(ent)->int:
  return int(ent['size'] / 3.3)

def pick_price(ent)->float:
  return ent['price']

class RowTrade(TypedDict):
  _id: Any
  price: int             # 가격
  created_at: int        # 건축년도
  addr_road: str         # 도로명
  addrcode_bld: int      # 도로명건물본번호코드
  addrcode_bld_sub: int  # 도로명건물부번호코드
  addrcode_city: int     # 도로명시군구코드
  addrcode_serial: int   # 도로명일련번호코드
  addrcode: int          # 도로명코드
  lawaddr_dong: str      # 법정동
  lawaddrcode_main: int  # 법정동본번코드
  lawaddrcode_sub: int   # 법정동부번코드
  lawaddrcode_city: int  # 법정동시군구코드
  lawaddrcode_dong: int  # 법정동읍면동코드
  lawaddrcode_jibun: int # 법정동지번코드
  name: str              # 아파트
  date_serial: int       # 매매일
  year: int              # 년
  month: int             # 월
  date: int              # 일
  size: float            # 전용면적
  jibun: Union[str, int] # 지번
  location_code: int     # 지역코드
  floor: int             # 층
  is_canceled: bool      # 취소여부
  canceled_date: int     # 취소일

"""
<보증금액>75,000</보증금액>
<월세금액>0</월세금액>
<갱신요구권사용 />
<건축년도>2008</건축년도>
<법정동>사직동</법정동>
<아파트>광화문스페이스본(101동~105동)</아파트>
<계약구분 />
<계약기간 />
<년>2015</년>
<월>1</월>
<일>9</일>
<전용면적>158.99</전용면적>
<종전계약보증금 />
<종전계약월세 />
<지번>9</지번>
<지역코드>11110</지역코드>
<층>7</층>
"""
class RowRent(TypedDict):
  _id: Any
  price_deposit: int
  price_monthly: int
  rent_extended: bool
  created_at: int
  lawaddr_dong: str
  name: str
  contract_type: str
  contract_duration: str
  date_serial: int
  year: int
  month: int
  date: int
  size: float
  prev_deposit: int
  prev_monthly: int
  jibun: str
  location_code: int
  floor: int



class ApartmentId(TypedDict):
  address: str   # 주소
  lawaddrcode: str # 법정동코드 (시 + 동)
  name: str    # 아파트 이름

def query_sizes(
  apt_id: ApartmentId
):
  cond = {
    'lawaddrcode_city': int(str(apt_id['lawaddrcode'])[:5]),
    'lawaddrcode_dong': int(str(apt_id['lawaddrcode'])[5:]),
    'name': apt_id['name']
  }

  col = get_trades_collection()
  cursor = col.aggregate([
    {'$match':cond }, 
    {'$group': {'_id':{ 'size': '$size'}}}, 
  ])

  res = set()
  for ent in cursor:
    res.add(int(ent['_id']['size'] / 3.3 + 0.5))


  cond = {
    'location_code': int(str(apt_id['lawaddrcode'])[:5]),
    'name': apt_id['name']
  }

  col = get_rents_collection()
  cursor = col.aggregate([
    {'$match':cond }, 
    {'$group': {'_id':{ 'size': '$size'}}}, 
  ])

  for ent in cursor:
    res.add(int(ent['_id']['size'] / 3.3 + 0.5))
  return sorted(list(res))



def query_rents(
  apt_ids: Optional[List[ApartmentId]]=None,
  lawaddrcode: Optional[str]=None,
  names: Optional[Union[str, List[str]]]=None,
  date_from:Optional[int]=None,
  date_to:Optional[int]=None,
  size_from:Optional[int]=None,
  size_to:Optional[int]=None,
  filters:Optional[List[Callable]]=None,
)->Union[List[RowRent], List[Any]]:

  def _convert_lawaddrcode_for_rent(lawaddrcode:str)->Optional[Dict[str, str]]:
    lawaddrcode_city = lawaddrcode[:5]
    lawaddr_city = None
    lawaddr_dong = None

    city_entry = region_code.search([lawaddrcode_city + '00000'])
    if len(city_entry) > 0:
      lawaddr_city = city_entry[0]['address']

    dong_entry = region_code.search([lawaddrcode])
    if len(dong_entry) > 0 and lawaddr_city is not None:
      lawaddr_dong = dong_entry[0]['address'].replace(lawaddr_city, '').strip()

    if lawaddr_dong is not None:
      return {
        'location_code': int(lawaddrcode_city),
        'lawaddr_dong': lawaddr_dong
      }
    return None


  if apt_ids is None and (lawaddrcode is None or names is None):
    raise ValueError('Either apt_infos or (addrcode, names) should be given')

  cond = {}

  date_cond = {}
  if date_from is not None: date_cond['$gte'] = date_from
  if date_to is not None: date_cond['$lte'] = date_to
  if len(date_cond) > 0: cond['date_serial'] = date_cond

  size_cond = {}
  if size_from is not None: size_cond['$gte'] = size_from * 3.3 - 1.6
  if size_to is not None: size_cond['$lte'] = size_to * 3.3 + 1.6
  if len(size_cond) > 0: cond['size'] = size_cond

  if apt_ids is None:
    apt_ids = []
    if isinstance(names, str):
      names = [names]

    for name in names:
      apt_ids.append({
        'lawaddrcode': lawaddrcode,
        'name': name
      })

  cond_apt_info = []
  for e in apt_ids:
    base_ent = _convert_lawaddrcode_for_rent(e['lawaddrcode'])
    new_ent = base_ent.copy()
    new_ent['name'] = e['name']
    cond_apt_info.append(new_ent)

  cond['$or'] = cond_apt_info

  col = get_rents_collection()
  cursor = col.find({'$query':cond, '$orderby':{ 'date_serial': 1 }})

  res = []
  for ent in cursor:
    if filters is not None:
      for filter in filters: ent = filter(ent)
    res.append(ent)
  return res



def query_trades(
  apt_ids: Optional[List[ApartmentId]]=None,
  lawaddrcode: Optional[str]=None,
  names: Optional[Union[str, List[str]]]=None,
  date_from:Optional[int]=None,
  date_to:Optional[int]=None,
  size_from:Optional[int]=None,
  size_to:Optional[int]=None,
  filters:Optional[List[Callable]]=None,
  include_canceled:bool = False
)->Union[List[RowTrade], List[Any]]:

  if apt_ids is None and (lawaddrcode is None or names is None):
    raise ValueError('Either apt_infos or (addrcode, names) should be given')

  cond = {}

  date_cond = {}
  if date_from is not None: date_cond['$gte'] = date_from
  if date_to is not None: date_cond['$lte'] = date_to
  if len(date_cond) > 0: cond['date_serial'] = date_cond

  size_cond = {}
  if size_from is not None: size_cond['$gte'] = size_from * 3.3 - 1.6
  if size_to is not None: size_cond['$lte'] = size_to * 3.3 + 1.6
  if len(size_cond) > 0: cond['size'] = size_cond

  if apt_ids is None:
    apt_ids = []
    if isinstance(names, str):
      names = [names]

    for name in names:
      apt_ids.append({
        'lawaddrcode': lawaddrcode,
        'name': name
      })

  cond_apt_info = []
  for e in apt_ids:
    cond_apt_info.append({
      'lawaddrcode_city': int(str(e['lawaddrcode'])[:5]),
      'lawaddrcode_dong': int(str(e['lawaddrcode'])[5:]),
      'name': e['name']
    })

  cond['$or'] = cond_apt_info
  if not include_canceled:
    cond['is_canceled'] = False

  col = get_trades_collection()
  cursor = col.find({'$query':cond, '$orderby':{ 'date_serial': 1 }})

  res = []
  for ent in cursor:
    if filters is not None:
      for filter in filters: ent = filter(ent)
    res.append(ent)
  return res



### Related to geocode
class RowGeocode(TypedDict):
  _id: Any
  addrcode_city: int     # 도로명시군구코드
  addrcode: int          # 도로명코드
  addrcode_bld: int      # 도로명건물본번호코드
  addrcode_bld_sub: int  # 도로명건물부번호코드
  name: str              # 건물명
  lat: float             # 위도
  lng: float             # 경도


def get_geocodes_collection()->Collection:
  global _geocodes_collection
  if _geocodes_collection is None:
    _geocodes_collection = get_db()['geocodes']
  return _geocodes_collection

def query_geocode(trade: RowTrade)-> Optional[RowGeocode]:
  col = get_geocodes_collection()
  query = {k: v for k, v in trade.items() if k in ['addrcode_city', 'addrcode', 'addrcode_bld', 'addrcode_bld_sub']}
  ent: RowGeocode = col.find_one(query)
  if ent is None: return None
  return ent


### Related to kbland
class RowKBApart(TypedDict):
  _id: int
  id: int                          # KB 단지기본일련번호
  name: str                        # 단지명
  addrcode_city: Optional[int]     # 도로명시군구코드
  addrcode: Optional[int]          # 도로명코드
  addrcode_bld: Optional[int]      # 도로명건물본번호코드
  addrcode_bld_sub: Optional[int]  # 도로명건물부번호코드
  lawaddrcode_city: Optional[int]  # 법정동코드(시)
  lawaddrcode_dong: Optional[int]  # 법정동코드(동)
  lawaddrcode_main: Optional[int]  # 법정동코드(본번)
  lawaddrcode_sub: Optional[int]   # 법정동코드(부번)
  apttype: Optional[int]           # 매물타입 (1-아파트, 4-오피스텔)
  lat: float                       # 위도
  lng: float                       # 경도
  detail: Any                      # 기타 상세정보

class RowKBApartType(TypedDict):
  _id: Any
  id: int         # 면적 일련번호
  apart_id: int   # KB 단지기본일련번호
  name: str       # 아파트 명
  size: int       # 전용면적(평)
  detail: Any     # 기타 상세정보


class TradeType(Enum):
  WHOLE = 1       # 매매
  FULL_RENT = 2   # 전세
  RENT = 3        # 월세

class RowKBOrderbook(TypedDict):
  _id: Any
  apart_id: int                           # KB 단지기본일련번호
  price: Union[Tuple[float,float], float] # 매매가/전세가/(보증금,월세)
  size: float                             # 전용면적(평)
  confirmed_at: datetime.datetime         # 확인일자
  fetched_at: datetime.datetime           # 다운로드일시
  floor: str                              # 층수
  apt_dong: Optional[str]                 # 건물동명
  apt_ho: Optional[str]                   # 건물호명
  trade_type: TradeType                   # 매물거래구분
  detail: Any                             # 세부사항

class EntryNotFound(Exception): pass


def get_kbliiv_apt_collection()->Collection:
  global _kbliiv_apt_collection
  if _kbliiv_apt_collection is None:
    _kbliiv_apt_collection = get_db()['kbliiv_apt']
  return _kbliiv_apt_collection

def get_kbliiv_apt_type_collection()->Collection:
  global _kbliiv_apt_type_collection
  if _kbliiv_apt_type_collection is None:
    _kbliiv_apt_type_collection = get_db()['kbliiv_apt_type']
  return _kbliiv_apt_type_collection

def get_kbliiv_apt_orderbook_collection()->Collection:
  global _kbliiv_apt_orderbook_collection
  if _kbliiv_apt_orderbook_collection is None:
    _kbliiv_apt_orderbook_collection = get_db()['kbliiv_apt_orderbook']
  return _kbliiv_apt_orderbook_collection

def query_kb_apart(apt_id: ApartmentId)->RowKBApart:
  trade_col = get_trades_collection()
  kb_col = get_kbliiv_apt_collection()
  lawaddrcode_city = safe_int(apt_id['lawaddrcode'][:5])
  lawaddrcode_dong = safe_int(apt_id['lawaddrcode'][5:])
  apt_name = apt_id['name']
  ent = trade_col.find_one({
    'lawaddrcode_city':lawaddrcode_city, 
    'lawaddrcode_dong': lawaddrcode_dong,
    'name': apt_name
  })

  kb_apts = []
  if ent is not None:
    # search based on address
    kb_apts: RowKBApart = kb_col.find({
      'lawaddrcode_city': lawaddrcode_city,
      'lawaddrcode_dong': lawaddrcode_dong,
      'lawaddrcode_main': ent['lawaddrcode_main'],
      'lawaddrcode_sub': ent['lawaddrcode_sub'],
    })

    kb_apts = list(kb_apts)

  # fallback to best matching name
  if len(kb_apts) == 0:
    kb_apts: RowKBApart = kb_col.find({
      'lawaddrcode_city': lawaddrcode_city,
      'lawaddrcode_dong': lawaddrcode_dong,
    })
    kb_apts = list(kb_apts)
    assert len(kb_apts) > 0

    sortpairs = []
    names = []
    for aptidx, apt in enumerate(kb_apts): 
      names.append(apt['name'])
      dist = editdist(apt_name, apt['name'])
      sortpairs.append((dist, aptidx))
    sortpairs.sort()
    names = [f'"{n}"' for n in names]
    kb_apts = [ kb_apts[sortpairs[0][1]] ]

    print (f'For "{apt_name}", "{kb_apts[0]["name"]}" was chosen among [{", ".join(names)}]')


  if len(kb_apts) == 0:
    raise EntryNotFound('cannot find corresponding kb apart')
  elif len(kb_apts) > 1:
    pprint(kb_apts)

  return kb_apts[0]


def query_kb_apart_by_lawaddrcode(lawaddrcode: int)->List[RowKBApart]:
  kb_col = get_kbliiv_apt_collection()
  str_lawaddrcode = str(lawaddrcode)
  if len(str_lawaddrcode) > 5: 
    query = {
      'lawaddrcode_city': int(str_lawaddrcode[:5]),
      'lawaddrcode_dong': int(str_lawaddrcode[5:]),
    }
  else:
    query = {
      'lawaddrcode_city': int(str_lawaddrcode[:5]),
    }

  kb_apts: List[RowKBApart] = kb_col.find(query)
  return kb_apts



def query_kb_apart_types(apt_id: ApartmentId)->List[RowKBApartType]:
  col = get_kbliiv_apt_type_collection()
  kb_apt = query_kb_apart(apt_id)
  kb_apt_types = col.find({
    'apart_id': kb_apt['id']
  })
  return kb_apt_types

def query_kb_orderbook(apt_id: ApartmentId, size_from: Optional[int]=None, size_to:Optional[int]=None, fetched_from:Optional[int]=None, fetched_to: Optional[int]=None)->List[RowKBOrderbook]:
  kb_apt = query_kb_apart(apt_id)
  col = get_kbliiv_apt_orderbook_collection()

  cond = [{
    'apart_id': kb_apt['id'],
  }]
  if size_from is not None:
    cond.append({'size': {"$gte": size_from}})

  if size_to is not None:
    cond.append({'size': {"$lte": size_to}})

  if fetched_from is not None:
    year = fetched_from // 10000
    month = (fetched_from // 100) % 100
    day = fetched_from % 100
    cond.append({'fetched_at': {"$gte": datetime.datetime(year, month, day)}})

  if fetched_to is not None:
    year = fetched_to // 10000
    month = (fetched_to // 100) % 100
    day = fetched_to % 100
    cond.append({'fetched_at': {"$lte": datetime.datetime(year, month, day)}})

  return col.find({'$and':cond})


### Related to deposit interest rate (전월세 전환율)
class RowDepositInterestRate(TypedDict):
  _id: Any
  region: str
  value: float
  date_serial: int
  year: int
  month: int
  size_min: int
  size_max: int


def get_deposit_interest_rate_collection()->Collection:
  global _deposit_interest_rate_collection
  if _deposit_interest_rate_collection is None:
    _deposit_interest_rate_collection = get_db()['deposit_interest_rate']
  return _deposit_interest_rate_collection


def query_deposit_interest_rate(region: str, size: Optional[int]=None, start_ym:Optional[int]=None, end_ym: Optional[int]=None)->List[RowDepositInterestRate]:
  col = get_deposit_interest_rate_collection()
  cond = [{
    'region': region,
  }]
  if size is not None:
    cond.append({'size_min': {"$lte": size}})
    cond.append({'size_max': {"$gte": size}})

  if start_ym is not None:
    cond.append({'date_serial': {"$gte": start_ym}})

  if end_ym is not None:
    cond.append({'date_serial': {"$lte": end_ym}})

  return col.find({'$query':{'$and': cond}, '$orderby':{ 'date_serial': 1 }})


def create_indices():
  col = get_rents_collection()
  col.create_index('location_code')
  col.create_index('lawaddr_dong')
  col.create_index('name')
  col.create_index('date_serial')
  col.create_index('size')
  col.create_index('year')
  col.create_index('month')
  col.create_index('date')

  col = get_trades_collection()
  col.create_index('lawaddrcode_city')
  col.create_index('lawaddrcode_dong')
  col.create_index('name')
  col.create_index('date_serial')
  col.create_index('size')
  col.create_index('year')
  col.create_index('month')
  col.create_index('date')
  col.create_index('is_canceled')
  col.create_index('canceled_date')

  col = get_geocodes_collection()
  col.create_index('addrcode_city')
  col.create_index('addrcode')
  col.create_index('addrcode_bld')
  col.create_index('addrcode_bld_sub')

  col = get_kbliiv_apt_collection()
  col.create_index('id')
  col.create_index('addrcode_city')
  col.create_index('addrcode')
  col.create_index('addrcode_bld')
  col.create_index('addrcode_bld_sub')
  col.create_index('lawaddrcode_city')
  col.create_index('lawaddrcode_dong')
  col.create_index('lawaddrcode_main')
  col.create_index('lawaddrcode_sub')
  col.create_index('apttype')

  col = get_kbliiv_apt_type_collection()
  col.create_index('id')
  col.create_index('apart_id')
  col.create_index('size')

  col = get_kbliiv_apt_orderbook_collection()
  col.create_index('apart_id')
  col.create_index('size')
  col.create_index('price')
  col.create_index('confirmed_at')
  col.create_index('fetched_at')
  col.create_index('trade_type')

  col = get_deposit_interest_rate_collection()
  col.create_index('region')
  col.create_index('size_min')
  col.create_index('size_max')
  col.create_index('date_serial')
  col.create_index('year')
  col.create_index('month')
