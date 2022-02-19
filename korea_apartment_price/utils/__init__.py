from korea_apartment_price.utils.finder import *
from korea_apartment_price.utils.converter import *
from korea_apartment_price.utils.downloader import *

import jamo
def editdist(a: str, b:str)->int:
  a2 = list(jamo.jamo_to_hcj(jamo.hangul_to_jamo(a)))
  b2 = list(jamo.jamo_to_hcj(jamo.hangul_to_jamo(b)))
  dist = list(range(len(b2)+1))

  for i in range(1, len(a2) + 1):
    new_dist = [i] * (len(b2) + 1)
    for j in range(1, len(b2) + 1):
      candidate = new_dist[j-1] + 1 
      candidate = min(candidate, dist[j] + 1)
      if a2[i-1] == b2[j-1]:
        candidate = min(candidate, dist[j-1])
      else:
        candidate = min(candidate, dist[j-1] + 1)
      new_dist[j] = candidate
    dist = new_dist
  return dist[-1]