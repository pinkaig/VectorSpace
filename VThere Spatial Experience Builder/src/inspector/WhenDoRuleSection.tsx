/**
 * @file        WhenDoRuleSection.tsx
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Inspector section for adding and removing WHEN Click, DO Change colour rules on the selected object
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import { useState } from 'react'
import type { InteractionRule } from '@vthere/project'
import { RuleRow } from '../interactions/RuleRow'

// rules are this object's rules, onAdd gets the picked colour as text like "#ff0000", onRemove gets a rule id
export function WhenDoRuleSection({ rules, onAdd, onRemove }: { rules: InteractionRule[]; onAdd: (hex: string) => void; onRemove: (ruleId: string) => void }) {
  // the picked colour only lives here until Add is pressed, it is not saved project data
  const [hex, setHex] = useState('#ff0000')
  // a plain sentence for the count, so it reads naturally for 0, 1, or many
  const countText = rules.length === 0 ? 'No interactions yet' : rules.length === 1 ? '1 interaction on this object' : `${rules.length} interactions on this object`
  return (
    <div className="field-group">
      <span>Interactions</span>
      {/* the section reads top to bottom as one sentence: when the visitor clicks this object, then change its colour to red */}
      {/* only one choice each for now, the shared vocabulary list will fill these dropdowns later */}
      <label className="when-do-line">
        When the visitor
        <select defaultValue="click">
          <option value="click">clicks this object</option>
        </select>
      </label>
      <label className="when-do-line">
        then
        <select defaultValue="changeColor">
          <option value="changeColor">change its colour</option>
        </select>
      </label>
      {/* this setting belongs to Change colour, other actions will show their own setting here later */}
      <label className="when-do-color">
        to
        <input type="color" value={hex} onChange={(event) => setHex(event.target.value)} />
      </label>
      <button className="button ghost when-do-add" onClick={() => onAdd(hex)}>Add interaction</button>
      <small className="when-do-count">{countText}</small>
      {/* each existing rule as a sentence, numbered in the order it runs */}
      {rules.map((rule, index) => <RuleRow key={rule.id} rule={rule} position={index + 1} onRemove={() => onRemove(rule.id)} />)}
      {/* only worth explaining when there is more than one rule to put in order */}
      {rules.length > 1 && <small className="when-do-count">Runs in order, top to bottom</small>}
    </div>
  )
}