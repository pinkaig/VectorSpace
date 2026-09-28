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
import { CHANGE_COLOR_KIND } from '../viewport/actions/changeColorActionBuilder'

// friendly words for triggers, anything not listed shows its raw name so no rule is hidden
const triggerText: Record<string, string> = { click: 'clicks' }

// friendly words for actions, the shared vocabulary list will replace these later
const actionText: Record<string, string> = { [CHANGE_COLOR_KIND]: 'change colour' }

// turns a saved colour number back into "#rrggbb" text, or null if the action has no colour
const colorHex = (action: ActionSpec): string | null => {
  const color = action.params?.color
  return typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : null
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
          return (
            <span key={index}>
              {index > 0 && ', '}
              {actionText[action.kind] ?? action.kind}
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