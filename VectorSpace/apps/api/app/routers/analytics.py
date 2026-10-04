"""Analytics event routes — skeleton handlers (real routing, no business logic)."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from ._skeleton import not_implemented

router = APIRouter(prefix="/projects/{project_id}/analytics", tags=["analytics"])


class AnalyticsEventRequest(BaseModel):
    session_id: str
    event_type: str
    payload: dict | None = None
    occurred_at: datetime


class AnalyticsEventResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    actor_id: uuid.UUID | None
    session_id: str
    event_type: str
    payload: dict | None
    occurred_at: datetime
    created_at: datetime


@router.post("/events", response_model=AnalyticsEventResponse, status_code=201)
def record_event(project_id: uuid.UUID, body: AnalyticsEventRequest) -> AnalyticsEventResponse:
    raise not_implemented("record_event is not implemented")


@router.get("/events", response_model=list[AnalyticsEventResponse])
def list_events(project_id: uuid.UUID) -> list[AnalyticsEventResponse]:
    raise not_implemented("list_events is not implemented")


@router.get("/summary")
def get_summary(project_id: uuid.UUID) -> dict:
    raise not_implemented("get_summary is not implemented")
