/**
 * @file        parseMediaLink.ts
 * @author      Weian Ching
 * @brief       Turns a pasted link into a provider and video id, or says why not.
 *
 * @responsibility
 * The browser's copy of the server's parser (apps/api/app/media_policy.py),
 * so a teacher sees "not a YouTube video" before anything is sent. The server
 * still parses again and is the one that decides. Both are tested against the
 * same list, mediaLinkCases.json, so they cannot drift apart.
 *
 * Only https YouTube links are accepted: watch?v=, youtu.be/, /embed/ and
 * /shorts/. The result is an id; the player rebuilds the embed address from
 * it, so the pasted text never becomes an iframe source.
 *
 * @documentation
 * docs/handover/image-video-work-package.md step B7.
 */
import { EMBED_PROVIDERS, type EmbedProvider } from './mediaKinds'

export type ParsedMediaLink = { provider: EmbedProvider; providerId: string } | { error: string }

const MAX_LINK_LENGTH = 500
const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const SHORT_HOSTS = new Set(['youtu.be'])

export const parseMediaLink = (url: string): ParsedMediaLink => {
  if (typeof url !== 'string' || !url.trim() || url.length > MAX_LINK_LENGTH) return { error: 'Paste a link to a YouTube video' }
  const text = url.trim()
  // a backslash reads as a slash here but not on the server; refusing it keeps the two parsers in agreement
  if (/[\\\s]/.test(text)) return { error: 'That is not a valid link' }
  // the raw authority, before the URL parser hides an explicit ':443' or tidies it up
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(text)?.[1]
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    return { error: 'That is not a valid link' }
  }
  if (parsed.protocol !== 'https:') return { error: 'Only https links can be added' }
  // a username, password or port is never needed and can hide the real host
  if (authority === undefined || authority.includes('@') || authority.includes(':')) return { error: 'That is not a valid link' }

  const host = parsed.hostname.toLowerCase()
  const segments = parsed.pathname.split('/').filter(Boolean)
  let videoId: string | undefined
  if (SHORT_HOSTS.has(host) && segments.length === 1) {
    videoId = segments[0]
  } else if (WATCH_HOSTS.has(host)) {
    if (segments.length === 1 && segments[0] === 'watch') {
      const values = parsed.searchParams.getAll('v')
      videoId = values.length === 1 ? values[0] : undefined
    } else if (segments.length === 2 && (segments[0] === 'embed' || segments[0] === 'shorts')) {
      videoId = segments[1]
    }
  } else {
    return { error: 'Only YouTube links can be added for now' }
  }
  if (videoId === undefined || !EMBED_PROVIDERS.youtube.idPattern.test(videoId)) return { error: 'That YouTube link does not point at a video' }
  return { provider: 'youtube', providerId: videoId }
}
