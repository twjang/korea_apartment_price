#!/usr/bin/env python3
import traceback
import datetime
import os
import sys

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(ROOT)


from tqdm import tqdm
import time
import json

import korea_apartment_price
from typing import Callable, List, Dict, Any, Optional, Tuple, TypeVar

import argparse
import pandas as pd
import requests
from bs4 import BeautifulSoup

from korea_apartment_price.path import SCRIPT_ROOT
from korea_apartment_price import db 
from korea_apartment_price.kb_liiv import KBLiivCrawler
from korea_apartment_price.utils import keyconvert

def parse_args():
  parser = argparse.ArgumentParser()
  parser.add_argument('-r,--remove_todays_orderbook', dest='remove_todays_orderbook', action='store_true', help='remove all orders fetched today')
  return parser.parse_args()


args = parse_args()
region_codes = pd.read_csv(os.path.join(SCRIPT_ROOT, 'orderbook_region_code.csv'))
apt_idnames = set()

print ('[*] gathering apartment lists')
for region_code in tqdm(region_codes['code5']):
  apts = db.query_kb_apart_by_lawaddrcode(region_code)
  apts = [apt for apt in apts if apt['addrcode'] is not None]
  for apt in apts:
    apt_idnames.add((apt['id'], apt['name']))

apt_idnames = list(apt_idnames)

db.create_indices()
col = db.get_kbliiv_apt_orderbook_collection()

if args.remove_todays_orderbook:
  print ('[*] removing all orders fetched today')
  now = datetime.datetime.now()
  start_from = datetime.datetime(now.year, now.month, now.day)
  col.delete_many({'fetched_at': {'$gte': start_from}})



print ('[*] downloading orderbooks')
crawler = KBLiivCrawler()

for apt_id, apt_name in tqdm(apt_idnames):
  data = None
  while data is None:
    try:
      data = crawler.cleansed_orderbook(apt_id, trade_types=[db.TradeType.WHOLE])
    except KeyboardInterrupt as e:
      print('Ctrl+C detected. just retrying..')
      time.sleep(1.0)
    except Exception as e:
      print(f'Exception: {e}')
      print(traceback.format_exc())
      print(f'failed to retrieve apt_name={apt_name} apt_id={apt_id}. retrying..')
      time.sleep(1.0)

  if len(data) > 0:
    col.insert_many([keyconvert(e, {'trade_type': lambda x: x.value}) for e in data])

print ('[*] done')