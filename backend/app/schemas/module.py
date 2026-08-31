from pydantic import BaseModel
from typing import List, Optional


class ModuleCreateRequest(BaseModel):
    title: str
    description: str = ""
    module_order: int
    objectives: List[str] = []
    key_takeaways: List[str] = []
    is_published: bool = False


class ModuleUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module_order: Optional[int] = None
    objectives: Optional[List[str]] = None
    key_takeaways: Optional[List[str]] = None
    is_published: Optional[bool] = None


class ContentCreateRequest(BaseModel):
    content_type: str   # TEXT or VIDEO
    title: str = ""
    content: str
    content_order: int


class ContentUpdateRequest(BaseModel):
    content_type: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    content_order: Optional[int] = None
