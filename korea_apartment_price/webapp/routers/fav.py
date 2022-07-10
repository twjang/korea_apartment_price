
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import peewee

import korea_apartment_price
from korea_apartment_price.db import ApartmentId
from korea_apartment_price.webapp import models
from korea_apartment_price.webapp.deps import  get_current_real_user
from korea_apartment_price.webapp.types import BaseResponse

router = APIRouter(
    prefix="/fav",
    tags=["Favorite"],
    dependencies=[Depends(get_current_real_user)],
    responses={404: {"description": "Not found"}},
)


class SimpleFavEntry(BaseModel):
  id: int
  name: str
  size: int

@router.get('/', response_model=BaseResponse[Any])
def fav_list(u: models.User = Depends(get_current_real_user)):
  fav = models.Favorite.list(u)
  return BaseResponse(success=True, result=fav)

class FavoriteAddReq(BaseModel):
  lawaddrcode: str
  address: str
  name: str
  size: int

@router.post('/', response_model=BaseResponse)
def fav_add(f: FavoriteAddReq, u: models.User = Depends(get_current_real_user)):
  is_valid = False
  try:
    apt_id: ApartmentId = {
      'address': f.address,
      'lawaddrcode': f.lawaddrcode,
      'name': f.name,
    }
    sizes = korea_apartment_price.db.query_sizes(
      apt_id=apt_id,
    )
    if f.size in sizes:
      is_valid = True
  except: pass

  if not is_valid:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, detail='invalid inputs')

  fav = models.Favorite(user=u, lawaddrcode=f.lawaddrcode, address=f.address, name=f.name, size=f.size)
  try:
    fav.save()
    return BaseResponse(success=True)
  except peewee.IntegrityError:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, detail='already exists')


class FavoriteDetail(BaseModel):
  id: int
  name: str
  lawaddrcode: str
  address: str
  size: int

@router.get('/{fid}', response_model=BaseResponse[FavoriteDetail])
def get_detail_of_favorite(fid:int, u: models.User = Depends(get_current_real_user)):
  try:
    fav = models.Favorite.get(id=fid)
  except models.Favorite.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  if fav.user.id != u.id:
    raise HTTPException(status.HTTP_404_NOT_FOUND)

  return BaseResponse(success=True, result=fav.__data__)


@router.delete('/{fid}')
def delete_favorite(fid:int, u: models.User = Depends(get_current_real_user)):
  try:
    fav = models.Favorite.get(id=fid)
    if fav.user.id != u.id:
      raise HTTPException(status.HTTP_404_NOT_FOUND)
    models.Favorite.delete_by_id(fid)
  except models.Favorite.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)

  return BaseResponse(success=True)
