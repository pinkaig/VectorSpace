"""Media asset routes — skeleton handlers (real routing, no business logic).

Presigned URL generation itself (storage.py) is real infrastructure, but the
handlers that would call it and persist MediaAsset rows are not implemented.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from ._skeleton import not_implemented

router = APIRouter(prefix="/projects/{project_id}/media", tags=["media"])


class MediaUploadRequest(BaseModel):
    kind: str
    content_type: str
    size_bytes: int
    filename: str


class MediaUploadResponse(BaseModel):
    media_asset_id: uuid.UUID
    upload_url: str
    storage_key: str


class MediaAssetResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    kind: str
    storage_key: str
    content_type: str
    size_bytes: int
    status: str
    created_at: datetime
    updated_at: datetime


@router.get("", response_model=list[MediaAssetResponse])
def list_media(project_id: uuid.UUID) -> list[MediaAssetResponse]:
    raise not_implemented("list_media is not implemented")


@router.post("", response_model=MediaUploadResponse, status_code=201)
def request_media_upload(project_id: uuid.UUID, body: MediaUploadRequest) -> MediaUploadResponse:
    raise not_implemented("request_media_upload is not implemented")


@router.get("/{media_id}", response_model=MediaAssetResponse)
def get_media(project_id: uuid.UUID, media_id: uuid.UUID) -> MediaAssetResponse:
    raise not_implemented("get_media is not implemented")


@router.delete("/{media_id}", status_code=204, response_model=None)
def delete_media(project_id: uuid.UUID, media_id: uuid.UUID) -> None:
    raise not_implemented("delete_media is not implemented")
