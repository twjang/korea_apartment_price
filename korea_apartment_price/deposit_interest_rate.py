from typing import List, Optional
from korea_apartment_price.db import RowDepositInterestRate, query_deposit_interest_rate
from korea_apartment_price.region_code import RegionCode
from korea_apartment_price.utils import editdist


class RegionCodeToRatioRegion:
  def __init__(self):
    seoul_desc = """
    도심권: 종로, 중, 용산
    동북권: 성동, 광진, 동대문, 중랑, 성북, 강북, 도봉, 노원
    서북권: 은평, 서대문, 마포
    서남권: 양천, 강서, 구로, 금천, 영등포, 동작, 관악
    동남권: 서초, 강남, 송파, 강동
    """
    other_desc = """
    인천: 인천시
    광주: 광주시
    대구: 대구시
    세종: 세종시
    대전: 대전시
    울산: 울산시
    부산: 부산시
    제주: 제주도
    충북: 충청북도
    충남: 충청남도
    강원: 강원도
    전북: 전라북도
    전남: 전라남도
    경북: 경상북도
    경남: 경상남도
    경기: 경기도
    """
    addr_to_ratio_region = []

    for line in seoul_desc.splitlines():
      line = line.strip().replace(' ', '').replace('\t', '')
      if line == '': continue
      region_name, addrs = line.split(':', 1)
      region_name = region_name.strip()
      real_addrs = [f'서울시{e.strip()}구' for e in addrs.split(',')]
      for addr in real_addrs: 
        addr_to_ratio_region.append((addr, region_name))

    for line in other_desc.splitlines():
      line = line.strip().replace(' ', '').replace('\t', '')
      if line == '': continue
      region_name, addrs = line.split(':', 1)
      region_name = region_name.strip()
      real_addrs = [f'{e.strip()}' for e in addrs.split(',')]
      for addr in real_addrs: 
        addr_to_ratio_region.append((addr, region_name))
    addr_to_ratio_region.append(('', '전국')) # Fallback
    self._addr_to_ratio_region = addr_to_ratio_region
  
  def get(self, rc:RegionCode)->str:
    query_addr = rc['address'].replace('자치자치', '').replace('광역', '').replace(' ', '').replace('특별', '')
    best_val = None
    best_score = None
    for cand_key, cand_val in self._addr_to_ratio_region:
      crop_len = min(len(query_addr), len(cand_key))
      score = crop_len - 2 * editdist(query_addr[:crop_len], cand_key[:crop_len])
      if best_score is None or best_score <= score:
        best_score = score
        best_val = cand_val
    return best_val


_convert = RegionCodeToRatioRegion()

def query(rc: RegionCode, size: Optional[int]=None, start_ym:Optional[int]=None, end_ym: Optional[int]=None)->List[RowDepositInterestRate]:
  region = _convert.get(rc)
  return query_deposit_interest_rate(region, size=size, start_ym=start_ym, end_ym=end_ym)

