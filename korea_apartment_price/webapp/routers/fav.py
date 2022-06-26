
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import korea_apartment_price
from korea_apartment_price.db import ApartmentId
from korea_apartment_price.webapp import models
from korea_apartment_price.webapp.deps import  get_current_real_user

router = APIRouter(
    prefix="/fav",
    tags=["Favorite"],
    dependencies=[Depends(get_current_real_user)],
    responses={404: {"description": "Not found"}},
)

@router.get('/')
def fav_list(u: models.User = Depends(get_current_real_user)):
  fav = models.Favorite.list(u)
  return {
    'status': 'ok',
    'result': fav
  }

class FavoriteAddReq(BaseModel):
  lawaddrcode: str
  address: str
  name: str
  size: int

@router.post('/')
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
  fav.save()
  return {
    'status': 'ok'
  }

@router.get('/{fid}')
def get_detail_of_favorite(fid:int, u: models.User = Depends(get_current_real_user)):
  try:
    fav = models.Favorite.get(id=fid)
  except models.Favorite.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  if fav.user.id != u.id:
    raise HTTPException(status.HTTP_404_NOT_FOUND)

  return {
    'status': 'ok',
    'result': fav.__data__
  }

@router.delete('/{fid}')
def delete_favorite(fid:int, u: models.User = Depends(get_current_real_user)):
  try:
    fav = models.Favorite.get(id=fid)
  except models.Favorite.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  if fav.user.id != u.id:
    raise HTTPException(status.HTTP_404_NOT_FOUND)

  fav.delete()
  return {
    'status': 'ok'
  }
