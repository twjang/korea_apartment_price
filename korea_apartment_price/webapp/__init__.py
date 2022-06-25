import random
from typing import Any, Literal, Optional

from pydantic import BaseModel

from korea_apartment_price.config import get_cfg

def _random_chars(length:int, pool:str='1234567890abcdefghijklmnopqrstuvwxyz')->str:
  res = ''
  for _ in range(length):
    res += random.choice(pool)
  return res


DB_TYPE = get_cfg().get('WEBAPP', {}).get('DB_TYPE', 'sqlite')
DB_NAME = get_cfg().get('WEBAPP', {}).get('DB_NAME', './db.sqlite')
DB_ARGS = get_cfg().get('WEBAPP', {}).get('DB_ARGS', {})
SALT = get_cfg().get('WEBAPP', {}).get('ADMIN_PASSWORD', _random_chars(50))
ADMIN_PASSWORD = get_cfg().get('WEBAPP', {}).get('ADMIN_PASSWORD', _random_chars(10))
JWT_SECRET = get_cfg().get('WEBAPP', {}).get('JWT_SECRET', _random_chars(50))

class BaseResponse(BaseModel):
  status: Literal['ok', 'error']
  err: Optional[str]
  result: Optional[Any]
