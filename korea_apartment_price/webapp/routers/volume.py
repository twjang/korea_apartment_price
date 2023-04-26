import datetime
from dateutil.relativedelta import relativedelta

from typing import Dict, List, Optional
from typing_extensions import TypedDict
from fastapi import APIRouter, Depends, HTTPException, Query
import korea_apartment_price
import korea_apartment_price.deposit_interest_rate
from korea_apartment_price.webapp.types import BaseResponse
from korea_apartment_price.webapp.deps import (
  get_current_user
)

router = APIRouter (
    prefix="/volume",
    tags=["Trading volume"],
    dependencies=[Depends(get_current_user)],
    responses={404: {"description": "Not found"}},
)


class VolumeQueryResp(TypedDict):
    dates: List[str]
    count: List[float]
    total_price: List[float]
    avg_price: List[float]


@router.get('/', response_model=BaseResponse[VolumeQueryResp])
async def get_data(
    addrcodes: List[str]=Query(default=[]),
    date_from: Optional[int]=None,
    date_to: Optional[int]=None,
    size_from: Optional[float]=None,
    size_to: Optional[float]=None,
    price_from: Optional[float]=None,
    price_to: Optional[float]=None,
):
    if addrcodes is None or len(addrcodes) == 0:
        raise HTTPException(status_code=403)

    addrcodes = list(set([int(c[:5]) for c in addrcodes if len(c[:5]) == 5]))
    col = korea_apartment_price.db.get_trades_collection()

    query = dict()
    query['addrcode_city'] = {'$in': addrcodes}
    if date_from or date_to:
        query['date_serial'] = {}
        if date_from:
            query['date_serial']['$gte'] = date_from
        if date_to:
            query['date_serial']['$lte'] = date_to

    if size_from or size_to:
        query['size'] = {}
        if date_from:
            query['size']['$gte'] = size_from
        if date_to:
            query['size']['$lte'] = size_to

    if price_from or price_to:
        query['price'] = {}
        if date_from:
            query['price']['$gte'] = price_from
        if date_to:
            query['price']['$lte'] = price_to

    cursor = col.aggregate([
        {
            '$match': query
        },
        {
            '$group': {
                '_id': '$date_serial',
                'cnt': { '$sum': 1 },
                'money': { '$sum': '$price' },
            }
        }
    ])

    hist_cnt: Dict[datetime.datetime, int] = {}
    hist_total_price: Dict[datetime.datetime, float] = {}
    hist_avg_price: Dict[datetime.datetime, float] = {}

    for e in cursor:
        year = int(e['_id'] / 10000)
        month = int(e['_id'] / 100) % 100
        date_val = int(e['_id']) % 100
        date = datetime.date(year, month, date_val)
        year, weekid, weekday = date.isocalendar()
        first_date = datetime.date(year, 1, 1) + relativedelta(weeks=+weekid)
        hist_cnt[first_date] = hist_cnt.get(first_date, 0) + e['cnt']
        hist_total_price[first_date] = hist_total_price.get(first_date, 0.0) + e['money']
    
    for d in hist_cnt:
        hist_avg_price[d] = hist_total_price[d] / hist_cnt[d]
    
    x = sorted(hist_cnt.keys())
    x_str = [d.strftime('%Y-%m-%d') for d in sorted(hist_cnt.keys())]
    y_cnt = [hist_cnt[v] for v in x]
    y_total_price = [hist_total_price[v] / 10000 for v in x]
    y_avg_price = [hist_avg_price[v] / 10000 for v in x]

    return BaseResponse(success=True, result={
        'dates': x_str,
        'count': y_cnt,
        'total_price': y_total_price,
        'avg_price': y_avg_price,
    })