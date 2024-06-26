#!/usr/bin/env python3
import json
import traceback
import datetime
import os
import sys
from typing import Optional

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)


from tqdm import tqdm
import time

import argparse
import pandas as pd

from korea_apartment_price.path import SCRIPT_ROOT
from korea_apartment_price import db
from korea_apartment_price.kb_liiv import KBLiivCrawler, KBLiivCrawlerWithProxy
from korea_apartment_price.utils import keyconvert
from korea_apartment_price.utils.throttle import Throttler

def parse_args():
  parser = argparse.ArgumentParser()
  parser.add_argument('-r,--remove_todays_orderbook', dest='remove_todays_orderbook', action='store_true', help='remove all orders fetched today')
  parser.add_argument('-l,--list', dest='region_code_list_csv', help='region code list.', default=os.path.join(ROOT, 'scripts/orderbook_region_code.csv'), required=False)
  parser.add_argument('-i,--aptidx', dest='continue_from', type=int, help='continue from idx.', default=None)
  parser.add_argument('-p,--proxy', dest='proxy_list', help='proxy list file', default=os.path.join(ROOT, 'scripts/proxy_lst.txt'), required=False)
  return parser.parse_args()


args = parse_args()
region_codes = pd.read_csv(args.region_code_list_csv)
apt_idnames = set()
proxy_list = []

print ('[*] reading proxy list')
with open(args.proxy_list, 'r') as f:
  for line in f.readlines():
    line = line.strip()
    if len(line) == 0: continue
    if line.startswith('#'): continue
    proxy_list.append(line)


print ('[*] gathering apartment lists')
for region_code in tqdm(region_codes['code5']):
  apts = db.query_kb_apart_by_lawaddrcode(region_code)
  apts = [apt for apt in apts if apt['addrcode'] is not None]
  for apt in apts:
    apt_idnames.add((apt['id'], apt['name']))

apt_idnames = sorted(list(apt_idnames))

db.create_indices()
col = db.get_kbliiv_apt_orderbook_collection()

if args.remove_todays_orderbook:
  print ('[*] removing all orders fetched today')
  now = datetime.datetime.now()
  start_from = datetime.datetime(now.year, now.month, now.day)
  col.delete_many({'fetched_at': {'$gte': start_from}})



print ('[*] downloading orderbooks')


crawler = KBLiivCrawlerWithProxy(proxy_list=proxy_list)
throttler = Throttler(0.6)

for idx, (apt_id, apt_name) in enumerate(apt_idnames):
  if args.continue_from is not None and args.continue_from > idx + 1:
    continue
    
  data = None
  retry_cnt = 0
  fail_cnt = 0
  while data is None:
    print(f'[{idx + 1} / {len(apt_idnames)}] {apt_id},{apt_name} <{retry_cnt}>')
    try:
      throttler.throttle()
      data = crawler.cleansed_orderbook(apt_id, trade_types=[db.TradeType.WHOLE])
    except Exception as e:
      print(f'Exception: {e}')
      print(traceback.format_exc())
      print(f'failed to retrieve apt_name={apt_name} apt_id={apt_id}. retrying..')
      time.sleep(1.0)

    if data is not None and len(data) == 0:
      retry_cnt += 1
      if retry_cnt < 2: data = None

  if data is not None:
    print(f'[{idx + 1} / {len(apt_idnames)}] {apt_id},{apt_name} ==> {len(data)}')
    if len(data) > 0:
      col.insert_many([keyconvert(e, {'trade_type': lambda x: x.value}) for e in data])
  else:
    print(f'{apt_id},{apt_name}: failed to fetch')

print ('[*] done')
