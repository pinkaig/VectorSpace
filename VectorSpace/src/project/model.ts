/**
 * @file        model.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Application-facing re-export boundary for the shared project model.
 *
 * @responsibility
 * Keeps source-level imports stable while the canonical project types and
 * factory functions live in packages/project.
 *
 * @inputs
 * Exports from ../packages/project/src/index.
 *
 * @outputs
 * AssetKind, ProjectData, SceneData, SceneObject, TransformData, cloneProject,
 * defaultProject, and makeObject for application consumers.
 *
 * @members
 * Re-export declarations only; this file does not own project state.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Project-Serialization
 * Links point at the project wiki; migration is still in progress.
 */
export {
  assetRefForAttachment,
  cloneProject,
  collectAttachments,
  defaultAudioSettings,
  defaultCameraPose,
  defaultEnvironmentId,
  defaultProject,
  emptyMissionBrief,
  environmentLibrary,
  findAttachment,
  findEnvironment,
  getAttachmentCapabilities,
  listAttachmentCapabilities,
  makeObject,
  makeScene,
} from '../../packages/project/src/index'
export type {
  ActionSpec,
  AssetKind,
  AssetRefKind,
  Attachment,
  AttachmentCapabilities,
  AttachmentCapabilityKey,
  AttachmentHostRef,
  AttachmentLocation,
  AudioAssetMeta,
  AudioAttachment,
  AudioSettings,
  CameraPose,
  CardField,
  CardMedia,
  ChannelId,
  EnvironmentDefinition,
  EnvironmentKind,
  ImageAttachment,
  InteractionRule,
  MediaKind,
  MissionBrief,
  MissionRule,
  MissionTodo,
  MediaViewProps,
  MediaViewState,
  ProjectData,
  RoomCell,
  RoomSurfaces,
  SceneData,
  SceneObject,
  TextAssetMeta,
  TextAttachment,
  TextFormat,
  TextPresentation,
  TextStyle,
  TransformData,
  VideoAttachment,
  ZoneDefinition,
  ZoneShape,
} from '../../packages/project/src/index'
