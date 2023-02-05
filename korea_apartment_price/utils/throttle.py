import time
import datetime
from typing import Optional

class Throttler:
  def __init__(self, max_req_per_sec:float):
    self._min_interval = 1.0 / max_req_per_sec
    self._last: Optional[float] = None

  def throttle(self):
    now = datetime.datetime.now().timestamp()
    if self._last is None:
      self._last = now
      return
    diff = self._min_interval - now + self._last 
    self._last = now
    if diff > 0.0: time.sleep(diff)
    return
     