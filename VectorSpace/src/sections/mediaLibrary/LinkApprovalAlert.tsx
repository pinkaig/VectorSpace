/**
 * @file        LinkApprovalAlert.tsx
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       On the teacher's Review page: "2 links from students need your
 *              approval", opening a short list with Approve / Send back (and a
 *              comment) for each YouTube or image link a student added.
 *
 * @responsibility
 * Reads and writes the media library kept in this browser
 * (src/content/localMediaLibrary.ts), the same one the admin Rooms & assets
 * page approves from. Shows nothing when no link is waiting. A link plays in
 * a student's card only once it is approved.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import { useState } from 'react'
import { reviewLocalMedia, useLocalMediaLibrary, type LocalMediaEntry } from '../../content/localMediaLibrary'
import './linkApprovalAlert.css'

// where a teacher can open a link to check it; YouTube addresses are rebuilt from the id
const openUrl = (entry: LocalMediaEntry) =>
  entry.source === 'youtube' ? `https://www.youtube.com/watch?v=${entry.providerId}` : entry.url

/** How many links students added that wait for a teacher: for the Review tab's label. */
export const usePendingLinkCount = () =>
  useLocalMediaLibrary().filter((entry) => entry.source !== 'file' && entry.approval === 'pending' && entry.addedBy === 'editor').length

function LinkRow({ entry }: { entry: LocalMediaEntry }) {
  const [comment, setComment] = useState('')
  return (
    <li className="link-approval-row">
      <div className="link-approval-main">
        <span className="link-approval-name">{entry.label}</span>
        <span className="link-approval-meta">
          {entry.source === 'youtube' ? 'YouTube video' : 'Image link'} ·{' '}
          <a href={openUrl(entry)} target="_blank" rel="noopener noreferrer">Open to check</a>
        </span>
        <input
          className="link-approval-comment"
          aria-label={`Comment for ${entry.label}`}
          placeholder="Comment if sending back (optional)"
          maxLength={500}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      <div className="link-approval-actions">
        <button className="link-approval-approve" onClick={() => reviewLocalMedia(entry.id, 'approved', comment)}>Approve</button>
        <button className="link-approval-back" onClick={() => reviewLocalMedia(entry.id, 'rejected', comment)}>Send back</button>
      </div>
    </li>
  )
}

export function LinkApprovalAlert() {
  const waiting = useLocalMediaLibrary().filter((entry) => entry.source !== 'file' && entry.approval === 'pending' && entry.addedBy === 'editor')
  const [open, setOpen] = useState(false)
  if (waiting.length === 0) return null
  return (
    <section className="link-approval" aria-label="Links waiting for approval">
      <button className="link-approval-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="link-approval-dot" aria-hidden="true" />
        <span>
          <b>{waiting.length} {waiting.length === 1 ? 'link' : 'links'}</b> from students {waiting.length === 1 ? 'needs' : 'need'} your approval
        </span>
        <span className="link-approval-toggle">{open ? 'Hide' : 'Review'}</span>
      </button>
      {open && <ul className="link-approval-list">{waiting.map((entry) => <LinkRow key={entry.id} entry={entry} />)}</ul>}
    </section>
  )
}
