#!/usr/bin/env python3
import os
import sys
from typing import List

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)

import argparse
import time
import math
import pickle
import requests
from tqdm import tqdm
from korea_apartment_price.db import RowKBApart, RowKBApartType
from korea_apartment_price.kb_liiv import KBDo, KBLiivCrawlerWithProxy
from korea_apartment_price.utils.converter import keyfilt, safe_float, safe_int
from korea_apartment_price.path import *
from korea_apartment_price import db

def parse_args():
  parser = argparse.ArgumentParser()
  parser.add_argument('--skip_downloaded', action='store_false', help='skip already downloaded apartments')
  parser.add_argument('--truncate_db', action='store_true', help='drop collection before downloading')
  parser.add_argument('--disable_cache', action='store_true', help='do not load previously downloaded gu list')
  parser.add_argument('-p,--proxy', dest='proxy_list', help='proxy list file', default=os.path.join(ROOT, 'scripts/proxy_lst.txt'), required=False)
  return parser.parse_args()

args = parse_args()
gu_lst = None
apt_lst = None
is_updated = True
proxy_list = []
cur_proxy_idx = 0

print ('[*] reading proxy list')
with open(args.proxy_list, 'r') as f:
  for line in f.readlines():
    line = line.strip()
    if len(line) == 0: continue
    if line.startswith('#'): continue
    proxy_list.append(line)

crawler = KBLiivCrawlerWithProxy(proxy_list=proxy_list)

path_cache = os.path.join(CACHE_ROOT, 'kb_apt_summary.pkl')
if os.path.exists(path_cache) and not args.disable_cache:
  is_updated = False
  with open(path_cache, 'rb') as f:
    gu_lst, apt_lst = pickle.load(f)

print('[*] Preparing gu list')
if gu_lst is None:
  gu_lst = []
  for do_ent in tqdm(KBDo):
    cities = crawler.list_city(do_ent)
    for city in cities:
      gus = crawler.list_gu(do_ent, city['시군구명'])
      gu_lst.extend(gus)

print('[*] Preparing apartment list')
if apt_lst is None:
  apt_lst = []
  for gu_ent in tqdm(gu_lst):
    """
      {
          '단지기본일련번호': 424658,
          '물건식별자': 'KBM224203',
          'wgs84포인트': 'AAAAAAEBAAAAd7LlphfCX0DKJNnZRs1CQA==',
          '단지명': '한솔에코빌',
          '법정동코드': '1129013600',
          '매물종별구분명': '오피스텔',
          '매물종별구분': '04',
          '재건축여부': '0',
          'wgs84경도': '127.03269360',
          'wgs84위도': '37.6037247'
      }
    """
    lawaddrcode = gu_ent['법정동코드']
    apts = crawler.list_apts(lawaddrcode)
    apt_lst.extend(apts)

if is_updated:
  print('[*] Saving apartment list')
  with open(path_cache, 'wb') as f:
    pickle.dump((gu_lst, apt_lst), f)


print('[*] Updating apartment info and types')
db.create_indices()

apt_col = db.get_kbliiv_apt_collection()
apt_type_col = db.get_kbliiv_apt_type_collection()


if args.truncate_db:
  apt_col.drop()
  apt_type_col.drop()
  apt_col = db.get_kbliiv_apt_collection()
  apt_type_col = db.get_kbliiv_apt_type_collection()


prog_bar = tqdm(apt_lst)
for apt_ent in prog_bar:
  apt_id = safe_int(apt_ent['단지기본일련번호'])
  if apt_col.count_documents({'_id': apt_id}) > 0 and args.skip_downloaded:
    continue
  if apt_ent.get('매물종별구분', '').startswith('C'):
    continue # 분양 매물
  
  apt_info = None
  apt_types = None

  while apt_info is None or apt_types is None:
    try:
      if apt_info is None:
        apt_info = crawler.apt_info(apt_id, apt_ent['매물종별구분'])  
      if apt_types is None:
        apt_types = crawler.apt_type_info(apt_id)
    except requests.exceptions.Timeout:
      time.sleep(10)
      prog_bar.display(f'retrying {apt_id}')
  
  addrcode_city = None
  addrcode = None
  lawaddrcode_city = None
  lawaddrcode_dong = None

  if apt_info['도로명우편번호'] is not None: 
    addrcode_city = apt_info['도로명우편번호'][:5]
    addrcode = apt_info['도로명우편번호'][5:]
  
  if apt_info['법정동코드'] is not None:
    lawaddrcode_city = apt_info['법정동코드'][:5]
    lawaddrcode_dong = apt_info['법정동코드'][5:]

  row_apt: RowKBApart = {
    'id': apt_id,
    '_id': apt_id,
    'name': apt_info['단지명'],
    'addrcode_city': safe_int(addrcode_city),
    'addrcode': safe_int(addrcode),
    'addrcode_bld': safe_int(apt_info['도로명건물본번']),
    'addrcode_bld_sub': safe_int(apt_info['도로명건물부번']),
    'lawaddrcode_city': safe_int(lawaddrcode_city),
    'lawaddrcode_dong': safe_int(lawaddrcode_dong),
    'lawaddrcode_main': safe_int(apt_info['본번지내용']),
    'lawaddrcode_sub': safe_int(apt_info['부번지내용']),
    'apttype': safe_int(apt_info['매물종별구분']),
    'lat': safe_float(apt_info['wgs84위도']),
    'lng': safe_float(apt_info['wgs84경도']),
    'detail': apt_info
  }
  apt_col.replace_one({'_id': apt_id}, row_apt, upsert=True)

  for t in apt_types:
    apt_type_id = safe_int(t['면적일련번호'])
    row_apt_type: RowKBApartType = {
      '_id': apt_type_id,
      'id': apt_type_id,
      'apart_id': apt_id,
      'name': apt_info['단지명'],
      'size': math.floor(0.5 + safe_float(t['전용면적평'])),
      'detail': t,
    } 
    apt_type_col.replace_one({'_id': apt_type_id}, row_apt_type, upsert=True)

print('[+] Done')
