from typing import Any, Dict, Optional
from korea_apartment_price.path import DATA_ROOT
import os
import json

__all__ = ('get_cfg')

_path_cfg = os.path.join(DATA_ROOT, 'config.json')
if not os.path.exists(_path_cfg):
  raise RuntimeError(f'please create config file at: {_path_cfg}')

_cfg: Optional[Dict[str, Any]] = None

def get_cfg():
  global _cfg
  if _cfg is None:
    with open(_path_cfg, 'r') as f:
      _cfg = json.loads(f.read())
  return _cfg


