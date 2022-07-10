import random
from typing import Any, Literal, Optional

from pydantic import BaseModel

from korea_apartment_price.config import get_cfg

def _random_chars(length:int, pool:str='1234567890abcdefghijklmnopqrstuvwxyz')->str:
  res = ''
  for _ in range(length):
    res += random.choice(pool)
  return res

WEBAPP_CFG = get_cfg().get('WEBAPP', {})

DB_TYPE = WEBAPP_CFG.get('DB_TYPE', 'sqlite')
DB_NAME = WEBAPP_CFG.get('DB_NAME', './db.sqlite')
DB_ARGS = WEBAPP_CFG.get('DB_ARGS', {})
SALT    = WEBAPP_CFG.get('ADMIN_PASSWORD', _random_chars(50))
DEBUG   = WEBAPP_CFG.get('JWT_SECRET', _random_chars(50))
JWT_SECRET     = WEBAPP_CFG.get('JWT_SECRET', _random_chars(50))
ADMIN_PASSWORD = WEBAPP_CFG.get('ADMIN_PASSWORD', _random_chars(10))
