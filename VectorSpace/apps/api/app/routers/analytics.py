"""Analytics event routes — skeleton handlers (real routing, no business logic)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..access import visible_projects
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor, AnalyticsEvent, Project
from ._skeleton import not_implemented

router = APIRouter(prefix="/projects/{project_id}/analytics", tags=["analytics"])


class AnalyticsEventRequest(BaseModel):
    session_id: str = Field(max_length=100)
    event_type: str = Field(max_length=100)
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


# ── Visits for the teacher's Results tab ──
# The visitor's page (routers/visit.py) records one "visit" event each time a published museum is
# opened by anyone but its owner. Clicks, time inside and rooms reached are not recorded yet.

results_router = APIRouter(prefix="/analytics", tags=["analytics"])


class MuseumVisits(BaseModel):
    project_id: uuid.UUID
    visits: int  # in the chosen range
    last_7_days: list[int]  # oldest day first, today last


def _utc(moment: datetime) -> datetime:
    # SQLite hands back naive datetimes; they were stored as UTC
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


@results_router.get("/visits", response_model=list[MuseumVisits])
def museum_visits(
    days: int | None = Query(default=None, ge=1, le=366),
    actor: Actor = Depends(get_current_actor),
    db: Session = Depends(get_db),
) -> list[MuseumVisits]:
    # Visit counts for the published museums this teacher can see, over the last `days` days (or all time).
    if actor.role == "student":
        raise HTTPException(status_code=403, detail="Only teachers can see results")
    readable = visible_projects(db, actor).where(Project.kind == "project", Project.status == "published")
    project_ids = select(readable.subquery().c.id)
    now = datetime.now(UTC)
    today = now.date()
    since = now - timedelta(days=max(days or 0, 7))
    query = select(AnalyticsEvent.project_id, AnalyticsEvent.occurred_at).where(
        AnalyticsEvent.project_id.in_(project_ids), AnalyticsEvent.event_type == "visit"
    )
    if days is not None:
        query = query.where(AnalyticsEvent.occurred_at >= since)
    range_start = now - timedelta(days=days) if days is not None else None
    rows: dict[uuid.UUID, MuseumVisits] = {}
    for project_id, occurred in db.execute(query):
        occurred = _utc(occurred)
        row = rows.setdefault(project_id, MuseumVisits(project_id=project_id, visits=0, last_7_days=[0] * 7))
        if range_start is None or occurred >= range_start:
            row.visits += 1
        back = (today - occurred.date()).days
        if 0 <= back < 7:
            row.last_7_days[6 - back] += 1
    return list(rows.values())
