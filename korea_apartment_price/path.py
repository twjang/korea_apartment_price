import os
__all__ = ['ROOT', 'DATA_ROOT', 'MISC_DATA_ROOT', 'CACHE_ROOT']

ROOT=os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
DATA_ROOT=os.path.join(ROOT, 'data')
MISC_DATA_ROOT=os.path.join(ROOT, 'data', 'misc')
TRADE_DATA_ROOT=os.path.join(ROOT, 'data', 'trades')
RENT_DATA_ROOT=os.path.join(ROOT, 'data', 'rents')
GPS_DATA_ROOT=os.path.join(ROOT, 'data', 'gps')
CACHE_ROOT=os.path.join(ROOT, 'data', 'cache')
SCRIPT_ROOT=os.path.join(ROOT, 'scripts')