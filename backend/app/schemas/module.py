from pydantic import BaseModel
from typing import Optional


class ModuleCreateRequest(BaseModel):
    title: str
    description: str
    module_order: int


class ModuleUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module_order: Optional[int] = None


class ContentCreateRequest(BaseModel):
    content_type: str   # TEXT or VIDEO
    content: str
    content_order: int


class ContentUpdateRequest(BaseModel):
    content_type: Optional[str] = None
    content: Optional[str] = None
    content_order: Optional[int] = None
