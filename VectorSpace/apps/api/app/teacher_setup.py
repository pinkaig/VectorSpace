"""The teacher's setup of a template (suggested spots, locked things, starter objects), carried
into the copies students already have.

A student's copy is a snapshot of the template taken when it was sent, so setup the teacher does
afterwards never reached it. push_setup updates every copy of a template with the teacher's parts
only, and leaves the student's own work alone:

- the mission brief becomes the template's, so info cards the teacher set later reach the student;
- each room's suggested spots become the template room's spots;
- a thing locked in the template is put in the copy as the template has it (added back if the
  student's copy lacks it), keeping any fact card the student wrote on it;
- a thing locked in the copy that the teacher unlocked is unlocked; one the teacher removed from
  the template is removed, with its reactions.

Rooms and things are matched by id, which a copy keeps from its template. Things the student added
or that were never locked are never touched. A copy waiting for review, approved or published is
left as it is, so a teacher never changes work under review.
"""

from __future__ import annotations

import copy as copying
import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Actor, Assignment, ContentSnapshot, Project, ProjectVersion, Submission


def merge_setup(template: dict[str, Any], student: dict[str, Any]) -> dict[str, Any]:
    """The student's project with the template's spots and locked things carried in."""
    merged = copying.deepcopy(student)
    template_rooms = {room.get("id"): room for room in template.get("scenes") or []}
    removed: set[str] = set()

    if template.get("missionBrief"):
        merged["missionBrief"] = copying.deepcopy(template["missionBrief"])

    for room in merged.get("scenes") or []:
        source = template_rooms.get(room.get("id"))
        if source is None:
            continue  # a room the student added: nothing of the teacher's in it

        if source.get("spots"):
            room["spots"] = copying.deepcopy(source["spots"])
        else:
            room.pop("spots", None)

        teacher = {thing.get("id"): thing for thing in source.get("objects") or []}
        kept: list[dict[str, Any]] = []
        for thing in room.get("objects") or []:
            theirs = teacher.get(thing.get("id"))
            if thing.get("locked") and theirs is None:
                removed.add(thing["id"])  # the teacher took it out of the template
                continue
            if theirs is not None and theirs.get("locked"):
                updated = copying.deepcopy(theirs)
                # a fact card the student wrote on a locked thing is theirs to keep
                if thing.get("attachments"):
                    updated["attachments"] = thing["attachments"]
                thing = updated
            elif thing.get("locked"):
                thing = {key: value for key, value in thing.items() if key != "locked"}  # unlocked by the teacher
            kept.append(thing)

        present = {thing.get("id") for thing in kept}
        for thing in source.get("objects") or []:
            if thing.get("locked") and thing.get("id") not in present:
                kept.append(copying.deepcopy(thing))  # new from the teacher, or put back
                present.add(thing.get("id"))

        # nothing may hang off a thing that is gone
        for thing in kept:
            if thing.get("parentId") is not None and thing["parentId"] not in present:
                del thing["parentId"]
        room["objects"] = kept

    if removed and isinstance(merged.get("rules"), list):
        merged["rules"] = [rule for rule in merged["rules"] if rule.get("objectId") not in removed]
    return merged


def _checksum(data: dict[str, Any]) -> str:
    # the same as a save's checksum (routers/publish.py), so an unchanged copy is recognised
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _content(db: Session, project: Project) -> tuple[ProjectVersion | None, dict[str, Any] | None]:
    version = db.get(ProjectVersion, project.current_version_id) if project.current_version_id else None
    data = version.content_snapshot.data if version and version.content_snapshot else None
    return version, data


def _under_review(db: Session, project: Project) -> bool:
    if project.status == "published":
        return True
    latest = db.scalar(
        select(Submission).where(Submission.project_id == project.id).order_by(Submission.submitted_at.desc()).limit(1)
    )
    return latest is not None and latest.status in ("waiting", "approved")


def push_setup(db: Session, source: Project, teacher: Actor) -> tuple[int, int]:
    """Carries the source's setup into every student copy of it. Returns (updated, skipped)."""
    _, template = _content(db, source)
    if template is None:
        return 0, 0
    assignment_ids = select(Assignment.id).where(Assignment.project_id == source.id)
    copies = db.scalars(select(Project).where(Project.assignment_id.in_(assignment_ids), Project.id != source.id))

    updated = skipped = 0
    for student_copy in copies:
        latest, data = _content(db, student_copy)
        if data is None:
            continue
        merged = merge_setup(template, data)
        checksum = _checksum(merged)
        if latest and latest.content_snapshot and latest.content_snapshot.checksum == checksum:
            continue  # already up to date
        if _under_review(db, student_copy):
            skipped += 1
            continue
        snapshot = db.scalar(
            select(ContentSnapshot).where(ContentSnapshot.project_id == student_copy.id, ContentSnapshot.checksum == checksum)
        )
        if snapshot is None:
            snapshot = ContentSnapshot(project_id=student_copy.id, data=merged, checksum=checksum)
            db.add(snapshot)
            db.flush()
        version = ProjectVersion(
            id=uuid.uuid4(),
            project_id=student_copy.id,
            revision=(latest.revision if latest else 0) + 1,
            created_by_id=teacher.id,
            content_snapshot_id=snapshot.id,
            label=f"Setup updated by {teacher.display_name}",
        )
        db.add(version)
        db.flush()
        student_copy.current_version_id = version.id
        updated += 1
    db.commit()
    return updated, skipped
