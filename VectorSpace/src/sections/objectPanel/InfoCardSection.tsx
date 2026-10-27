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
import type { InteractionRule } from '@vectorspace/project'
import type { CardMedia } from '../../project/model'
import { checkCardInput, MAX_CARD_CAPTION_LENGTH, MAX_CARD_TITLE_LENGTH, type CardInput } from '../../editor/cardEditorOperations'
import MediaView from '../../runtime/MediaView'

/** One entry the pickers offer: an uploaded file or an approved link from the project's library. */
export interface MediaChoice {
  assetId: string
  kind: CardMedia['kind']
  label: string
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

// the line under an item: nothing opens a card or plays a video on click until a reaction does
function NoReactionLine({ onGo }: { onGo: () => void }) {
  return (
    <button className="info-rule-line warn" onClick={onGo}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C98414" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
      <span>Visitors can't open this yet</span>
      <span className="info-rule-action">Add a reaction</span>
    </button>
  )
}

export function InfoCardSection({ card, video, mediaChoices, rules, onSaveCard, onRemoveCard, onSaveVideo, onRemoveVideo, onGoToReactions }: {
  card: CardInput | null
  video: { assetId: string; label: string } | null
  mediaChoices: MediaChoice[]     // empty when no server library is connected
  rules: InteractionRule[]
  onSaveCard?: (input: CardInput) => string | null
  onRemoveCard?: () => void
  onSaveVideo?: (assetId: string) => string | null
  onRemoveVideo?: () => void
  onGoToReactions: () => void
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

  const images = mediaChoices.filter((choice) => choice.kind === 'image')
  const videos = mediaChoices.filter((choice) => choice.kind === 'video')
  // reactions that play this object's video; nothing opens a card by click yet, so the card always shows the warning
  const videoHasReaction = rules.some((rule) => rule.actions.some((action) => action.kind === 'playMedia'))

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
                <div className="info-pick-list">
                  {images.length === 0 && <div className="info-note">No pictures in the media library yet.</div>}
                  {images.map((choice) => (
                    <button
                      key={choice.assetId}
                      className={picture?.assetId === choice.assetId ? 'info-pick selected' : 'info-pick'}
                      onClick={() => { setPicture({ kind: 'image', assetId: choice.assetId, caption: picture?.caption }); setChoosingPicture(false) }}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}
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
            <div className="info-pick-list">
              {videos.length === 0 && <div className="info-note">No videos in the media library yet.</div>}
              {videos.map((choice) => (
                <button key={choice.assetId} className={videoId === choice.assetId ? 'info-pick selected' : 'info-pick'} onClick={() => setVideoId(choice.assetId)}>
                  {choice.label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>
                </button>
              ))}
            </div>
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
          <NoReactionLine onGo={onGoToReactions} />
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
          {videoHasReaction ? null : <NoReactionLine onGo={onGoToReactions} />}
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
