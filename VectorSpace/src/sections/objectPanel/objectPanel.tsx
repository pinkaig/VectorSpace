/**
 * @file        objectPanel.tsx
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       Right-side panel for the selected object. Shows its name, a
 *              close button and three tabs that follow the first three editor
 *              steps: Position (step 1), Info (step 2) and Reactions (step 3).
 *              Holds no editor logic. EditorPage passes in the object, the
 *              current step and every action, and decides what each one does.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import { useState } from 'react'
import type { InteractionRule } from '@vectorspace/project'
import type { ClickRuleChoice } from '../../editor/ruleEditorOperations'
import { WhenDoRuleSection } from './WhenDoRuleSection'
import { InfoCardSection, type MediaChoice } from './InfoCardSection'
import type { CardInput } from '../../editor/cardEditorOperations'
import './objectPanel.css'

export type Vec3 = [number, number, number]

// the three handles the Move / Rotate / Size buttons switch between
export type ObjectPanelTool = 'move' | 'rotate' | 'scale'

// which row of the "Exact numbers" section changed
export type ObjectPanelField = 'position' | 'rotation' | 'scale'

// what the panel needs to show about the selected object; rotation is in degrees so
// the panel never converts anything, EditorPage does that
export type ObjectPanelItem = {
  id: string
  name: string
  kind: string
  position: Vec3
  rotation: Vec3
  scale: Vec3
}

export type ObjectPanelProps = {
  object: ObjectPanelItem | null
  // the editor step, shared with the top bar: Position = 1, Info = 2, Reactions = 3
  step: number
  onStepChange: (step: number) => void
  onClose: () => void
  // the handle showing in the 3D view, or null when none of the three is active
  tool: ObjectPanelTool | null
  onToolChange: (tool: ObjectPanelTool) => void
  // turn the object around its up axis by this many degrees (negative turns left)
  onRotateBy: (degrees: number) => void
  onExactChange: (field: ObjectPanelField, value: Vec3) => void
  snap: boolean
  onSnapChange: (snap: boolean) => void
  onCopy: () => void
  onRemove: () => void
  rules: InteractionRule[]
  onAddRule: (choice: ClickRuleChoice) => void
  onRemoveRule: (ruleId: string) => void
  // Info tab. Optional so a caller that has not connected cards yet still works; without
  // onSaveCard the tab shows placeholders. onSaveCard returns an error to show, or null.
  infoCard?: CardInput | null
  mediaChoices?: MediaChoice[]
  onSaveCard?: (input: CardInput) => string | null
  onRemoveCard?: () => void
}

const tabs = [
  { step: 1, label: 'Position' },
  { step: 2, label: 'Info' },
  { step: 3, label: 'Reactions' },
] as const

const tools: { tool: ObjectPanelTool; label: string; hint: string }[] = [
  { tool: 'move', label: 'Move', hint: 'Drag the arrows in the 3D view to move it' },
  { tool: 'rotate', label: 'Rotate', hint: 'Drag the rings in the 3D view to turn it' },
  { tool: 'scale', label: 'Size', hint: 'Drag the handles in the 3D view to resize it' },
]

const exactRows: { field: ObjectPanelField; label: string; step: number; digits: number }[] = [
  { field: 'position', label: 'Position', step: 0.1, digits: 2 },
  { field: 'rotation', label: 'Rotation °', step: 1, digits: 1 },
  { field: 'scale', label: 'Size', step: 0.1, digits: 2 },
]

export function ObjectPanel(props: ObjectPanelProps) {
  const { object, step, onStepChange, onClose } = props

  if (!object) {
    return (
      <section className="object-panel">
        <div className="object-panel-empty">
          <div className="object-panel-empty-mark">＋</div>
          <p>Select an object in the scene</p>
          <span>Its position, info and reactions will appear here.</span>
        </div>
      </section>
    )
  }

  // steps past 3 have no tab of their own, so the panel falls back to Position
  const activeStep = step === 2 || step === 3 ? step : 1

  return (
    <section className="object-panel" aria-label={`${object.name} settings`}>
      <header className="object-panel-header">
        <span className={`object-panel-dot ${object.kind}`} />
        <div className="object-panel-title">
          <span className="object-panel-eyebrow">Selected</span>
          <h2 title={object.name}>{object.name}</h2>
        </div>
        <button className="object-panel-close" title="Close" aria-label="Close panel" onClick={onClose}>×</button>
      </header>

      <div className="object-panel-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.step}
            role="tab"
            aria-selected={activeStep === tab.step}
            className={activeStep === tab.step ? 'object-panel-tab active' : 'object-panel-tab'}
            onClick={() => onStepChange(tab.step)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="object-panel-body" role="tabpanel">
        {activeStep === 1 && <PositionTab {...props} object={object} />}
        {activeStep === 2 && (props.onSaveCard
          // keyed by object, so switching objects starts from that object's card, not the last draft
          ? <InfoCardSection key={object.id} card={props.infoCard ?? null} mediaChoices={props.mediaChoices ?? []} onSave={props.onSaveCard} onRemove={props.onRemoveCard ?? (() => undefined)} />
          : <InfoTab />)}
        {activeStep === 3 && <ReactionsTab {...props} />}
      </div>
    </section>
  )
}

function PositionTab({ object, tool, onToolChange, onRotateBy, onExactChange, snap, onSnapChange, onCopy, onRemove }: ObjectPanelProps & { object: ObjectPanelItem }) {
  // open or closed is only how the panel looks, not editor data, so it can live here
  const [exactOpen, setExactOpen] = useState(false)
  const activeHint = tools.find((item) => item.tool === tool)?.hint ?? 'Pick a tool, then drag in the 3D view'

  return (
    <>
      <div className="object-panel-box">
        <span className="object-panel-label">Tool</span>
        <div className="object-panel-segmented">
          {tools.map((item) => (
            <button
              key={item.tool}
              aria-pressed={tool === item.tool}
              className={tool === item.tool ? 'object-panel-segment active' : 'object-panel-segment'}
              onClick={() => onToolChange(item.tool)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <small className="object-panel-hint">{activeHint}</small>
      </div>

      <div className="object-panel-box">
        <span className="object-panel-label">Turn</span>
        <div className="object-panel-row">
          <button className="object-panel-button" onClick={() => onRotateBy(-45)} title="Turn left by 45°">↺ 45°</button>
          <button className="object-panel-button" onClick={() => onRotateBy(45)} title="Turn right by 45°">↻ 45°</button>
        </div>
      </div>

      <div className="object-panel-box object-panel-switch-row">
        <div>
          <span className="object-panel-label">Snap to grid</span>
          <small className="object-panel-hint">{snap ? 'Moves land on whole steps' : 'Moves are free'}</small>
        </div>
        <button
          role="switch"
          aria-checked={snap}
          aria-label="Snap to grid"
          className={snap ? 'object-panel-switch on' : 'object-panel-switch'}
          onClick={() => onSnapChange(!snap)}
        >
          <span />
        </button>
      </div>

      <div className="object-panel-box">
        <button className="object-panel-disclosure" aria-expanded={exactOpen} onClick={() => setExactOpen((open) => !open)}>
          <span className="object-panel-label">Exact numbers</span>
          <span className="object-panel-chevron">{exactOpen ? '▾' : '▸'}</span>
        </button>
        {exactOpen && exactRows.map((row) => (
          <div className="object-panel-vector" key={row.field}>
            <span className="object-panel-vector-label">{row.label}</span>
            <div className="object-panel-vector-fields">
              {object[row.field].map((value, index) => (
                <label className="object-panel-number" key={index}>
                  <span>{['X', 'Y', 'Z'][index]}</span>
                  <input
                    type="number"
                    step={row.step}
                    value={Number(value.toFixed(row.digits))}
                    onChange={(event) => {
                      const entered = event.target.valueAsNumber
                      // a half-typed number like "-" is NaN, so wait for the rest instead of sending 0
                      if (Number.isNaN(entered)) return
                      const next = [...object[row.field]] as Vec3
                      next[index] = entered
                      onExactChange(row.field, next)
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="object-panel-row object-panel-actions">
        <button className="object-panel-button" onClick={onCopy}>Copy</button>
        <button className="object-panel-button danger" onClick={onRemove}>Remove</button>
      </div>
    </>
  )
}

// shown until EditorPage connects onSaveCard
function InfoTab() {
  return (
    <>
      <div className="object-panel-box">
        <span className="object-panel-label">Label</span>
        <div className="object-panel-placeholder">Coming soon</div>
      </div>
      <div className="object-panel-box">
        <span className="object-panel-label">Description</span>
        <div className="object-panel-placeholder tall">Coming soon</div>
      </div>
      <div className="object-panel-box">
        <span className="object-panel-label">Media</span>
        <div className="object-panel-placeholder">Coming soon</div>
      </div>
    </>
  )
}

// each rule shows as a card (RuleRow) under the When / Do builder
function ReactionsTab({ rules, onAddRule, onRemoveRule }: ObjectPanelProps) {
  return (
    <div className="object-panel-box object-panel-reactions">
      <WhenDoRuleSection rules={rules} onAdd={onAddRule} onRemove={onRemoveRule} />
    </div>
  )
}
