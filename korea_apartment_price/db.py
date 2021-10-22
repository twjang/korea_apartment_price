from typing import Callable, Optional, List, TypedDict, Union, Dict, Any

import pymongo
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

from korea_apartment_price.config import get_cfg

__all__ = ('get_db', 'get_trades_collection', 'get_conn', 'query_trades', 'pick_size', 'pick_price', 'create_indices')

_conn: Optional[MongoClient] = None
_db: Optional[Database]  = None
_trades_collection: Optional[Collection] = None
_geocodes_collection: Optional[Collection] = None

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

def get_trades_collection()->Collection:
    global _trades_collection
    if _trades_collection is None:
        _trades_collection = get_db()['trades']
    return _trades_collection

def get_geocodes_collection()->Collection:
    global _geocodes_collection
    if _geocodes_collection is None:
        _geocodes_collection = get_db()['geocodes']
    return _geocodes_collection


### code related to trades

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

class RowGeocode(TypedDict):
  _id: Any 
  addrcode_city: int     # 도로명시군구코드
  addrcode: int          # 도로명코드 
  addrcode_bld: int      # 도로명건물본번호코드
  addrcode_bld_sub: int  # 도로명건물부번호코드
  name: str              # 건물명
  lat: float             # 위도
  lng: float             # 경도

class ApartmentId(TypedDict):
  address: str     # 주소
  lawaddrcode: str # 법정동코드 (시 + 동)
  name: str        # 아파트 이름

def query_trades(
  apt_ids: Optional[List[ApartmentId]]=None,
  lawaddrcode: Optional[str]=None,
  names: Optional[Union[str, List[str]]]=None,
  date_from:Optional[int]=None,
  date_to:Optional[int]=None,
  size_from:Optional[int]=None,
  size_to:Optional[int]=None,
  filters:Optional[List[Callable]]=None,
)->List[Dict[str, Any]]:

    if apt_ids is None and (lawaddrcode is None or names is None):
        raise ValueError('Either apt_infos or (addrcode, names) should be given')

    cond = {}

    date_cond = {}
    if date_from is not None: date_cond['$gte'] = date_from
    if date_to is not None: date_cond['$lte'] = date_to
    if len(date_cond) > 0: cond['date_serial'] = date_cond

    size_cond = {}
    if size_from is not None: size_cond['$gte'] = size_from * 3.3 - 3.3
    if size_to is not None: size_cond['$lte'] = size_to * 3.3 + 3.3
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

    col = get_trades_collection()
    cursor = col.find({'$query':cond, '$orderby':{ 'date_serial': 1 }})

    res = []
    for ent in cursor:
        if filters is not None:
            for filter in filters: ent = filter(ent)
        res.append(ent)
    return res


def query_geocode(trade: RowTrade)-> Optional[RowGeocode]:
  col = get_geocodes_collection()
  query = {k: v for k, v in trade.items() if k in ['addrcode_city', 'addrcode', 'addrcode_bld', 'addrcode_bld_sub']}
  ent: RowGeocode = col.find_one(query)
  if ent is None: return None
  return ent


def create_indices():
    col = get_trades_collection()
    col.create_index('lawaddrcode_city')
    col.create_index('lawaddrcode_dong')
    col.create_index('name')
    col.create_index('date_serial')
    col.create_index('size')

    col = get_geocodes_collection()
    col.create_index('addrcode_city')
    col.create_index('addrcode')
    col.create_index('addrcode_bld')
    col.create_index('addrcode_bld_sub')
