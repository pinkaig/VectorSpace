/**
 * @file        MediaView.tsx
 * @author      Weian Ching
 * @brief       Shows an info card's image or video: an uploaded image, an
 *              uploaded video, or an approved YouTube link.
 *
 * @responsibility
 * Takes MediaViewProps from packages/project, the fixed seam between the card
 * and the player. It resolves the reference through MediaLibraryContext, then:
 * - image: <img> with alt text and lazy loading;
 * - uploaded video: the browser's own <video controls>, which scrubs and
 *   buffers through range requests; it never autoplays with sound;
 * - YouTube: a sandboxed iframe on the privacy domain, its address rebuilt
 *   from the video id; the Player API is loaded on first use only to hear
 *   its state;
 * - anything that fails (offline, not found, not approved, a dead link, a
 *   blocked embed) shows "Image unavailable" or "Video unavailable" and keeps
 *   the caption. It never renders a blank box and never throws into React.
 * Every state is reported through onState. Closing the card unmounts the
 * player, which stops any video, so a closed card never keeps playing.
 *
 * @documentation
 * docs/handover/image-video-work-package.md step B6; overview section 4.
 */
import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { AssetDescriptor } from '../../packages/assets/src/index'
import type { CardMedia, MediaViewProps, MediaViewState } from '../project/model'
import { MediaLibraryContext } from './mediaLibrary'
import { listLocalMedia, subscribeLocalMedia } from '../content/localMediaLibrary'
import { loadYouTubeApi, youtubeEmbedUrl, type YouTubePlayer } from './youtube'

type Report = (state: MediaViewState) => void

const unavailableText = (media: CardMedia) => (media.kind === 'image' ? 'Image unavailable' : 'Video unavailable')

function Frame({ media, children }: { media: CardMedia; children: ReactNode }) {
  return (
    <figure className="media-view">
      {children}
      {media.caption && <figcaption className="media-view-caption">{media.caption}</figcaption>}
    </figure>
  )
}

function Unavailable({ media, report }: { media: CardMedia; report: Report }) {
  useEffect(() => report('unavailable'), [report])
  return (
    <Frame media={media}>
      <div className="media-view-fallback" role="status">{unavailableText(media)}</div>
    </Frame>
  )
}

function YouTubeEmbed({ media, videoId, autoplay, report, onFail }: {
  media: CardMedia
  videoId: string
  autoplay: boolean
  report: Report
  onFail: () => void
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const src = youtubeEmbedUrl(videoId, { autoplay, origin: typeof window === 'undefined' ? undefined : window.location.origin })
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let player: YouTubePlayer | undefined
    let live = true
    loadYouTubeApi().then(
      (YT) => {
        if (!live) return
        player = new YT.Player(frame, {
          events: {
            onReady: () => report('ready'),
            onStateChange: ({ data }) => {
              if (data === YT.PlayerState.PLAYING) report('playing')
              else if (data === YT.PlayerState.PAUSED) report('paused')
              else if (data === YT.PlayerState.ENDED) report('ended')
            },
            // removed, private, region-blocked or embedding disabled
            onError: () => onFail(),
          },
        })
      },
      // the API could not load (a blocked network): the iframe may still play, but its state is unknown
      () => undefined,
    )
    return () => {
      live = false
      player?.destroy()
    }
  }, [report, onFail])
  if (!src) return <Unavailable media={media} report={report} />
  return (
    <Frame media={media}>
      <iframe
        ref={frameRef}
        className="media-view-embed"
        src={src}
        title={media.alt ?? media.caption ?? 'Video'}
        // scripts and same-origin are what the YouTube player needs to run; no top
        // navigation, no forms, no popups, so the embed cannot take over the page
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
      />
    </Frame>
  )
}

/**
 * Draws one resolved descriptor. Kept apart from the resolving so each state
 * can be rendered and tested on its own. null means still resolving.
 */
export function MediaViewBody({ media, descriptor, autoplay = false, report }: {
  media: CardMedia
  descriptor: AssetDescriptor | null
  autoplay?: boolean
  report: Report
}) {
  // a load or playback error after resolving (dead file, removed video) switches to the fallback
  const [failed, setFailed] = useState(false)
  const fail = useRef(() => setFailed(true)).current
  useEffect(() => setFailed(false), [descriptor])

  if (descriptor === null) {
    return (
      <Frame media={media}>
        <div className="media-view-loading" aria-busy="true">Loading…</div>
      </Frame>
    )
  }
  if (failed || descriptor.status !== 'ready') return <Unavailable media={media} report={report} />

  if (descriptor.embed) {
    if (media.kind !== 'video') return <Unavailable media={media} report={report} />
    return <YouTubeEmbed key={descriptor.embed.providerId} media={media} videoId={descriptor.embed.providerId} autoplay={autoplay} report={report} onFail={fail} />
  }
  if (!descriptor.url) return <Unavailable media={media} report={report} />

  if (media.kind === 'image') {
    return (
      <Frame media={media}>
        <img
          className="media-view-image"
          src={descriptor.url}
          alt={media.alt ?? media.caption ?? ''}
          loading="lazy"
          onLoad={() => report('ready')}
          onError={fail}
        />
      </Frame>
    )
  }
  return (
    <Frame media={media}>
      <video
        className="media-view-video"
        src={descriptor.url}
        controls
        playsInline
        preload="metadata"
        // autoplay only ever starts muted; the visitor turns the sound on
        autoPlay={autoplay}
        muted={autoplay}
        aria-label={media.alt ?? media.caption ?? 'Video'}
        onCanPlay={() => report('ready')}
        onPlaying={() => report('playing')}
        onPause={() => report('paused')}
        onEnded={() => report('ended')}
        onError={fail}
      />
    </Frame>
  )
}

export default function MediaView({ media, autoplay = false, onState }: MediaViewProps) {
  const resolve = useContext(MediaLibraryContext)
  const [descriptor, setDescriptor] = useState<AssetDescriptor | null>(null)
  // the latest onState without making every effect depend on the caller's function identity
  const onStateRef = useRef(onState)
  onStateRef.current = onState
  const lastState = useRef<MediaViewState | null>(null)
  const report = useRef<Report>((state) => {
    if (lastState.current === state) return
    lastState.current = state
    onStateRef.current?.(state)
  }).current

  // the local library changing (an admin approving a link, a file removed) re-resolves, so
  // the slot updates without reopening the card
  const libraryVersion = useSyncExternalStore(subscribeLocalMedia, listLocalMedia, listLocalMedia)

  const { kind, assetId } = media
  useEffect(() => {
    let live = true
    setDescriptor(null)
    report('loading')
    resolve({ kind, assetId }).then(
      (next) => { if (live) setDescriptor(next) },
      // resolvers return error descriptors, but a broken one must still not reach React as a throw
      (error: unknown) => { if (live) setDescriptor({ ref: { kind, assetId }, status: 'error', errorMessage: String(error) }) },
    )
    return () => { live = false }
  }, [kind, assetId, resolve, report, libraryVersion])

  return <MediaViewBody media={media} descriptor={descriptor} autoplay={autoplay} report={report} />
}
