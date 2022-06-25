#!/usr/bin/env python3
import dateutil.parser


from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from pydantic import BaseModel

from korea_apartment_price.webapp import model
from korea_apartment_price.webapp.routers import (
  account,
  fav,
  apartment
)


tags_metadata = [
  {
    "name": "Token",
    "description": "인증 토큰 관련"
  },
  {
    "name": "Account",
    "description": "계정 관련 (가입, 사용자 활성/비활성, 암호 변경 등)"
  },
  {
    "name": "Apartment",
    "description": "아파트 정보 조회 (매매, 임대차, 호가 내역 등)"
  },
  {
    "name": "Favorite",
    "description": "아파트 즐겨찾기 정보"
  },
]

app = FastAPI(
  title='한국 아파트 가격 분석',
  openapi_tags=tags_metadata
)

app.include_router(account.router)
app.include_router(apartment.router)
app.include_router(fav.router)


@app.get("/")
async def root():
  return 'OK'

class Token(BaseModel):
  access_token: str
  token_type: str


@app.post("/token", response_model=Token, tags=['Token'])
async def login_for_token(f: OAuth2PasswordRequestForm=Depends()):
  user = model.User.login(f.username, f.password)
  if not user:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="wrong credential",
        headers={"WWW-Authenticate": "Bearer"},
    )
  token = user.to_jwt()
  return {"access_token": token, "token_type": "bearer"}

