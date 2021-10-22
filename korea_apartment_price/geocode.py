from korea_apartment_price.db import RowTrade
from korea_apartment_price import db

from typing import Optional, Tuple


def search(trade: RowTrade)->Optional[Tuple[float, float]]:
  ent = db.query_geocode(trade)
  if ent is None: return None
  return ent['lat'], ent['lng']

