"""Demo projects and templates for the local seed: what the landing pages have to list.

The scenes are tiny but real (the same shape the editor saves), so a seeded project opens in the
editor. Everything is derived from a fixed random seed, so every teammate's database gets the same
people, titles, statuses and revision counts. Re-running adds nothing that already exists.
"""

from __future__ import annotations

import hashlib
import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Actor, ClassMember, ContentSnapshot, Project, ProjectVersion

# (title, environment, shapes as (kind, x, z)); published templates a student can start from
TEMPLATES = [
    ("Blank room", "env-empty", []),
    ("Gallery walk", "env-room-1", [("cube", x, -3) for x in (-4.5, -1.5, 1.5, 4.5)]),
    ("Solar system", "env-room-3", [("sphere", 0, 0), ("sphere", 3, 0), ("sphere", -4, 1), ("sphere", 2, -4)]),
    ("Quiz stations", "env-room-2", [("cylinder", x, z) for x, z in ((-3, -3), (3, -3), (-3, 3), (3, 3))]),
    ("Museum plinths", "env-room-4", [("cube", -3, 0), ("sphere", -3, -1), ("cube", 3, 0), ("cylinder", 3, -1)]),
    ("Story stage", "env-room-5", [("cube", 0, -4), ("cylinder", -3, 0), ("sphere", 3, 0)]),
]

TITLES = [
    "My first exhibition", "Rainforest tour", "Ancient Rome", "The water cycle", "Space station",
    "Volcano lab", "Ocean floor", "Local history walk", "Painting gallery", "Sound garden",
    "Maths maze", "Robot workshop", "Castle siege", "Dinosaur dig", "Weather station",
    "Poetry room", "Market day", "Pyramid mystery", "Cell tour", "Greenhouse",
]

_HEIGHT = {"cube": 0.55, "sphere": 0.65, "cylinder": 0.6}


def _scene_object(kind: str, index: int, x: float, z: float) -> dict:
    return {
        "id": f"{kind}-seed-{index}",
        "name": f"{kind.capitalize()} {index}",
        "assetId": f"primitive-{kind}",
        "assetKind": kind,
        "visible": True,
        "enabled": True,
        "transform": {"position": [x, _HEIGHT[kind], z], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    }


def scene_data(project_id: uuid.UUID, name: str, environment: str, shapes: list[tuple[str, float, float]]) -> dict:
    return {
        "schemaVersion": 1,
        "id": str(project_id),
        "name": name,
        "activeSceneId": "scene-1",
        "scenes": [
            {
                "id": "scene-1",
                "name": "Main",
                "objects": [_scene_object(kind, i + 1, x, z) for i, (kind, x, z) in enumerate(shapes)],
                "environmentId": environment,
                "startCamera": {"position": [7, 5.5, 8], "target": [0, 0.7, 0]},
            }
        ],
    }


def _checksum(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _add_revision(db: Session, project: Project, data: dict, when: datetime, label: str | None = None) -> ProjectVersion:
    snapshot = ContentSnapshot(project_id=project.id, data=data, checksum=_checksum(data), created_at=when)
    db.add(snapshot)
    db.flush()
    revision = (db.get(ProjectVersion, project.current_version_id).revision + 1) if project.current_version_id else 1
    version = ProjectVersion(
        project_id=project.id, revision=revision, created_by_id=project.created_by_id,
        content_snapshot_id=snapshot.id, label=label, created_at=when,
    )
    db.add(version)
    db.flush()
    # updated_at is set in the same statement so the column's automatic refresh does not overwrite it
    project.current_version_id, project.updated_at = version.id, when
    db.flush()
    return version


def _new_project(db: Session, actor: Actor, name: str, **fields) -> Project | None:
    """None when this person already has a project of that name, which is what makes re-running safe."""
    if db.scalar(select(Project.id).where(Project.organisation_id == actor.organisation_id,
                                          Project.created_by_id == actor.id, Project.name == name)):
        return None
    project = Project(organisation_id=actor.organisation_id, created_by_id=actor.id, name=name,
                      slug=f"{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:8]}", **fields)
    db.add(project)
    db.flush()
    return project


def seed_templates(db: Session, teachers: list[Actor], now: datetime) -> list[Project]:
    made = []
    for i, (title, environment, shapes) in enumerate(TEMPLATES):
        owner = teachers[i % len(teachers)]
        template = _new_project(db, owner, title, kind="template", status="published", created_at=now - timedelta(days=90 - i))
        if template is None:  # already seeded
            template = db.scalar(select(Project).where(Project.created_by_id == owner.id, Project.name == title))
        else:
            when = now - timedelta(days=80 - i)
            _add_revision(db, template, scene_data(template.id, title, environment, shapes), when, "First version")
            if i % 2 == 1:  # every other template was improved once
                _add_revision(db, template, scene_data(template.id, title, environment, shapes + [("cube", 0, 4)]),
                              when + timedelta(days=2), "Added a plinth")
        made.append(template)
    return made


def seed_projects(db: Session, people: list[Actor], templates: list[Project], now: datetime) -> int:
    """Two to four projects per person, spread over the last 60 days; returns how many were created."""
    statuses = ["draft"] * 6 + ["published"] * 3 + ["archived"]
    created = 0
    for person in people:
        # one stream for the plan and one per project for its edits, so skipping a project that
        # already exists never shifts what the others get
        rng = random.Random(f"plan-{person.email}")
        class_ids = list(db.scalars(select(ClassMember.class_id).where(ClassMember.actor_id == person.id)))
        for title in rng.sample(TITLES, rng.randint(2, 4)):
            template = rng.choice(templates) if rng.random() < 0.6 else None
            status, age, edits = rng.choice(statuses), rng.randint(1, 60), rng.randint(1, 5)
            class_id = rng.choice(class_ids) if class_ids else None
            project = _new_project(db, person, title, status=status, class_id=class_id, created_at=now - timedelta(days=age))
            if project is None:
                continue
            created += 1
            environment, shapes = ("env-empty", [])
            if template is not None:
                source = db.get(ProjectVersion, template.current_version_id)
                project.template_id, project.template_revision = template.id, source.revision
                tdata = source.content_snapshot.data["scenes"][0]
                environment = tdata["environmentId"]
                shapes = [(o["assetKind"], o["transform"]["position"][0], o["transform"]["position"][2]) for o in tdata["objects"]]
            when, edits_rng = now - timedelta(days=age), random.Random(f"edits-{person.email}-{title}")
            for edit in range(edits):
                if edit:
                    shapes = shapes + [(edits_rng.choice(["cube", "sphere", "cylinder"]), edits_rng.randint(-5, 5), edits_rng.randint(-5, 5))]
                when += timedelta(hours=edits_rng.randint(1, 30))
                _add_revision(db, project, scene_data(project.id, title, environment, shapes), min(when, now))
    return created


def seed_content(db: Session, teachers: list[Actor], students: list[Actor]) -> tuple[int, int]:
    """Templates, then projects for every teacher and student. Returns (templates, projects created)."""
    now = datetime.now(timezone.utc)
    templates = seed_templates(db, teachers, now)
    created = seed_projects(db, teachers + students, templates, now)
    db.commit()
    return len(templates), created
