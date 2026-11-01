/**
 * @file        ReactionsSection.tsx
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       The Reactions tab, laid out like the V3 prototype: each rule as a
 *              numbered "When … then …" card, a "No reactions yet" note, and an
 *              editor box with WHEN and THEN rows to add a new reaction.
 *
 * @responsibility
 * Shows rules and calls back; it builds nothing itself. A new reaction is a
 * ClickRuleChoice (change colour, play a sound, show a message, and, when the
 * object has them, show its info card or play its video), which EditorPage
 * adds through ruleEditorOperations.ts. The info card and video are referred
 * to by attachment id. Rules cannot be edited in place yet, so opening a card
 * offers Delete only. After a first fact card is saved, a box suggests what
 * to add next.
 *
 * @documentation
 * VectorSpace-V3.03_Demo.html, Reactions tab.
 */
/******************************************************************************/
import { useState } from 'react'
import type { ActionSpec, InteractionRule } from '@vectorspace/project'
import { audioAssetCatalog } from '../../content/audioAssets'
import { CHANGE_COLOR_KIND } from '../../viewport/actions/changeColorActionBuilder'
import { MAX_MESSAGE_LENGTH, type ClickRuleChoice } from '../../editor/ruleEditorOperations'

// the words a card uses; an unknown trigger or action shows its raw name, so no rule is hidden
const whenText: Record<string, string> = {
  click: 'someone clicks it',
  sceneStart: 'the room opens',
  zoneEnter: 'someone walks in',
  zoneExit: 'someone walks out',
}

const thenText = (action: ActionSpec): string => {
  if (action.kind === CHANGE_COLOR_KIND) return 'change its colour'
  if (action.kind === 'showPanel') return typeof action.params?.attachmentId === 'string' ? 'show its info card' : 'show a message'
  if (action.kind === 'playMedia') return 'play its video'
  if (action.kind === 'playAudio' || action.kind === 'stopAudio') {
    const assetId = action.params?.assetId
    const sound = typeof assetId === 'string' ? audioAssetCatalog.find((asset) => asset.assetId === assetId)?.label ?? assetId : null
    return `${action.kind === 'playAudio' ? 'play' : 'stop'} ${sound ?? 'a sound'}`
  }
  return action.kind
}

type ThenAction = ClickRuleChoice['action']
const baseChoices: { action: ThenAction; label: string }[] = [
  { action: 'changeColor', label: 'change its colour' },
  { action: 'playAudio', label: 'play a sound' },
  { action: 'showText', label: 'show a message' },
]
// only the settings that need a question; showing the card or playing the video needs none
const thenQuestion: Partial<Record<ThenAction, string>> = { changeColor: 'Which colour?', playAudio: 'Which sound?', showText: 'What message?' }

// the first sound effect in the catalog, a sensible default for a click, falling back to any sound
const defaultSoundId = audioAssetCatalog.find((asset) => asset.defaultChannel === 'sfx')?.assetId ?? audioAssetCatalog[0]?.assetId ?? ''

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
)
const Elbow = ({ stroke }: { stroke: string }) => (
  <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true"><path d="M3 0v13a4 4 0 004 4h6" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" /></svg>
)

function RuleCard({ rule, num, open, onToggle, onRemove }: { rule: InteractionRule; num: number; open: boolean; onToggle: () => void; onRemove: () => void }) {
  const when = rule.triggers.map((trigger) => whenText[trigger] ?? trigger).join(' or ')
  const then = rule.actions.map(thenText).join(', then ')
  return (
    <div className="react-card-wrap">
      <button className="react-card" aria-label={`Reaction ${num}: when ${when}, then ${then}`} aria-expanded={open} onClick={onToggle}>
        <span className="react-num">{num}</span>
        <span className="react-lines">
          <span className="react-line"><span className="react-word">When</span> <span className="react-when">{when}</span></span>
          <span className="react-line"><span className="react-word">then</span> <span className="react-then">{then}</span></span>
        </span>
        <span className="react-edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
          Edit
        </span>
      </button>
      {open && (
        <div className="react-card-tools">
          <span className="react-sub">Changing a saved reaction is coming. For now, delete it and add a new one.</span>
          <DeleteButton onClick={onRemove} />
        </div>
      )}
    </div>
  )
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="react-delete" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
      Delete
    </button>
  )
}

export function ReactionsSection({ rules, cardId, videoId, suggest, onDismissSuggest, onAdd, onRemove }: {
  rules: InteractionRule[]
  cardId?: string     // the object's info card attachment, if it has one
  videoId?: string    // the object's video attachment, if it has one
  suggest?: boolean   // a fact card was just made: suggest what to add next
  onDismissSuggest?: () => void
  onAdd: (choice: ClickRuleChoice) => void
  onRemove: (ruleId: string) => void
}) {
  const thenChoices = [
    ...(cardId ? [{ action: 'showCard' as const, label: 'show its info card' }] : []),
    ...(videoId ? [{ action: 'playVideo' as const, label: 'play its video' }] : []),
    ...baseChoices,
  ]
  const [editing, setEditing] = useState(false)
  const [openRuleId, setOpenRuleId] = useState<string | null>(null)
  const [then, setThen] = useState<ThenAction | null>(null)
  const [pickingThen, setPickingThen] = useState(false)
  const [hex, setHex] = useState('#ff0000')
  const [soundId, setSoundId] = useState(defaultSoundId)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  // a suggestion starts the editor with its THEN already picked
  const startNew = (preset?: ThenAction) => {
    setEditing(true)
    setOpenRuleId(null)
    setThen(preset ?? null)
    setPickingThen(!preset)
    setMessage('')
    setProblem(null)
    onDismissSuggest?.()
  }
  const close = () => { setEditing(false); setPickingThen(false); setProblem(null) }

  const done = () => {
    if (!then) return setProblem('Pick what happens')
    if (then === 'showCard' && cardId) onAdd({ action: 'showCard', attachmentId: cardId })
    else if (then === 'playVideo' && videoId) onAdd({ action: 'playVideo', attachmentId: videoId })
    else if (then === 'changeColor') onAdd({ action: 'changeColor', color: parseInt(hex.slice(1), 16) })
    else if (then === 'playAudio') {
      if (!soundId) return setProblem('There are no sounds to play yet')
      onAdd({ action: 'playAudio', assetId: soundId })
    } else {
      if (!message.trim()) return setProblem('Write the message visitors will see')
      onAdd({ action: 'showText', message: message.trim() })
    }
    close()
  }

  const chosen = thenChoices.find((choice) => choice.action === then)
  const num = rules.length + 1

  return (
    <div className="object-panel-tab-body react-list">
      {suggest && !editing && (
        <div className="react-suggest" role="status">
          <div className="react-suggest-head">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E9E6A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            <span><b>Fact card ready.</b> Visitors see it when they click this exhibit or reach it on a tour.</span>
          </div>
          <div className="react-suggest-label">Make it react too:</div>
          <div className="react-suggest-row">
            {videoId && <button className="react-suggest-chip" onClick={() => startNew('playVideo')}>Play its video</button>}
            <button className="react-suggest-chip" onClick={() => startNew('playAudio')}>Play a sound</button>
            <button className="react-suggest-chip" onClick={() => startNew('changeColor')}>Change its colour</button>
            <button className="react-suggest-chip" onClick={() => startNew('showText')}>Show a message</button>
          </div>
        </div>
      )}
      {rules.length === 0 && !editing && (
        <div className="react-empty">
          <b>No reactions yet.</b>{' '}
          {cardId
            ? 'Its fact card already shows when visitors click it or reach it on a tour. Add a reaction to do more.'
            : videoId
              ? 'Its video already opens when visitors click it or reach it on a tour. Add a reaction to do more.'
              : 'Visitors can look at this exhibit, but nothing happens when they click it or walk near.'}
        </div>
      )}

      {rules.map((rule, index) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          num={index + 1}
          open={openRuleId === rule.id}
          onToggle={() => setOpenRuleId((current) => (current === rule.id ? null : rule.id))}
          onRemove={() => { setOpenRuleId(null); onRemove(rule.id) }}
        />
      ))}

      {editing ? (
        <div className="react-editor">
          <div className="react-editor-head">
            <div className="react-editor-num">{num}</div>
            <div className="react-editor-titles">
              <span className="react-editor-title">Reaction {num}</span>
              <div className="react-sub">Pick when, then what happens.</div>
            </div>
          </div>

          <div className="react-grid">
            <div className="react-label when">WHEN</div>
            {/* clicking is the only trigger the editor can build today */}
            <button className="react-chip filled" disabled title="More ways to start a reaction are coming">
              <span className="react-chip-text">someone clicks it</span>
            </button>

            <div className="react-label then">THEN</div>
            <button className={chosen ? `react-chip filled warm${pickingThen ? ' active' : ''}` : `react-chip${pickingThen ? ' active' : ''}`} aria-expanded={pickingThen} onClick={() => setPickingThen((value) => !value)}>
              <span className="react-chip-text">{chosen ? chosen.label : 'pick what happens'}</span>
              <Chevron />
            </button>
            {pickingThen && (
              <>
                <div />
                <div className="react-options">
                  {thenChoices.map((choice) => (
                    <button
                      key={choice.action}
                      className={then === choice.action ? 'react-option selected' : 'react-option'}
                      onClick={() => { setThen(choice.action); setPickingThen(false); setProblem(null) }}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {then && !pickingThen && thenQuestion[then] && (
              <>
                <div />
                <div className="react-extra">
                  <Elbow stroke="#E3C88F" />
                  <div className="react-chip filled warm react-extra-chip">
                    <span className="react-extra-q">{thenQuestion[then]}</span>
                    {then === 'changeColor' && <input aria-label="Colour" type="color" value={hex} onChange={(event) => setHex(event.target.value)} />}
                    {then === 'playAudio' && (
                      <select aria-label="Sound" value={soundId} onChange={(event) => setSoundId(event.target.value)}>
                        {audioAssetCatalog.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.label}</option>)}
                      </select>
                    )}
                    {then === 'showText' && (
                      <textarea aria-label="Message" rows={2} maxLength={MAX_MESSAGE_LENGTH} value={message} onChange={(event) => setMessage(event.target.value)} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {!then && <div className="react-sub">Pick what starts it and what happens. Then you can fine-tune it here.</div>}
          {problem && <div className="info-problem" role="alert">{problem}</div>}

          <div className="react-editor-actions">
            <DeleteButton onClick={close} />
            <div className="object-panel-spacer" />
            <button className="react-done" onClick={done}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              Done
            </button>
          </div>
        </div>
      ) : (
        <button className="react-add" onClick={() => startNew()}>+ Add reaction</button>
      )}
    </div>
  )
}
