"""Who am I — the first call the app makes after login."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..access import class_ids
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor

router = APIRouter(tags=["me"])


class MeResponse(BaseModel):
    id: uuid.UUID
    organisation_id: uuid.UUID
    display_name: str
    role: str
    class_ids: list[uuid.UUID]


@router.get("/me", response_model=MeResponse)
def me(actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)) -> MeResponse:
    answer = MeResponse(
        id=actor.id,
        organisation_id=actor.organisation_id,
        display_name=actor.display_name,
        role=actor.role,
        class_ids=class_ids(db, actor),
    )
    # the only place that knows a real person just arrived, so this is where "last active" comes from
    actor.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return answer
