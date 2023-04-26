
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import peewee

import korea_apartment_price
from korea_apartment_price.region_code import search, decode
from korea_apartment_price.webapp import models
from korea_apartment_price.webapp.deps import  get_current_real_user
from korea_apartment_price.webapp.types import BaseResponse

router = APIRouter(
    prefix="/region_code",
    tags=["Region code"],
    dependencies=[Depends(get_current_real_user)],
    responses={404: {"description": "Not found"}},
)

class RegionCodeEntry(BaseModel):
    lawaddrcode: str
    address: str
   
@router.get('/', response_model=BaseResponse[List[RegionCodeEntry]])
async def region_code_search(address: Optional[str]=None, code: Optional[str]=None):
    if address is not None:
        res = search(address)
        return BaseResponse(success=True, result=[RegionCodeEntry(**e) for e in res])
    if code is not None:
        res = decode(code)
        return BaseResponse(success=True, result=[RegionCodeEntry(**e) for e in res])
    raise HTTPException(code=403)

