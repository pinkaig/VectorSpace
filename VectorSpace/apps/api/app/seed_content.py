"""Demo projects and templates for the local seed: what the landing pages have to list.

Enough data to prove the logic flows, not enough to look like a real school. Every person gets
one project, so no list is empty and school scoping is visibly doing something; the depth lives
on the two logins the picker actually signs in as (dev|teacher and dev|student1), because those
are the only two a tester can reach without editing code. Making the whole school look busy is a
job for later, when the UI has settled enough to be worth shaping data around.

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
from .routers.projects import distinct_name

# the two seeded people the sign-in picker maps to, so whatever is interesting is reachable
# without signing in as dev|student17 (see src/session/session.tsx, devSubjectFor)
FOCUS_TEACHER = "teacher@demo.test"  # Ms Tan Hui Min, dev|teacher
FOCUS_STUDENT = "student1@demo.test"  # Aisyah Rahman, dev|student1

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

# the ordinary one-project-each rows cycle through these, so status filters have something to find
_ORDINARY_STATUSES = ("draft", "draft", "draft", "published", "archived")

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


def _add_revision(
    db: Session, project: Project, data: dict, when: datetime, label: str | None = None, author: Actor | None = None
) -> ProjectVersion:
    """One save. `author` is who saved it: the owner, unless a teacher sent the copy."""
    snapshot = ContentSnapshot(project_id=project.id, data=data, checksum=_checksum(data), created_at=when)
    db.add(snapshot)
    db.flush()
    revision = (db.get(ProjectVersion, project.current_version_id).revision + 1) if project.current_version_id else 1
    version = ProjectVersion(
        project_id=project.id, revision=revision,
        created_by_id=author.id if author is not None else project.created_by_id,
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


def _first_class(db: Session, actor: Actor) -> uuid.UUID | None:
    return db.scalar(select(ClassMember.class_id).where(ClassMember.actor_id == actor.id))


def _content_of(db: Session, template: Project) -> tuple[str, list[tuple[str, float, float]], int | None]:
    """The template's current environment, object positions and revision, to start a copy from."""
    source = db.get(ProjectVersion, template.current_version_id) if template.current_version_id else None
    if source is None:
        return "env-empty", [], None
    scene = source.content_snapshot.data["scenes"][0]
    shapes = [(o["assetKind"], o["transform"]["position"][0], o["transform"]["position"][2]) for o in scene["objects"]]
    return scene["environmentId"], shapes, source.revision


def _grow(
    db: Session, project: Project, environment: str, shapes: list[tuple[str, float, float]],
    saves: int, start: datetime, now: datetime, seed: str,
) -> None:
    """Save the project `saves` times, each save after the first adding one more shape."""
    rng = random.Random(seed)
    when = start
    for save in range(saves):
        if save:
            shapes = shapes + [(rng.choice(["cube", "sphere", "cylinder"]), rng.randint(-5, 5), rng.randint(-5, 5))]
        when += timedelta(hours=rng.randint(1, 30))
        _add_revision(db, project, scene_data(project.id, project.name, environment, shapes), min(when, now))


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
    """One project each: enough for every list to have rows and for scoping to be visible."""
    created = 0
    for i, person in enumerate(people):
        title, template = TITLES[i % len(TITLES)], templates[i % len(templates)]
        started = now - timedelta(days=20 + i)
        environment, shapes, revision = _content_of(db, template)
        project = _new_project(
            db, person, title,
            status=_ORDINARY_STATUSES[i % len(_ORDINARY_STATUSES)],
            class_id=_first_class(db, person),
            template_id=template.id, template_revision=revision,
            created_at=started,
        )
        if project is None:
            continue
        created += 1
        _grow(db, project, environment, shapes, 1 + i % 2, started, now, f"one-{person.email}")
    return created


# (owner, title, status, saves, days ago) for the two logins a tester can sign in as
_FOCUS_PLAN = [
    ("teacher", "Rainforest tour", "draft", 5, 12),
    ("teacher", "The water cycle", "published", 2, 30),
    ("teacher", "Volcano lab", "archived", 1, 55),
    ("student", "My first exhibition", "draft", 4, 9),
    ("student", "Ancient Rome", "published", 2, 25),
]


def seed_focus(db: Session, teacher: Actor, student: Actor, templates: list[Project], now: datetime) -> int:
    """The states a tester needs, all on dev|teacher and dev|student1.

    Ms Tan gets a draft with a long history, a published project and an archived one. Aisyah gets
    her own draft and published project, plus two copies Ms Tan sent her: the first untouched, so
    "not edited yet" is on screen without anyone having to click, and the second proving a repeat
    copy is named "... (2)" instead of silently colliding.
    """
    created = 0
    owners = {"teacher": teacher, "student": student}
    for who, title, status, saves, days in _FOCUS_PLAN:
        owner = owners[who]
        template = templates[len(title) % len(templates)]
        started = now - timedelta(days=days)
        environment, shapes, revision = _content_of(db, template)
        project = _new_project(db, owner, title, status=status, class_id=_first_class(db, owner),
                               template_id=template.id, template_revision=revision, created_at=started)
        if project is None:
            continue
        created += 1
        _grow(db, project, environment, shapes, saves, started, now, f"focus-{owner.email}-{title}")

    # two copies of the same template, sent by the teacher: the second one has to be renamed
    sent_from = next((t for t in templates if t.name == "Gallery walk"), templates[0])
    shared = db.scalar(
        select(ClassMember.class_id)
        .where(ClassMember.actor_id == student.id)
        .where(ClassMember.class_id.in_(select(ClassMember.class_id).where(ClassMember.actor_id == teacher.id)))
    )
    environment, shapes, revision = _content_of(db, sent_from)
    # distinct_name would hand out "... (3)" on a second run, so the pair is made once or not at all
    already_sent = db.scalar(
        select(Project.id).where(
            Project.created_by_id == student.id, Project.kind == "project", Project.name == sent_from.name
        )
    )
    for days in () if already_sent else (4, 3):
        name = distinct_name(db, student.id, "project", sent_from.name)
        copy = _new_project(db, student, name, status="draft", class_id=shared, template_id=sent_from.id,
                            template_revision=revision, created_at=now - timedelta(days=days))
        if copy is None:
            continue
        created += 1
        # one revision, written by the teacher: this is "sent, not opened yet"
        _add_revision(db, copy, scene_data(copy.id, name, environment, shapes), now - timedelta(days=days),
                      label=f"Sent by {teacher.display_name}", author=teacher)
    return created


def seed_content(db: Session, teachers: list[Actor], students: list[Actor]) -> tuple[int, int]:
    """Templates, one project per person, then the focus states. Returns (templates, projects created)."""
    now = datetime.now(timezone.utc)
    templates = seed_templates(db, teachers, now)
    by_email = {a.email: a for a in teachers + students}
    teacher, student = by_email.get(FOCUS_TEACHER), by_email.get(FOCUS_STUDENT)
    focus = {a.email for a in (teacher, student) if a is not None}
    created = seed_projects(db, [p for p in teachers + students if p.email not in focus], templates, now)
    if teacher is not None and student is not None:
        created += seed_focus(db, teacher, student, templates, now)
    db.commit()
    return len(templates), created
