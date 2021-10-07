from typing import Callable, Optional, List, Union, Dict, Any

import pymongo
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

from korea_apartment_price.config import get_cfg

__all__ = ('get_db', 'get_trades_collection', 'get_conn', 'query', 'pick_size', 'pick_price', 'create_indices')

_conn: Optional[MongoClient] = None
_db: Optional[Database]  = None
_trades_collection: Optional[Collection] = None
_addrcodes_collection: Optional[Collection] = None

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

def pick_size(ent)->int:
  return int(ent['size'] / 3.3)

def pick_price(ent)->float:
  return ent['price']

def query(
  apt_infos: Optional[Dict[str, str]]=None,
  addrcode: Optional[str]=None,
  names: Optional[Union[str, List[str]]]=None,
  date_from:Optional[int]=None,
  date_to:Optional[int]=None,
  size_from:Optional[int]=None,
  size_to:Optional[int]=None,
  filters:Optional[List[Callable]]=None,
)->List[Dict[str, Any]]:

  if apt_infos is None and (addrcode is None or names is None):
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

  if apt_infos is None:
    apt_infos = []
    if isinstance(names, str):
      names = [names]

    for name in names:
      apt_infos.append({
        'code': addrcode,
        'name': name
      })
  
  cond_apt_info = []
  for e in apt_infos:
    cond_apt_info.append({
      'lawaddrcode_city': int(str(e['code'])[:5]),
      'lawaddrcode_dong': int(str(e['code'])[5:]),
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


def create_indices():
  col = get_trades_collection()
  col.create_index('lawaddrcode_city')
  col.create_index('lawaddrcode_dong')
  col.create_index('name')
  col.create_index('date_serial')
  col.create_index('size')