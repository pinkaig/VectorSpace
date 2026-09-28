/**
 * @file        WhenDoRuleSection.tsx
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Inspector section for adding and removing click rules (change colour or play a sound) on the selected object
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import { useState } from 'react'
import type { InteractionRule } from '@vthere/project'
import { RuleRow } from '../interactions/RuleRow'
import { audioAssetCatalog } from '../audioAssets'
import type { ClickRuleChoice } from '../editor/ruleEditorOperations'

// the actions the "then" dropdown offers, the shared vocabulary list will replace this later
type ThenAction = 'changeColor' | 'playAudio'

// the first sound effect in the catalog, a sensible default for a click, falling back to any sound
const defaultSoundId = audioAssetCatalog.find((asset) => asset.defaultChannel === 'sfx')?.assetId ?? audioAssetCatalog[0]?.assetId ?? ''

// rules are this object's rules, onAdd gets the author's choice, onRemove gets a rule id
export function WhenDoRuleSection({ rules, onAdd, onRemove }: { rules: InteractionRule[]; onAdd: (choice: ClickRuleChoice) => void; onRemove: (ruleId: string) => void }) {
  // which action is picked in the "then" dropdown
  const [thenAction, setThenAction] = useState<ThenAction>('changeColor')
  // the picked colour and sound only live here until Add is pressed, they are not saved project data
  const [hex, setHex] = useState('#ff0000')
  const [soundId, setSoundId] = useState(defaultSoundId)
  // a plain sentence for the count, so it reads naturally for 0, 1, or many
  const countText = rules.length === 0 ? 'No interactions yet' : rules.length === 1 ? '1 interaction on this object' : `${rules.length} interactions on this object`
  // builds the choice for the picked action, turning the colour text like "#ff0000" into the number the colour action needs
  const add = () => {
    if (thenAction === 'changeColor') onAdd({ action: 'changeColor', color: parseInt(hex.slice(1), 16) })
    // a sound rule needs a sound, so do nothing if the catalog is empty
    else if (soundId) onAdd({ action: 'playAudio', assetId: soundId })
  }
  return (
    <div className="field-group">
      <span>Interactions</span>
      {/* the section reads top to bottom as one sentence: when the visitor clicks this object, then play a sound */}
      <label className="when-do-line">
        When the visitor
        <select defaultValue="click">
          <option value="click">clicks this object</option>
        </select>
      </label>
      <label className="when-do-line">
        then
        <select value={thenAction} onChange={(event) => setThenAction(event.target.value as ThenAction)}>
          <option value="changeColor">change its colour</option>
          <option value="playAudio">play a sound</option>
        </select>
      </label>
      {/* the setting underneath changes to match the picked action */}
      {thenAction === 'changeColor' ? (
        <label className="when-do-color">
          to
          <input type="color" value={hex} onChange={(event) => setHex(event.target.value)} />
        </label>
      ) : (
        <label className="when-do-line">
          sound
          <select value={soundId} onChange={(event) => setSoundId(event.target.value)}>
            {audioAssetCatalog.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.label}</option>)}
          </select>
        </label>
      )}
      <button className="button ghost when-do-add" onClick={add}>Add interaction</button>
      <small className="when-do-count">{countText}</small>
      {/* each existing rule as a sentence, numbered in the order it runs */}
      {rules.map((rule, index) => <RuleRow key={rule.id} rule={rule} position={index + 1} onRemove={() => onRemove(rule.id)} />)}
      {/* only worth explaining when there is more than one rule to put in order */}
      {rules.length > 1 && <small className="when-do-count">Runs in order, top to bottom</small>}
    </div>
  )
}