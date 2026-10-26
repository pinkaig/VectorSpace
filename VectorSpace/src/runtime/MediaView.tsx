/**
 * @file        MediaView.tsx
 * @author      Weian Ching
 * @brief       Shows an info card's image or video. PLACEHOLDER: draws a
 *              labelled box until the media track (work package B, step B6)
 *              replaces the body of this file.
 *
 * @responsibility
 * Takes MediaViewProps from packages/project, the fixed seam between the
 * card and the player, so swapping in the real player changes no caller.
 * The caption always shows, matching the real player's rule that a missing
 * or failed media item keeps its caption.
 *
 * @documentation
 * docs/handover/info-card-and-media-overview.md section 4.
 */
import type { MediaViewProps } from '../project/model'

export default function MediaView({ media }: MediaViewProps) {
  const label = media.kind === 'image' ? 'Image' : 'Video'
  return (
    <figure className="media-view">
      <div className="media-view-placeholder" role="img" aria-label={media.alt ?? `${label} placeholder`}>
        {label} preview coming soon
      </div>
      {media.caption && <figcaption className="media-view-caption">{media.caption}</figcaption>}
    </figure>
  )
}
