/**
 * @file        MediaLibraryPanel.tsx
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       A project's media library: upload images and videos, add
 *              YouTube links, approve or send back links, and delete entries.
 *
 * @responsibility
 * Talks to the API through src/api/media.ts and holds only what it shows.
 * The approval list follows the Approve / Send back pattern the Teacher Review
 * design uses, with an optional comment for whoever added the link. A link
 * plays in cards only once approved; until then cards show "Video unavailable".
 * Students see only what is ready, so the edit and review parts are hidden.
 *
 * @documentation
 * docs/handover/image-video-work-package.md steps B4 and B8.
 */
/******************************************************************************/
import { useCallback, useEffect, useState } from 'react'
import { MEDIA_KIND_SPECS, parseMediaLink } from '../../../packages/assets/src/index'
import type { GetToken } from '../../api/client'
import { addMediaLink, checkUploadFile, deleteMedia, listMedia, reviewMediaLink, uploadMediaFile, type MediaEntry } from '../../api/media'
import './mediaLibraryPanel.css'

const ACCEPT = [...MEDIA_KIND_SPECS.image.contentTypes, ...MEDIA_KIND_SPECS.video.contentTypes].join(',')

const statusText = (entry: MediaEntry): { text: string; tone: 'ready' | 'waiting' | 'problem' } => {
  if (entry.source === 'external') {
    if (entry.approval === 'approved') return { text: 'Approved', tone: 'ready' }
    if (entry.approval === 'rejected') return { text: 'Sent back', tone: 'problem' }
    return { text: 'Waiting for approval', tone: 'waiting' }
  }
  if (entry.status === 'uploaded') return { text: 'Ready', tone: 'ready' }
  if (entry.status === 'failed') return { text: 'Upload failed', tone: 'problem' }
  return { text: 'Uploading', tone: 'waiting' }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong')

function ReviewRow({ entry, onReview }: { entry: MediaEntry; onReview: (approval: 'approved' | 'rejected', comment: string) => Promise<void> }) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const act = async (approval: 'approved' | 'rejected') => {
    setBusy(true)
    try { await onReview(approval, comment) } finally { setBusy(false) }
  }
  return (
    <li className="media-library-review">
      <a href={entry.url ?? undefined} target="_blank" rel="noopener noreferrer">{entry.label}</a>
      <textarea aria-label={`Comment for ${entry.label}`} rows={2} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comment (optional)" />
      <div className="media-library-row">
        <button className="media-library-button primary" disabled={busy} onClick={() => void act('approved')}>Approve</button>
        <button className="media-library-button" disabled={busy} onClick={() => void act('rejected')}>Send back</button>
      </div>
    </li>
  )
}

export function MediaLibraryPanel({ projectId, getToken, canEdit, canReview, base, onChange }: {
  projectId: string
  getToken: GetToken
  canEdit: boolean     // a teacher or admin who can change this project: upload, add links, delete
  canReview: boolean   // a teacher or admin who can see it: approve or send back links
  base?: string        // API address; defaults to VITE_API_URL
  onChange?: (entries: MediaEntry[]) => void   // e.g. to refresh the card editor's media picker
}) {
  const [entries, setEntries] = useState<MediaEntry[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [link, setLink] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = await listMedia(getToken, projectId, base)
      setEntries(next)
      onChange?.(next)
      setProblem(null)
    } catch (error) {
      setProblem(errorText(error))
    }
  }, [getToken, projectId, base, onChange])
  useEffect(() => { void refresh() }, [refresh])

  const upload = async (file: File | undefined) => {
    if (!file) return
    const checked = checkUploadFile(file)
    if ('error' in checked) return setProblem(checked.error)
    setProblem(null)
    setProgress(0)
    try {
      await uploadMediaFile(getToken, projectId, file, setProgress, base)
    } catch (error) {
      setProblem(errorText(error))
    } finally {
      setProgress(null)
      await refresh()
    }
  }

  const parsed = link.trim() ? parseMediaLink(link) : null
  const addLink = async () => {
    if (!parsed || 'error' in parsed) return
    try {
      await addMediaLink(getToken, projectId, link.trim(), base)
      setLink('')
      await refresh()
    } catch (error) {
      setProblem(errorText(error))
    }
  }

  const review = async (entry: MediaEntry, approval: 'approved' | 'rejected', comment: string) => {
    try {
      await reviewMediaLink(getToken, projectId, entry.id, approval, comment, base)
      await refresh()
    } catch (error) {
      setProblem(errorText(error))
    }
  }

  const remove = async (entry: MediaEntry) => {
    try {
      await deleteMedia(getToken, projectId, entry.id, base)
      await refresh()
    } catch (error) {
      setProblem(errorText(error))
    }
  }

  const waiting = entries.filter((entry) => entry.source === 'external' && entry.approval === 'pending')

  return (
    <section className="media-library" aria-label="Media library">
      <h2>Media library</h2>
      {problem && <p className="media-library-problem" role="alert">{problem}</p>}

      {canEdit && (
        <div className="media-library-box">
          <label className="media-library-field">
            <span>Upload an image or video</span>
            <input type="file" accept={ACCEPT} disabled={progress !== null} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} />
          </label>
          {progress !== null && <progress className="media-library-progress" value={progress} max={1} aria-label="Upload progress" />}
          <small>PNG, JPEG or WebP up to 10 MB. MP4 or WebM up to 200 MB.</small>

          <label className="media-library-field">
            <span>Add a YouTube link</span>
            <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </label>
          {parsed && 'error' in parsed && <small className="media-library-hint-error">{parsed.error}</small>}
          {parsed && !('error' in parsed) && <small>YouTube video {parsed.providerId}. It plays once a teacher approves it.</small>}
          <button className="media-library-button" disabled={!parsed || 'error' in parsed} onClick={() => void addLink()}>Add link</button>
        </div>
      )}

      {canReview && waiting.length > 0 && (
        <div className="media-library-box">
          <h3>Waiting for approval</h3>
          <ul className="media-library-list">
            {waiting.map((entry) => <ReviewRow key={entry.id} entry={entry} onReview={(approval, comment) => review(entry, approval, comment)} />)}
          </ul>
        </div>
      )}

      <ul className="media-library-list">
        {entries.length === 0 && <li className="media-library-empty">Nothing in the library yet.</li>}
        {entries.map((entry) => {
          const status = statusText(entry)
          return (
            <li key={entry.id} className="media-library-entry">
              <span className="media-library-kind">{entry.kind === 'image' ? 'Image' : 'Video'}</span>
              <span className="media-library-label">{entry.label}</span>
              <span className={`media-library-status ${status.tone}`}>{status.text}</span>
              {canEdit && <button className="media-library-remove" aria-label={`Delete ${entry.label}`} onClick={() => void remove(entry)}>×</button>}
              {entry.review_comment && <small className="media-library-comment">“{entry.review_comment}”</small>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
