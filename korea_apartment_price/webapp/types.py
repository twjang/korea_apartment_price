from typing_extensions import TypedDict
from typing import Generic, Optional, TypeVar

from pydantic.generics import GenericModel


T = TypeVar('T')

class BaseResponse(GenericModel, Generic[T]):
  success: bool
  msg: Optional[str]
  result: Optional[T]
