
from typing import Any, Callable, Optional, TypeVar

__all__ = ['safe_convert', 'safe_int', 'safe_float']
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
