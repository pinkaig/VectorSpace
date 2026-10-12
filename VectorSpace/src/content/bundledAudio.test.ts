import { closeSync, openSync, readdirSync, readSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The check validateAudioCatalog used to make at every launch (download and decode each
// clip), done once at test time from the first bytes of each file instead. A renamed
// .txt or a half-copied download fails here, in CI, rather than in the visitor's browser.
const audioDir = fileURLToPath(new URL('../../public/audio/', import.meta.url))
const files = readdirSync(audioDir).filter((name) => /\.(ogg|mp3|wav)$/i.test(name))

const readHead = (name: string): Buffer => {
  const fd = openSync(audioDir + name, 'r')
  try {
    const head = Buffer.alloc(12)
    readSync(fd, head, 0, head.length, 0)
    return head
  } finally {
    closeSync(fd)
  }
}

const hasAudioHeader = (name: string, head: Buffer): boolean => {
  const text = (start: number, end: number) => head.toString('latin1', start, end)
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (extension === 'ogg') return text(0, 4) === 'OggS'
  if (extension === 'wav') return text(0, 4) === 'RIFF' && text(8, 12) === 'WAVE'
  // mp3 starts with an ID3 tag, or straight into an MPEG frame (eleven set sync bits)
  return text(0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
}

describe('bundled audio in public/audio', () => {
  it('has clips to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s starts with a valid audio header', (name) => {
    expect(hasAudioHeader(name, readHead(name))).toBe(true)
  })
})
