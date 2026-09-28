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
 * Larger system guide: docs/05-subsystems/project-serialization.md
 */
export {
  cloneProject,
  defaultAudioSettings,
  defaultCameraPose,
  defaultEnvironmentId,
  defaultProject,
  environmentLibrary,
  findEnvironment,
  makeObject,
  makeScene,
} from '../packages/project/src/index'
export type {
  ActionSpec,
  AssetKind,
  AudioAssetMeta,
  AudioSettings,
  CameraPose,
  ChannelId,
  EnvironmentDefinition,
  EnvironmentKind,
  InteractionRule,
  ProjectData,
  SceneData,
  SceneObject,
  TransformData,
  ZoneDefinition,
  ZoneShape,
} from '../packages/project/src/index'
