import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from korea_apartment_price.webapp.routers import (
  account,
  fav,
  apartment
)

tags_metadata = [
  {
    "name": "Account",
    "description": "계정 관련 (로그인, 가입, 사용자 활성/비활성, 암호 변경 등)"
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
  openapi_tags=tags_metadata,
)

app.include_router(account.router, prefix='/api')
app.include_router(apartment.router, prefix='/api')
app.include_router(fav.router, prefix='/api')

STATIC_PATH=os.path.realpath(os.path.join(os.path.dirname(__file__), 'static'))
app.mount("/", StaticFiles(directory=STATIC_PATH), name="static")

