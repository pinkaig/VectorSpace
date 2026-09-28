/**
 * @file        RuleRow.tsx
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Shows one When-Do rule as a short sentence with a remove button
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import type { ActionSpec, InteractionRule } from '@vthere/project'
import { audioAssetCatalog } from '../audioAssets'
import { CHANGE_COLOR_KIND } from '../viewport/actions/changeColorActionBuilder'

// friendly words for triggers, anything not listed shows its raw name so no rule is hidden
const triggerText: Record<string, string> = {
  click: 'clicks',
  sceneStart: 'scene starts',
  zoneEnter: 'enters',
  zoneExit: 'leaves',
}

// friendly words for actions, the shared vocabulary list will replace these later
const actionText: Record<string, string> = {
  [CHANGE_COLOR_KIND]: 'change colour',
  playAudio: 'play',
  stopAudio: 'stop',
}

// turns a saved colour number back into "#rrggbb" text, or null if the action has no colour
const colorHex = (action: ActionSpec): string | null => {
  const color = action.params?.color
  return typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : null
}

// the sound's catalog name for audio actions, or its raw id if the catalog doesn't have it, or null if no sound
const soundLabel = (action: ActionSpec): string | null => {
  const assetId = action.params?.assetId
  if (typeof assetId !== 'string') return null
  return audioAssetCatalog.find((asset) => asset.assetId === assetId)?.label ?? assetId
}

// rule is the rule to show, position is its place in the run order starting at 1, onRemove is called when the remove button is pressed
export function RuleRow({ rule, position, onRemove }: { rule: InteractionRule; position: number; onRemove: () => void }) {
  return (
    <div className="rule-row">
      {/* the number shows the order rules run in, so authors can predict which one wins */}
      <span className="rule-number">{position}.</span>
      <span className="rule-text">
        {rule.triggers.map((trigger) => triggerText[trigger] ?? trigger).join(' or ')}
        {' → '}
        {rule.actions.map((action, index) => {
          const hex = action.kind === CHANGE_COLOR_KIND ? colorHex(action) : null
          const sound = soundLabel(action)
          return (
            <span key={index}>
              {index > 0 && ', '}
              {actionText[action.kind] ?? action.kind}
              {/* audio actions name the sound they play or stop */}
              {sound && ` ${sound}`}
              {/* a small square showing the colour this rule will apply */}
              {hex && <span className="rule-swatch" style={{ background: hex }} />}
            </span>
          )
        })}
      </span>
      <button className="rule-remove" title="Remove this interaction" onClick={onRemove}>×</button>
    </div>
  )
}