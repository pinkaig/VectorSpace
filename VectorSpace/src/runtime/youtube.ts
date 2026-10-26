/**
 * @file        youtube.ts
 * @author      Weian Ching
 * @brief       Builds the YouTube embed address from a video id, and loads the
 *              YouTube IFrame Player API once, the first time a video needs it.
 *
 * @responsibility
 * The embed address is always rebuilt here from the id; a URL a teacher pasted
 * never becomes an iframe source. It uses youtube-nocookie.com, YouTube's
 * privacy domain, so no tracking cookies are set before the visitor presses
 * play. The Player API is only used to hear the player's state (ready,
 * playing, paused, ended, error), so a dead or disabled video can show
 * "Video unavailable" instead of YouTube's own error screen.
 *
 * @documentation
 * docs/handover/image-video-work-package.md step B6; overview section 6.
 */

export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'
const YOUTUBE_API_SRC = 'https://www.youtube.com/iframe_api'
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * The iframe src for one video. Returns null for anything that is not a
 * well-formed id, so a bad id can never reach the iframe.
 * autoplay is always muted: browsers block autoplay with sound, and so do we.
 */
export const youtubeEmbedUrl = (videoId: string, opts: { autoplay?: boolean; origin?: string } = {}): string | null => {
  if (!YOUTUBE_ID.test(videoId)) return null
  const params = new URLSearchParams({ rel: '0', playsinline: '1', enablejsapi: '1' })
  if (opts.origin) params.set('origin', opts.origin)
  if (opts.autoplay) {
    params.set('autoplay', '1')
    params.set('mute', '1')
  }
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${videoId}?${params.toString()}`
}

/** The small part of the YouTube Player API this app uses. */
export interface YouTubePlayer {
  destroy(): void
}
interface YouTubeNamespace {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onReady?: () => void; onStateChange?: (event: { data: number }) => void; onError?: () => void } },
  ) => YouTubePlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number }
}
declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null

/** Loads the Player API script on first call; later calls share the same promise. Rejects if the script cannot load. */
export const loadYouTubeApi = (): Promise<YouTubeNamespace> => {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error('YouTube player API loaded without YT'))
    }
    const script = document.createElement('script')
    script.src = YOUTUBE_API_SRC
    script.async = true
    script.onerror = () => {
      // a school network that blocks YouTube lands here; allow a retry later
      apiPromise = null
      reject(new Error('YouTube player API could not load'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}
