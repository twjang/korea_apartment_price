
import json
from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from korea_apartment_price.webapp import ADMIN_PASSWORD, models
from korea_apartment_price.webapp.types import BaseResponse
from korea_apartment_price.webapp.deps import (
  get_current_admin_user,
  get_current_user
)

router = APIRouter(
    prefix="/account",
    tags=["Account"],
    responses={404: {"description": "Not found"}},
)

class Token(BaseModel):
  access_token: str
  token_type: str


@router.post("/token", response_model=Token)
async def login(f: OAuth2PasswordRequestForm=Depends()):
  user = models.User.login(f.username, f.password)
  if not user:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="wrong credential",
        headers={"WWW-Authenticate": "Bearer"},
    )
  token = user.to_jwt()
  return Token(access_token=token, token_type='bearer')

@router.get("/token_refresh", response_model=Token)
async def token_refresh(u: models.User = Depends(get_current_user)):
  token = u.to_jwt()
  return Token(access_token=token, token_type='bearer')


class AccountInfo(BaseModel):
  id: int
  email: str
  is_admin: bool
  date_created: str
  settings: Dict[str, Any]

@router.get("/me", response_model=BaseResponse[AccountInfo])
async def get_my_info(u: models.User = Depends(get_current_user)):
  u = models.User.get(id=u.id)
  uinfo = {k: v for k, v in u.__data__.items() if k in ['id', 'email', 'is_admin', 'date_created', 'settings']}
  uinfo['date_created'] = uinfo['date_created'].isoformat()
  try:
    uinfo['settings'] = json.loads(uinfo['settings'])
  except json.JSONDecodeError:
    uinfo['settings'] = {}
  return BaseResponse[AccountInfo](success=True, result=uinfo)


class RegisterForm(BaseModel):
  email: str
  password: str

@router.post("/register", response_model=BaseResponse[dict])
async def user_register(f: RegisterForm):
  if len(f.password) < 8:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="password should be at least 8 chars long"
    )
  try:
    u = models.User.register(f.email, f.password)
  except Exception as e:
    print(e)
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="email already exists"
    )
  return BaseResponse(success=True)

class UserInfo(BaseModel):
  id: int
  email: str
  is_active: bool
  is_admin: bool
  date_created: str
  settings: Dict[str, Any]

class UserList(BaseModel):
  num_items: int
  pageidx: int
  items_per_page: int
  users: List[UserInfo]


@router.get("/", response_model=BaseResponse[UserList])
async def user_list(u: models.User = Depends(get_current_admin_user), pageidx:int=1, items_per_page: int=50):
  user_cnt = models.User.select().count()
  users = list(models.User.select().order_by(models.User.date_created).paginate(pageidx, items_per_page))
  users_converted = []
  for u in users:
    uinfo = u.__data__.copy()
    uinfo['date_created'] = uinfo['date_created'].isoformat()
    try:
      uinfo['settings'] = json.loads(uinfo['settings'])
    except json.JSONDecodeError:
      uinfo['settings'] = {}
    users_converted.append(uinfo)

  return BaseResponse(success=True, result={
    'num_items': user_cnt,
    'pageidx': pageidx,
    'items_per_page': items_per_page,
    'users': users_converted
  })

@router.get("/{user_id}", response_model=BaseResponse[UserInfo])
async def user_detail(user_id: int, u: models.User = Depends(get_current_user)):
  try:
    tu = models.User.get(id=user_id)
  except models.User.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  if not (tu.id == u.id or u.is_admin):
    raise HTTPException(status.HTTP_404_NOT_FOUND)

  uinfo = tu.__data__.copy()
  uinfo['date_created'] = uinfo['date_created'].isoformat()
  try:
    uinfo['settings'] = json.loads(uinfo['settings'])
  except json.JSONDecodeError:
    uinfo['settings'] = {}

  return BaseResponse(success=True, result=uinfo)


class AccountSetReq(BaseModel):
  is_active: Optional[bool]
  is_admin: Optional[bool]
  password: Optional[str]
  settings: Optional[str]


@router.post("/{user_id}", response_model=BaseResponse[dict])
async def user_set(user_id:int, req: AccountSetReq, u: models.User = Depends(get_current_user)):
  try:
    tu = models.User.get(id=user_id)
  except models.User.DoesNotExist:
    raise HTTPException(status.HTTP_404_NOT_FOUND)
  if not (tu.id == u.id or u.is_admin):
    raise HTTPException(status.HTTP_404_NOT_FOUND)

  if req.is_active is not None:
    tu.is_active = req.is_active
  if req.is_admin is not None:
    tu.is_admin = req.is_admin
  if req.password is not None:
    tu.pwhash = models.User.hash_password(tu.email, req.password)
  if req.settings is not None:
    try:
      parsed = json.loads(req.settings)
      tu.settings = json.dumps(parsed, ensure_ascii=False)
    except json.JSONDecodeError:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, detail='cannot parse settings. it should be a json string')
  tu.save()

  return BaseResponse(success=True)
