/**
 * @file        objectPanel.tsx
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       Right-side panel for the selected object, laid out like the V3
 *              prototype (VectorSpace-V3.03_Demo.html): a header with the
 *              object's icon, name and close button, then three tabs that follow
 *              the first three editor steps: Position (step 1), Info (step 2)
 *              and Reactions (step 3).
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
import type { CardInput } from '../../editor/cardEditorOperations'
import type { CardTask } from '../../project/model'
import { InfoCardSection, type MediaChoice } from './InfoCardSection'
export type { MediaChoice } from './InfoCardSection'
import { ReactionsSection } from './ReactionsSection'
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
  // locked by the teacher: no moving, turning, resizing or removing, only copying (the Info
  // and Reactions tabs still work). Absent = not locked.
  locked?: boolean
  rules: InteractionRule[]
  onAddRule: (choice: ClickRuleChoice) => void
  onRemoveRule: (ruleId: string) => void
  // Info tab. All optional, so a caller that has not connected them yet still works.
  // onSaveCard and onSaveVideo return an error to show, or null when saved.
  infoCard?: CardInput | null
  infoCardId?: string            // the card's attachment id, so a reaction can show it
  cardTasks?: CardTask[]         // info cards the teacher's mission brief asks students to complete
  mediaChoices?: MediaChoice[]
  onUploadMedia?: (file: File) => Promise<MediaChoice | { error: string }>
  onAddMediaLink?: (url: string) => MediaChoice | { error: string }
  onSaveCard?: (input: CardInput) => string | null
  onRemoveCard?: () => void
  video?: { attachmentId?: string; assetId: string; label: string; screen?: boolean } | null
  onSaveVideo?: (assetId: string, screen: boolean) => string | null
  onRemoveVideo?: () => void
}

const tabs = [
  { step: 1, label: 'Position' },
  { step: 2, label: 'Info' },
  { step: 3, label: 'Reactions' },
] as const

const tools: { tool: ObjectPanelTool; label: string; hint: string }[] = [
  { tool: 'move', label: 'Move', hint: 'Drag the coloured arrows. The yellow square slides it along the floor.' },
  { tool: 'rotate', label: 'Rotate', hint: 'Drag the green ring to spin it around.' },
  { tool: 'scale', label: 'Size', hint: 'Drag a white corner to make it bigger or smaller.' },
]

// X, Y and Z keep the colours of the 3D view's axes: red, green, blue
const exactRows: { field: ObjectPanelField; label: string; step: number; digits: number }[] = [
  { field: 'position', label: 'Position', step: 0.1, digits: 2 },
  { field: 'rotation', label: 'Rotate', step: 1, digits: 1 },
  { field: 'scale', label: 'Size', step: 0.1, digits: 2 },
]
const axes = ['X', 'Y', 'Z'] as const

// the small word under the name; placed models are the museum's exhibits, primitives are shapes
const kindLabel = (kind: string) => (kind === 'model' ? 'Exhibit' : 'Shape')

export function ObjectPanel(props: ObjectPanelProps) {
  const { object, step, onStepChange, onClose } = props
  // after a first fact card is saved, its Reactions tab suggests what to add next (when the student
  // goes there); remembered per object, so another object's Reactions tab does not show it
  const [suggestFor, setSuggestFor] = useState<string | null>(null)

  if (!object) {
    return (
      <section className="object-panel">
        <div className="object-panel-empty">
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
        <div className="object-panel-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A3BC4" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
            <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
          </svg>
        </div>
        <div className="object-panel-title">
          <h2 title={object.name}>{object.name}</h2>
          <span>{kindLabel(object.kind)}</span>
        </div>
        <button className="object-panel-close" aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F1B3A" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
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

      {activeStep === 1 && <PositionTab {...props} object={object} />}
      {/* keyed by object, so switching objects starts from that object's card, not the last draft */}
      {activeStep === 2 && (
        <InfoCardSection
          key={object.id}
          card={props.infoCard ?? null}
          video={props.video ?? null}
          mediaChoices={props.mediaChoices ?? []}
          addMedia={{ upload: props.onUploadMedia, link: props.onAddMediaLink }}
          cardTasks={props.cardTasks ?? []}
          objectId={object.id}
          onSaveCard={props.onSaveCard}
          onRemoveCard={props.onRemoveCard}
          onSaveVideo={props.onSaveVideo}
          onRemoveVideo={props.onRemoveVideo}
          onGoToReactions={() => onStepChange(3)}
          onCardCreated={() => setSuggestFor(object.id)}
        />
      )}
      {activeStep === 3 && (
        <ReactionsSection
          key={object.id}
          rules={props.rules}
          cardId={props.infoCard ? props.infoCardId : undefined}
          videoId={props.video?.attachmentId}
          suggest={suggestFor === object.id}
          onDismissSuggest={() => setSuggestFor(null)}
          onAdd={props.onAddRule}
          onRemove={props.onRemoveRule}
        />
      )}
    </section>
  )
}

function PositionTab({ object, tool, onToolChange, onRotateBy, onExactChange, onCopy, onRemove, locked }: ObjectPanelProps & { object: ObjectPanelItem }) {
  // open or closed is only how the panel looks, not editor data, so it can live here
  const [exactOpen, setExactOpen] = useState(false)
  const activeHint = tools.find((item) => item.tool === tool)?.hint ?? 'Pick what to change, then drag in the 3D view.'

  // a locked thing: say so, and offer only a copy, which is the student's own to change
  if (locked) {
    return (
      <div className="object-panel-tab-body">
        <div className="object-panel-locked" role="note">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
          <div>
            <strong>Locked by your teacher</strong>
            <span>It stays where it is. Make a copy if you want one you can move.</span>
          </div>
        </div>
        <div className="object-panel-actions">
          <button className="object-panel-action" onClick={onCopy}>Copy</button>
        </div>
      </div>
    )
  }

  return (
    <div className="object-panel-tab-body">
      <div>
        <div className="object-panel-heading">What do you want to change?</div>
        <div className="object-panel-tools">
          {tools.map((item) => (
            <button
              key={item.tool}
              aria-pressed={tool === item.tool}
              className={tool === item.tool ? 'object-panel-seg active' : 'object-panel-seg'}
              onClick={() => onToolChange(item.tool)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="object-panel-hint">{activeHint}</div>
      </div>

      <div className="object-panel-turn-row">
        <button className="object-panel-turn" title="Rotate left 45°" aria-label="Rotate left 45 degrees" onClick={() => onRotateBy(-45)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4v6h6" />
            <path d="M20 15a8 8 0 01-14.9 2M4.5 10A8 8 0 0119 8" />
          </svg>
          45°
        </button>
        <button className="object-panel-turn" title="Rotate right 45°" aria-label="Rotate right 45 degrees" onClick={() => onRotateBy(45)}>
          45°
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 4v6h-6" />
            <path d="M4 15a8 8 0 0014.9 2M19.5 10A8 8 0 005 8" />
          </svg>
        </button>
      </div>

      <div className="object-panel-exact">
        <button className="object-panel-exact-toggle" aria-expanded={exactOpen} onClick={() => setExactOpen((open) => !open)}>
          Exact numbers
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E5878" strokeWidth="2.4" strokeLinecap="round">
            <path d={exactOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
        {exactOpen && (
          <div className="object-panel-exact-rows">
            {exactRows.map((row) => (
              <div className="object-panel-exact-row" key={row.field}>
                <div className="object-panel-exact-label">{row.label}</div>
                {object[row.field].map((value, index) => (
                  <input
                    key={index}
                    className={`object-panel-exact-input axis-${axes[index].toLowerCase()}`}
                    aria-label={`${row.label} ${axes[index]}`}
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
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="object-panel-actions">
        <button className="object-panel-action" onClick={onCopy}>Copy</button>
        <button className="object-panel-action danger" onClick={onRemove}>Remove</button>
      </div>
    </div>
  )
}
