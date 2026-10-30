/**
 * @file        InfoCardSection.tsx
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       The Info tab, laid out like the V3 prototype: what is on this
 *              exhibit (its fact card and video), buttons to add a fact card,
 *              a video or a sound, and the fact card and video forms, each with
 *              Back and Done.
 *
 * @responsibility
 * Holds only the draft being typed and which form is open. Done calls
 * onSaveCard or onSaveVideo; EditorPage turns that into a project change
 * (cardEditorOperations.ts), so one undo removes it. A fact card is the info
 * card (a text attachment in 'card' mode) with an optional picture; a video is
 * the object's video attachment, which a "play a video" reaction plays.
 *
 * @documentation
 * docs/handover/info-card-work-package.md step A5; VectorSpace-V3.03_Demo.html.
 */
/******************************************************************************/
import { useState } from 'react'
import type { CardMedia } from '../../project/model'
import { checkCardInput, MAX_CARD_CAPTION_LENGTH, MAX_CARD_TITLE_LENGTH, type CardInput } from '../../editor/cardEditorOperations'
import MediaView from '../../runtime/MediaView'

/** One entry the pickers offer from the media library: a file from this computer or a link. */
export interface MediaChoice {
  assetId: string
  kind: CardMedia['kind']
  label: string
  // a link added in the editor waits for an admin; until then cards show it as unavailable
  status?: 'approved' | 'pending' | 'rejected'
}

/** Adds a file or a link to the library; returns the new choice, or an error to show. */
export type AddMedia = {
  upload?: (file: File) => Promise<MediaChoice | { error: string }>
  link?: (url: string) => MediaChoice | { error: string }
}

const ACCEPT: Record<CardMedia['kind'], string> = { image: 'image/png,image/jpeg,image/webp', video: 'video/mp4,video/webm' }

/**
 * The list of library entries of one kind, plus "Upload from computer" and a
 * box to paste a link. Picking, uploading or adding a link all select it.
 */
function MediaPicker({ kind, choices, selectedId, onPick, addMedia }: {
  kind: CardMedia['kind']
  choices: MediaChoice[]
  selectedId: string
  onPick: (choice: MediaChoice) => void
  addMedia: AddMedia
}) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const upload = async (file: File | undefined) => {
    if (!file || !addMedia.upload) return
    setBusy(true)
    const result = await addMedia.upload(file)
    setBusy(false)
    if ('error' in result) return setProblem(result.error)
    if (result.kind !== kind) return setProblem(kind === 'image' ? 'That is a video, not a picture' : 'That is a picture, not a video')
    setProblem(null)
    onPick(result)
  }
  const addLink = () => {
    if (!addMedia.link) return
    const result = addMedia.link(link)
    if ('error' in result) return setProblem(result.error)
    if (result.kind !== kind) return setProblem(kind === 'image' ? 'That link is a video, not a picture' : 'That link is a picture, not a video')
    setLink('')
    setProblem(null)
    onPick(result)
  }
  const shown = choices.filter((choice) => choice.kind === kind && choice.status !== 'rejected')
  return (
    <div className="info-pick-list">
      {shown.length === 0 && <div className="info-note">Nothing in the media library yet. Upload one or paste a link.</div>}
      {shown.map((choice) => (
        <button key={choice.assetId} className={selectedId === choice.assetId ? 'info-pick selected' : 'info-pick'} onClick={() => onPick(choice)}>
          <span className="info-pick-label">{choice.label}</span>
          {choice.status === 'pending'
            ? <span className="info-pick-status">Waiting for approval</span>
            : kind === 'video' && <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>}
        </button>
      ))}
      {addMedia.upload && (
        <label className={busy ? 'info-upload busy' : 'info-upload'}>
          {busy ? 'Saving…' : `+ Upload ${kind === 'image' ? 'a picture' : 'a video'} from this computer`}
          <input type="file" accept={ACCEPT[kind]} disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} />
        </label>
      )}
      {addMedia.link && (
        <div className="info-link-row">
          <input
            aria-label={kind === 'image' ? 'Image link' : 'YouTube link'}
            placeholder={kind === 'image' ? 'Paste an image link (https://…/picture.png)' : 'Paste a YouTube link'}
            value={link}
            onChange={(event) => { setLink(event.target.value); setProblem(null) }}
          />
          <button className="info-link-add" disabled={!link.trim()} onClick={addLink}>Add</button>
        </div>
      )}
      {addMedia.link && <div className="info-note">Links play once an admin approves them.</div>}
      {problem && <div className="info-problem" role="alert">{problem}</div>}
    </div>
  )
}

type View = 'list' | 'fact' | 'video'

const CardIcon = ({ stroke = 'currentColor' }: { stroke?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </svg>
)
const VideoIcon = ({ stroke = 'currentColor' }: { stroke?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3z" />
  </svg>
)

// the line under an item: in Play, clicking the exhibit (or reaching it on a tour) shows it
function ShowsWhenLine({ onGo }: { onGo: () => void }) {
  return (
    <button className="info-rule-line" onClick={onGo}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C98414" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 3L5 14h6l-1 7 8-11h-6z" />
      </svg>
      <span>Shows when: <b className="info-rule-when">someone clicks it</b></span>
      <span className="info-rule-action">Change</span>
    </button>
  )
}

// the green note under an item: the built-in behaviour, and where to add more
function AutoNote() {
  return (
    <div className="info-auto">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E9E6A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      <span>Visitors will see this when they click the exhibit or reach it on a tour. You can change that in Step 3.</span>
    </div>
  )
}

export function InfoCardSection({ card, video, mediaChoices, addMedia, onSaveCard, onRemoveCard, onSaveVideo, onRemoveVideo, onGoToReactions, onCardCreated }: {
  card: CardInput | null
  video: { assetId: string; label: string } | null
  mediaChoices: MediaChoice[]
  addMedia: AddMedia
  onSaveCard?: (input: CardInput) => string | null
  onRemoveCard?: () => void
  onSaveVideo?: (assetId: string) => string | null
  onRemoveVideo?: () => void
  onGoToReactions: () => void
  // a brand-new fact card was saved: the panel moves on to Reactions
  onCardCreated?: () => void
}) {
  const [view, setView] = useState<View>('list')
  const [problem, setProblem] = useState<string | null>(null)

  // fact card draft
  const [title, setTitle] = useState(card?.title ?? '')
  const [body, setBody] = useState(card?.body ?? '')
  const [picture, setPicture] = useState<CardMedia | null>(card?.media?.kind === 'image' ? card.media : null)
  const [choosingPicture, setChoosingPicture] = useState(false)
  // video draft
  const [videoId, setVideoId] = useState(video?.assetId ?? '')

  const choiceFor = (assetId: string) => mediaChoices.find((choice) => choice.assetId === assetId)

  const open = (next: View) => {
    setProblem(null)
    setChoosingPicture(false)
    if (next === 'fact') {
      setTitle(card?.title ?? '')
      setBody(card?.body ?? '')
      setPicture(card?.media?.kind === 'image' ? card.media : null)
    }
    if (next === 'video') setVideoId(video?.assetId ?? '')
    setView(next)
  }

  const doneFact = () => {
    const input: CardInput = {
      title,
      body,
      ...(picture ? { media: picture } : {}),
      // the form has no timer, so a timer set elsewhere is kept as it was
      ...(card?.autoCloseMs !== undefined ? { autoCloseMs: card.autoCloseMs } : {}),
    }
    const error = checkCardInput(input) ?? (onSaveCard ? onSaveCard(input) : 'Saving fact cards is not connected in this editor yet')
    if (error) return setProblem(error)
    open('list')
    if (!card) onCardCreated?.()
  }

  const doneVideo = () => {
    if (!videoId) return setProblem('Pick a video')
    const error = onSaveVideo ? onSaveVideo(videoId) : 'Saving videos is not connected in this editor yet'
    if (error) return setProblem(error)
    open('list')
  }

  if (view !== 'list') {
    return (
      <div className="object-panel-tab-body info-form" key={view}>
        <button className="info-back" onClick={() => open('list')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </button>
        <div className="info-form-title">{view === 'fact' ? 'Fact card' : 'Video'}</div>

        {view === 'fact' && (
          <>
            <label className="info-field">
              Title
              <input value={title} maxLength={MAX_CARD_TITLE_LENGTH} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="info-field">
              What should visitors learn?
              <textarea rows={4} value={body} placeholder="Write a fun fact about this exhibit" onChange={(event) => setBody(event.target.value)} />
            </label>
            <div className="info-field">
              Picture (optional)
              {picture ? (
                <>
                  <MediaView media={{ ...picture, caption: undefined }} />
                  <div className="info-picture-actions">
                    <button className="info-link" onClick={() => setChoosingPicture((value) => !value)}>Change picture</button>
                    <button className="info-link danger" onClick={() => setPicture(null)}>Remove picture</button>
                  </div>
                </>
              ) : (
                <button className="info-choose" onClick={() => setChoosingPicture((value) => !value)}>+ Choose a picture</button>
              )}
              {choosingPicture && (
                <MediaPicker
                  kind="image"
                  choices={mediaChoices}
                  selectedId={picture?.assetId ?? ''}
                  addMedia={addMedia}
                  onPick={(choice) => { setPicture({ kind: 'image', assetId: choice.assetId, caption: picture?.caption }); setChoosingPicture(false) }}
                />
              )}
              {picture && choiceFor(picture.assetId)?.status === 'pending' && <div className="info-note">This picture shows once an admin approves the link.</div>}
            </div>
            {picture && (
              <label className="info-field">
                Caption
                <input
                  value={picture.caption ?? ''}
                  maxLength={MAX_CARD_CAPTION_LENGTH}
                  placeholder="What is in this picture?"
                  onChange={(event) => setPicture({ ...picture, caption: event.target.value, alt: undefined })}
                />
              </label>
            )}
          </>
        )}

        {view === 'video' && (
          <>
            <div className="info-heading">Pick a video</div>
            <MediaPicker kind="video" choices={mediaChoices} selectedId={videoId} addMedia={addMedia} onPick={(choice) => { setVideoId(choice.assetId); setProblem(null) }} />
            <div className="info-note">From your school's video library. Visitors open it in a pop-up and can play, pause and close it.</div>
          </>
        )}

        {problem && <div className="info-problem" role="alert">{problem}</div>}
        <button className="info-done" onClick={view === 'fact' ? doneFact : doneVideo}>Done</button>
        {view === 'fact' && card && onRemoveCard && <button className="info-link danger" onClick={() => { onRemoveCard(); open('list') }}>Remove fact card</button>}
        {view === 'video' && video && onRemoveVideo && <button className="info-link danger" onClick={() => { onRemoveVideo(); open('list') }}>Remove video</button>}
      </div>
    )
  }

  return (
    <div className="object-panel-tab-body">
      {card && (
        <div>
          <div className="object-panel-heading">On this exhibit</div>
          <button className="info-item" onClick={() => open('fact')}>
            <CardIcon />
            <span className="info-item-text">
              <span className="info-item-kind">Fact card</span>
              <span className="info-item-name">{card.title}</span>
            </span>
            <span className="info-item-edit">Edit</span>
          </button>
          <ShowsWhenLine onGo={onGoToReactions} />
          <AutoNote />
        </div>
      )}
      {video && (
        <div>
          {!card && <div className="object-panel-heading">On this exhibit</div>}
          <button className="info-item" onClick={() => open('video')}>
            <VideoIcon />
            <span className="info-item-text">
              <span className="info-item-kind">Video</span>
              <span className="info-item-name">{video.label}</span>
            </span>
            <span className="info-item-edit">Edit</span>
          </button>
          {/* a fact card takes the click; without one, the video opens on click */}
          {card
            ? <button className="info-rule-line" onClick={onGoToReactions}><span>Plays with a reaction: <b className="info-rule-when">play its video</b></span><span className="info-rule-action">Add</span></button>
            : <><ShowsWhenLine onGo={onGoToReactions} /><AutoNote /></>}
        </div>
      )}
      <div>
        <div className="object-panel-heading">Add to this exhibit</div>
        <div className="info-add-grid">
          <button className="info-add" onClick={() => open('fact')}><CardIcon stroke="#C98414" />Fact card</button>
          <button className="info-add" onClick={() => open('video')}><VideoIcon stroke="#C98414" />Video</button>
          <button className="info-add wide" onClick={onGoToReactions}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C98414" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 10v4h4l5 4V6L8 10z" />
              <path d="M17 9a4 4 0 010 6" />
            </svg>
            <span>
              <span className="info-add-title">Sound</span>
              <span className="info-add-note">Added in Step 3 →</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
