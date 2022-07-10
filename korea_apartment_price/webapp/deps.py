from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer 

from korea_apartment_price.webapp import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/account/token")


class UnauthenticatedError(HTTPException):
  def __init__(self):
    super().__init__(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="could not validate credentials",
      headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_user(token: str = Depends(oauth2_scheme)):
  try:
    user = models.User.from_jwt(token)
  except:
    raise UnauthenticatedError()
  return user


async def get_current_real_user(token: str = Depends(oauth2_scheme)):
  try:
    user = models.User.from_jwt(token)
  except:
    raise UnauthenticatedError()
  if not user.is_real:
    raise UnauthenticatedError()

  return user


async def get_current_admin_user(token: str = Depends(oauth2_scheme)):
  try:
    user = models.User.from_jwt(token)
    if not user.is_admin:
      raise UnauthenticatedError()
  except:
    raise UnauthenticatedError()
  return user

