"""GET /permissions/mine: what the signed-in person's role may do in their own school.

The browser reads this to hide buttons that the API would refuse. It is not the rule: every
enforced setting is also checked by its route (app/permissions.py allowed()), which answers 403.
Admins edit the settings under /admin/schools/{school}/permissions (admin.py).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import permissions
from ..auth import get_current_actor
from ..db import get_db
from ..models import Actor

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("/mine", response_model=dict[str, bool])
def my_permissions(actor: Actor = Depends(get_current_actor), db: Session = Depends(get_db)) -> dict[str, bool]:
    """Every setting key, true when the caller may do it. An admin gets true for all of them."""
    return permissions.mine(db, actor)
