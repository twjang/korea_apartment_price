from typing_extensions import TypedDict
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel


T = TypeVar('T')

class BaseResponse(BaseModel, Generic[T]):
  success: bool
  msg: Optional[str] = None
  result: Optional[T] = None
