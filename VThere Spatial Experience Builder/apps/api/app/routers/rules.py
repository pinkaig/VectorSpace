"""Interaction rule routes — skeleton handlers (real routing, no business logic)."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from ._skeleton import not_implemented

router = APIRouter(prefix="/projects/{project_id}/rules", tags=["rules"])


class InteractionRuleRequest(BaseModel):
    object_id: str | None = None
    zone_id: str | None = None
    triggers: list
    actions: list
    priority: int = 0


class InteractionRuleResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    object_id: str | None
    zone_id: str | None
    triggers: list
    actions: list
    priority: int
    created_at: datetime
    updated_at: datetime


@router.get("", response_model=list[InteractionRuleResponse])
def list_rules(project_id: uuid.UUID) -> list[InteractionRuleResponse]:
    raise not_implemented("list_rules is not implemented")


@router.post("", response_model=InteractionRuleResponse, status_code=201)
def create_rule(project_id: uuid.UUID, body: InteractionRuleRequest) -> InteractionRuleResponse:
    raise not_implemented("create_rule is not implemented")


@router.get("/{rule_id}", response_model=InteractionRuleResponse)
def get_rule(project_id: uuid.UUID, rule_id: uuid.UUID) -> InteractionRuleResponse:
    raise not_implemented("get_rule is not implemented")


@router.patch("/{rule_id}", response_model=InteractionRuleResponse)
def update_rule(project_id: uuid.UUID, rule_id: uuid.UUID, body: InteractionRuleRequest) -> InteractionRuleResponse:
    raise not_implemented("update_rule is not implemented")


@router.delete("/{rule_id}", status_code=204, response_model=None)
def delete_rule(project_id: uuid.UUID, rule_id: uuid.UUID) -> None:
    raise not_implemented("delete_rule is not implemented")
