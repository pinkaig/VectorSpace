"""SQLAlchemy models — schema only, no repository/service logic.

Column shapes and constraints are final; relationships are declared for
query convenience. Business rules (validation, versioning semantics,
conflict resolution) belong in Stage 3+ service/repository layers.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Boolean,
    Index,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Organisation(Base):
    __tablename__ = "organisations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    actors: Mapped[list["Actor"]] = relationship(back_populates="organisation")
    projects: Mapped[list["Project"]] = relationship(back_populates="organisation")
    classes: Mapped[list["Classroom"]] = relationship(back_populates="organisation")

    __table_args__ = (UniqueConstraint("slug", name="uq_organisations_slug"),)


class Actor(Base):
    __tablename__ = "actors"

    id: Mapped[uuid.UUID] = _uuid_pk()
    organisation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )
    auth0_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="student")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # when this person last asked /me who they are; None means they have never signed in, which is
    # what the admin Accounts page shows as Invited
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    organisation: Mapped["Organisation"] = relationship(back_populates="actors")
    projects: Mapped[list["Project"]] = relationship(back_populates="created_by")
    analytics_events: Mapped[list["AnalyticsEvent"]] = relationship(back_populates="actor")

    __table_args__ = (
        UniqueConstraint("auth0_subject", name="uq_actors_auth0_subject"),
        UniqueConstraint("organisation_id", "email", name="uq_actors_org_email"),
        CheckConstraint("role in ('admin', 'teacher', 'student')", name="ck_actors_role"),
    )


class Classroom(Base):
    """A class within a school. Teachers and students are linked through ClassMember."""

    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = _uuid_pk()
    organisation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organisation: Mapped["Organisation"] = relationship(back_populates="classes")
    members: Mapped[list["ClassMember"]] = relationship(back_populates="classroom")

    __table_args__ = (UniqueConstraint("organisation_id", "name", name="uq_classes_org_name"),)


class ClassMember(Base):
    __tablename__ = "class_members"

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actors.id", ondelete="CASCADE"), primary_key=True
    )

    classroom: Mapped["Classroom"] = relationship(back_populates="members")
    actor: Mapped["Actor"] = relationship()


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = _uuid_pk()
    organisation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actors.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    # A template is a project with kind='template': read-only to students, copied into a
    # student project on "start from template". template_id/template_revision record the source.
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="project", server_default="project")
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    template_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_versions.id", ondelete="SET NULL", use_alter=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    organisation: Mapped["Organisation"] = relationship(back_populates="projects")
    created_by: Mapped["Actor"] = relationship(back_populates="projects")
    versions: Mapped[list["ProjectVersion"]] = relationship(
        back_populates="project", foreign_keys="ProjectVersion.project_id"
    )
    media_assets: Mapped[list["MediaAsset"]] = relationship(back_populates="project")
    interaction_rules: Mapped[list["InteractionRule"]] = relationship(back_populates="project")
    analytics_events: Mapped[list["AnalyticsEvent"]] = relationship(back_populates="project")

    __table_args__ = (
        UniqueConstraint("organisation_id", "slug", name="uq_projects_org_slug"),
        CheckConstraint("status in ('draft', 'published', 'archived')", name="ck_projects_status"),
        CheckConstraint("kind in ('project', 'template')", name="ck_projects_kind"),
    )


class ProjectVersion(Base):
    __tablename__ = "project_versions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actors.id", ondelete="RESTRICT"), nullable=False
    )
    content_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="versions", foreign_keys=[project_id])
    created_by: Mapped["Actor"] = relationship()
    content_snapshot: Mapped["ContentSnapshot | None"] = relationship(back_populates="project_version")

    __table_args__ = (UniqueConstraint("project_id", "revision", name="uq_project_versions_project_revision"),)


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = _uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actors.id", ondelete="RESTRICT"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(150), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship(back_populates="media_assets")
    uploaded_by: Mapped["Actor"] = relationship()

    __table_args__ = (
        UniqueConstraint("project_id", "storage_key", name="uq_media_assets_project_storage_key"),
        CheckConstraint("kind in ('model', 'image', 'audio', 'video', 'other')", name="ck_media_assets_kind"),
        CheckConstraint("status in ('pending', 'uploaded', 'failed')", name="ck_media_assets_status"),
        CheckConstraint("size_bytes >= 0", name="ck_media_assets_size_nonnegative"),
    )


class ContentSnapshot(Base):
    __tablename__ = "content_snapshots"

    id: Mapped[uuid.UUID] = _uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped["Project"] = relationship()
    project_version: Mapped["ProjectVersion | None"] = relationship(
        back_populates="content_snapshot", uselist=False
    )

    __table_args__ = (UniqueConstraint("project_id", "checksum", name="uq_content_snapshots_project_checksum"),)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[uuid.UUID] = _uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actors.id", ondelete="SET NULL"), nullable=True
    )
    session_id: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="analytics_events")
    actor: Mapped["Actor | None"] = relationship(back_populates="analytics_events")

    __table_args__ = (
        Index("ix_analytics_events_project_occurred_at", "project_id", "occurred_at"),
    )


class InteractionRule(Base):
    __tablename__ = "interaction_rules"

    id: Mapped[uuid.UUID] = _uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    object_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    zone_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    triggers: Mapped[list] = mapped_column(JSON, nullable=False)
    actions: Mapped[list] = mapped_column(JSON, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship(back_populates="interaction_rules")

    __table_args__ = (
        UniqueConstraint("project_id", "id", name="uq_interaction_rules_project_id_id"),
    )
