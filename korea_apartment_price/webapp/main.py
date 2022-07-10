import json
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.exceptions import RequestValidationError

from starlette.exceptions import HTTPException as StarletteHTTPException

from korea_apartment_price.webapp import DEBUG
from korea_apartment_price.webapp.types import BaseResponse


app = FastAPI()

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
  res = BaseResponse(success=False, msg=exc.detail) 
  return PlainTextResponse(json.dumps(res, ensure_ascii=False), status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
  res = BaseResponse(success=False, msg=str(exc)) 
  return PlainTextResponse(json.dumps(res, ensure_ascii=False), status_code=400)


if DEBUG:
  app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
  )


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

