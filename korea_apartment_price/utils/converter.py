import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar, Union

__all__ = ['safe_convert', 'safe_int', 'safe_float', 'keyfilt', 'keyconvert']
T = TypeVar('T')

def safe_convert(val: Any, func: Callable[[Any], T], default: Optional[T]=None)->Optional[T]:
  res = default
  try: res = func(val)
  except: pass
  return res

def _datestr_to_dateserial(x: str)-> int:
  now = datetime.datetime.now()
  year = now.year
  x = x.split('.')
  if len(x) == 2:
    month = int(x[0])
    date = int(x[1])
  elif len(x) == 3:
    year = int(x[0])
    month = int(x[1])
    date = int(x[2])
    if 0 <= year and year < 30: year += 2000
    elif year < 99: year += 1900
  else: raise ValueError(f'unknown parse date string"({x})"')
  return year * 10000 + month * 100 + date

def safe_date_serial(val: Any, default:Optional[int]=None)->Optional[int]:
  return safe_convert(val, _datestr_to_dateserial, default)

def safe_int(val: Any, default: Optional[int]=None)-> Optional[int]:
  return safe_convert(val, int, default)

def safe_float(val: Any, default: Optional[float]=None)-> Optional[float]:
  return safe_convert(val, float, default)

def keyfilt(val: Dict[str, Any], mappings:List[
    Union[
      str, 
      Tuple[str, str],  # from_key, to_key
      Tuple[str, str, Callable[[Any], Any]] # from_key, to_key, conversion function
    ]
  ])->Dict[str, Any]:

  res = {}
  for m in mappings:
    if isinstance(m, str):
      res[m] = val.get(m, None)
    elif isinstance(m, tuple) and len(m) == 2:
      res[m[1]] = val.get(m[0], None)
    else:
      f = m[2]
      if m[0] in val:
        res[m[1]] = f(val[m[0]])
      else:
        res[m[1]] = f(None)
  return res


def keyconvert(val: Dict[str, Any], mappings: Dict[str, Callable[[Any], Any]])->Dict[str, Any]:
  res = {}
  for key in val:
    if key in mappings:
      res[key] = mappings[key](val[key])
    else:
      res[key] = val[key]
  return res
