
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from korea_apartment_price.webapp import ADMIN_PASSWORD, model, BaseResponse
from korea_apartment_price.webapp.deps import (
  get_current_admin_user,
  get_current_user
)

router = APIRouter(
    prefix="/account",
    tags=["Account"],
    responses={404: {"description": "Not found"}},
)

class LoginForm(BaseModel):
  email: str
  password: str

@router.post("/register")
async def user_register(f: LoginForm)->BaseResponse:
  if len(f.password) < 8:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="password should be at least 8 chars long"
    )
  try:
    u = model.User.register(f.email, f.password)
  except Exception as e:
    print(e)
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="email already exists"
    )
  return {
    'status': 'ok'
  }

@router.get("/")
async def user_list(u: model.User = Depends(get_current_admin_user), pageidx:int=1, items_per_page: int=50):
  user_cnt = model.User.select().count()
  users = list(model.User.select().order_by(model.User.date_created).paginate(pageidx, items_per_page))
  return {
    'status': 'ok',
    'result':{
      'num_items': user_cnt,
      'pageidx': pageidx,
      'items_per_page': items_per_page,
      'users': [u.__data__ for u in users]
    }
  }

@router.get("/{user_id}")
async def user_detail(user_id: int, u: model.User = Depends(get_current_user)):
  try:
    tu = model.User.get(id=user_id)
  except model.User.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  if not (tu.id == u.id or u.is_admin): 
    raise HTTPException(status.HTTP_404_NOT_FOUND)

  uinfo = tu.__data__.copy()
  try:
    uinfo['settings'] = json.loads(tu.settings)
  except json.JSONDecodeError:
    uinfo['settings'] = {}

  return {
    'status': 'ok',
    'result': uinfo
  }

class AccountSetReq(BaseModel):
  is_active: Optional[bool]
  is_admin: Optional[bool]
  password: Optional[str]
  settings: Optional[str]


@router.post("/{user_id}/set")
async def user_set(user_id:int, req: AccountSetReq, u: model.User = Depends(get_current_user)):
  try:
    tu = model.User.get(id=user_id)
  except model.User.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  if not (tu.id == u.id or u.is_admin): 
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  
  if req.is_active is not None:
    tu.is_active = req.is_active
  if req.is_admin is not None:
    tu.is_admin = req.is_admin
  if req.password is not None:
    tu.pwhash = model.User.hash_password(tu.email, req.password)
  if req.settings is not None:
    tu.settings = req.settings
  tu.save()

  return {
    'status': 'ok',
  }
