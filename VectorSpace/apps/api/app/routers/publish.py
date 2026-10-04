"""Publish / versioning routes — skeleton handlers (real routing, no business logic)."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from ._skeleton import not_implemented

router = APIRouter(prefix="/projects/{project_id}/versions", tags=["publish"])


class PublishRequest(BaseModel):
    label: str | None = None


class ProjectVersionResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    revision: int
    label: str | None
    content_snapshot_id: uuid.UUID | None
    created_at: datetime


@router.get("", response_model=list[ProjectVersionResponse])
def list_versions(project_id: uuid.UUID) -> list[ProjectVersionResponse]:
    raise not_implemented("list_versions is not implemented")


@router.post("", response_model=ProjectVersionResponse, status_code=201)
def publish_version(project_id: uuid.UUID, body: PublishRequest) -> ProjectVersionResponse:
    raise not_implemented("publish_version is not implemented")


@router.get("/{version_id}", response_model=ProjectVersionResponse)
def get_version(project_id: uuid.UUID, version_id: uuid.UUID) -> ProjectVersionResponse:
    raise not_implemented("get_version is not implemented")


@router.post("/{version_id}/activate", response_model=ProjectVersionResponse)
def activate_version(project_id: uuid.UUID, version_id: uuid.UUID) -> ProjectVersionResponse:
    raise not_implemented("activate_version is not implemented")
