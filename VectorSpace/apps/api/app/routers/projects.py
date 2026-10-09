"""Project CRUD routes — skeleton handlers (real routing, no business logic)."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from ._skeleton import not_implemented

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreateRequest(BaseModel):
    organisation_id: uuid.UUID
    name: str
    slug: str


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    slug: str | None = None
    status: str | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    organisation_id: uuid.UUID
    name: str
    slug: str
    status: str
    current_version_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


@router.get("", response_model=list[ProjectResponse])
def list_projects() -> list[ProjectResponse]:
    raise not_implemented("list_projects is not implemented")


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(body: ProjectCreateRequest) -> ProjectResponse:
    raise not_implemented("create_project is not implemented")


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: uuid.UUID) -> ProjectResponse:
    raise not_implemented("get_project is not implemented")


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: uuid.UUID, body: ProjectUpdateRequest) -> ProjectResponse:
    raise not_implemented("update_project is not implemented")


@router.delete("/{project_id}", status_code=204, response_model=None)
def delete_project(project_id: uuid.UUID) -> None:
    raise not_implemented("delete_project is not implemented")
