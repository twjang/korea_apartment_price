
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar, Union

__all__ = ['safe_convert', 'safe_int', 'safe_float', 'keyfilt', 'keyconvert']
T = TypeVar('T')

def safe_convert(val: Any, func: Callable[[Any], T], default: Optional[T]=None)->Optional[T]:
  res = default
  try: res = func(val)
  except: pass
  return res

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
