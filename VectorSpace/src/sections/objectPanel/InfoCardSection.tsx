/**
 * @file        InfoCardSection.tsx
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       The Info tab's card form: title, text, an image or video from the
 *              media library with its caption, an optional timer, and a live
 *              preview drawn the same way visitors will see it.
 *
 * @responsibility
 * Holds only the draft being typed. Saving calls onSave with a CardInput;
 * EditorPage turns that into a project change (cardEditorOperations.ts) so one
 * undo removes the whole card. The preview parses the text with the same
 * parser and URL policy as the run-time card, so a javascript: link is gone
 * here too.
 *
 * @documentation
 * docs/handover/info-card-work-package.md step A5.
 */
/******************************************************************************/
import { useMemo, useState } from 'react'
import { DEFAULT_TEXT_LIMITS, RichTextParser, UrlPolicy } from '../../../packages/text/src/index'
import type { CardMedia } from '../../project/model'
import { checkCardInput, MAX_CARD_CAPTION_LENGTH, MAX_CARD_TITLE_LENGTH, type CardInput } from '../../editor/cardEditorOperations'
import MediaView from '../../runtime/MediaView'
import { TextNodes } from '../../runtime/TextPanelHost'

/** One entry the media picker offers: an uploaded file or an approved link from the project's library. */
export interface MediaChoice {
  assetId: string
  kind: CardMedia['kind']
  label: string
}

const parser = new RichTextParser(new UrlPolicy(), DEFAULT_TEXT_LIMITS)

export function InfoCardSection({ card, mediaChoices, onSave, onRemove }: {
  card: CardInput | null          // the object's current card, or null for none yet
  mediaChoices: MediaChoice[]     // empty when no server library is connected
  onSave: (input: CardInput) => string | null   // returns an error to show, or null when saved
  onRemove: () => void
}) {
  const [title, setTitle] = useState(card?.title ?? '')
  const [body, setBody] = useState(card?.body ?? '')
  const [mediaId, setMediaId] = useState(card?.media?.assetId ?? '')
  const [caption, setCaption] = useState(card?.media?.caption ?? '')
  const [alt, setAlt] = useState(card?.media?.alt ?? '')
  const [timerSeconds, setTimerSeconds] = useState(card?.autoCloseMs ? String(card.autoCloseMs / 1000) : '')
  const [message, setMessage] = useState<{ tone: 'error' | 'saved'; text: string } | null>(null)

  // a saved card can point at an entry the library no longer lists; keep it selectable rather than silently drop it
  const choices = useMemo(() => {
    const saved = card?.media
    if (!saved || mediaChoices.some((choice) => choice.assetId === saved.assetId)) return mediaChoices
    return [...mediaChoices, { assetId: saved.assetId, kind: saved.kind, label: `${saved.kind === 'image' ? 'Image' : 'Video'} (no longer in the library)` }]
  }, [card, mediaChoices])
  const picked = choices.find((choice) => choice.assetId === mediaId)

  const draft: CardInput = {
    title,
    body,
    ...(picked ? { media: { kind: picked.kind, assetId: picked.assetId, caption, alt } } : {}),
    ...(timerSeconds.trim() ? { autoCloseMs: Number(timerSeconds) * 1000 } : {}),
  }
  const nodes = useMemo(() => parser.parse('markdown-lite', body), [body])

  const save = () => {
    const problem = checkCardInput(draft) ?? onSave(draft)
    setMessage(problem ? { tone: 'error', text: problem } : { tone: 'saved', text: 'Card saved' })
  }

  return (
    <>
      <div className="object-panel-box info-card-form">
        <span className="object-panel-label">Info card</span>
        <label className="info-card-field">
          <span>Title</span>
          <input value={title} maxLength={MAX_CARD_TITLE_LENGTH} onChange={(event) => setTitle(event.target.value)} placeholder="What is this?" />
        </label>
        <label className="info-card-field">
          <span>Text</span>
          <textarea value={body} rows={5} onChange={(event) => setBody(event.target.value)} placeholder="Tell visitors about it. **bold**, *italic* and https links work." />
        </label>
        <label className="info-card-field">
          <span>Picture or video</span>
          <select value={mediaId} onChange={(event) => setMediaId(event.target.value)}>
            <option value="">None</option>
            {choices.map((choice) => <option key={choice.assetId} value={choice.assetId}>{choice.label}</option>)}
          </select>
          {mediaChoices.length === 0 && <small className="object-panel-hint">The media library needs the server, so there is nothing to pick yet.</small>}
        </label>
        {picked && (
          <>
            <label className="info-card-field">
              <span>Caption</span>
              <input value={caption} maxLength={MAX_CARD_CAPTION_LENGTH} onChange={(event) => setCaption(event.target.value)} />
            </label>
            <label className="info-card-field">
              <span>{picked.kind === 'image' ? 'Describe the image (required)' : 'Describe the video'}</span>
              <input value={alt} maxLength={MAX_CARD_CAPTION_LENGTH} onChange={(event) => setAlt(event.target.value)} placeholder="For visitors who cannot see it" />
            </label>
          </>
        )}
        <label className="info-card-field">
          <span>Close by itself after (seconds, optional)</span>
          <input type="number" min={1} step={1} value={timerSeconds} onChange={(event) => setTimerSeconds(event.target.value)} />
        </label>
        {message && <small className={`info-card-message ${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</small>}
        <div className="object-panel-row">
          <button className="object-panel-button" onClick={save}>{card ? 'Save card' : 'Add info card'}</button>
          <button className="object-panel-button danger" onClick={onRemove} disabled={!card}>Remove card</button>
        </div>
      </div>

      <div className="object-panel-box">
        <span className="object-panel-label">Preview</span>
        <div className="text-panel text-card info-card-preview" aria-label="Card preview">
          <header className="text-panel-header"><h2>{title || 'Untitled card'}</h2></header>
          {draft.media && <MediaView media={draft.media} />}
          <div className="text-panel-body"><TextNodes nodes={nodes} /></div>
        </div>
      </div>
    </>
  )
}
