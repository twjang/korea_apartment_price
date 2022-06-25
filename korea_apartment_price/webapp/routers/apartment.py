import re

from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import korea_apartment_price
from korea_apartment_price.db import ApartmentId
from korea_apartment_price.webapp.deps import (
  get_current_user
)

router = APIRouter (
    prefix="/apart",
    tags=["Apartment"],
    dependencies=[Depends(get_current_user)],
    responses={404: {"description": "Not found"}},
)


class ApartmentIdModel(BaseModel):
  address: str
  lawaddrcode: str
  name: str

@router.get("/search", response_model=List[ApartmentIdModel])
async def search_apt(addr: str='', apt_name: str=''):
  aptlst = korea_apartment_price.shortcuts.search(addr, apt_name)
  return aptlst


class AptIdRequest(BaseModel):
  address: str
  lawaddrcode: str
  name: str

class HistoryRequest(BaseModel):
  address: str
  lawaddrcode: str
  name: str
  size: int
  date_from: Optional[int]
  date_to: Optional[int]

def _keep_keys_in_dict(x: Dict[str, Any], keep:List[str])->Dict[str, Any]:
  res = {}
  for k in keep:
    if k in x: res[k] = x.get(k)
  return res

@router.post("/sizes", response_model=List[int])
async def query_sizes(query: AptIdRequest):
  apt_id: ApartmentId = {
    'address': query.address,
    'lawaddrcode': query.lawaddrcode,
    'name': query.name,
  }
  sizes = korea_apartment_price.db.query_sizes(
    apt_id=apt_id,
  )

  return sizes


@router.post("/trades")
async def query_trades(query: HistoryRequest):
  apt_id: ApartmentId = {
    'address': query.address,
    'lawaddrcode': query.lawaddrcode,
    'name': query.name,
  }
  trades = korea_apartment_price.db.query_trades(
    apt_ids=[apt_id],
    date_from = query.date_from,
    date_to= query.date_to,
    size_from = query.size,
    size_to = query.size,
  )

  for e in trades: del e['_id']
  trades = [_keep_keys_in_dict(r, ['price', 'date_serial', 'floor', 'is_canceled', 'canceled_date']) for r in trades]
  return trades

@router.post("/rents")
async def query_rents(query: HistoryRequest):
  apt_id: ApartmentId = {
    'address': query.address,
    'lawaddrcode': query.lawaddrcode,
    'name': query.name,
  }

  rents = korea_apartment_price.db.query_rents(
    apt_ids=[apt_id],
    date_from = query.date_from,
    date_to= query.date_to,
    size_from = query.size, 
    size_to = query.size 
  )

  rents = [_keep_keys_in_dict(r, ['price_deposit', 'price_monthly', 'date_serial', 'floor']) for r in rents]
  return rents

@router.post("/info")
async def query_info(query: AptIdRequest):
  apt_id: ApartmentId = {
    'address': query.address,
    'lawaddrcode': query.lawaddrcode,
    'name': query.name,
  }

  info = korea_apartment_price.db.query_kb_apart (
    apt_id=apt_id,
  )
  if 'regulList' in info:
    del info['regulList']
  return info['detail']


@router.post("/orderbook")
async def query_orderbook(query: HistoryRequest, mode:Literal['simple', 'detail', 'agg']='agg'):
  apt_id: ApartmentId = {
    'address': query.address,
    'lawaddrcode': query.lawaddrcode,
    'name': query.name,
  }
  orderbook = sorted(
    korea_apartment_price.db.query_kb_orderbook(apt_id, 
    size_from=query.size-1, 
    size_to=query.size+1, 
    fetched_from=query.date_from,
    fetched_to=query.date_from,
  ), key=lambda x: x['fetched_at'])

  if mode == 'agg':
    res_set = set()
    for o in orderbook:
      fetched_at = o.get('fetched_at')
      fetched_date = fetched_at.strftime('%Y%m%d')

      apt_dong = o.get('apt_dong', None)
      if apt_dong is not None:
        matched = re.match(r'[0-9]+', apt_dong)
        if matched is not None:
          apt_dong = matched.group(0) + '동'
      if apt_dong is None:
        if apt_dong is None: apt_dong = '동정보없음'

      apt_ho = None
      if o.get('apt_ho', None) is not None:
        matched = re.match(r'[0-9]+', o['apt_ho'])
        if matched is not None:
          apt_ho = matched.group(0) + '호'
      if apt_ho is None and o.get('floor', None) is not None:
        matched = re.match(r'[0-9]+', o['floor'])
        if matched is not None:
          apt_ho = matched.group(0) + '00호'
      if apt_ho is None: apt_ho = '호정보없음'

      if o['detail']['최소매매가'] is not None:
        price = int(o['detail']['최소매매가']) / 10000
      else:
        price = o['price'] / 10000

      item = (fetched_date, price, apt_dong, apt_ho)
      res_set.add(item)

    res_map = {}
    for fetched_date, price, apt_dong, apt_ho in res_set:
      if not fetched_date in res_map: 
        res_map[fetched_date] = {}
      if not price in res_map[fetched_date]:
        res_map[fetched_date][price] = []
      res_map[fetched_date][price].append((apt_dong, apt_ho))

    res = []
    for fetched_date in sorted(res_map.keys()):
      items = []
      for price in sorted(res_map[fetched_date].keys()):
        items.append({
          'price': price,
          'homes': [f'{e[0]} {e[1]}' for e in res_map[fetched_date][price]] ,
        })
      res.append({
        'fetched_date': fetched_date,
        'items': items
      })
    return res


  elif mode == 'simple' or mode == 'detail':
    for o in orderbook:
      if '_id' in o:
        del o['_id']
        if not mode == 'simple':
          del o['detail']
  else:
    return []
  return orderbook
