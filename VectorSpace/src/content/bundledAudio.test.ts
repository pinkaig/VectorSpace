import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The check validateAudioCatalog used to make at every launch (download and decode each
// clip), done once at test time from the file's own structure instead. A renamed .txt or
// a half-copied download fails here, in CI, rather than in the visitor's browser.
const audioDir = fileURLToPath(new URL('../../public/audio/', import.meta.url))
const files = readdirSync(audioDir).filter((name) => /\.(ogg|mp3|wav)$/i.test(name))

const isWholeAudioFile = (name: string, bytes: Buffer): boolean => {
  const text = (start: number, end: number) => bytes.toString('latin1', start, end)
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (extension === 'ogg') {
    // a complete Ogg stream ends on a page flagged end-of-stream (bit 0x04 of its header type)
    const lastPage = bytes.lastIndexOf('OggS', undefined, 'latin1')
    return text(0, 4) === 'OggS' && lastPage > 0 && (bytes[lastPage + 5] & 0x04) !== 0
  }
  // a wav's RIFF chunk size says how long the file should be
  if (extension === 'wav') return text(0, 4) === 'RIFF' && text(8, 12) === 'WAVE' && bytes.readUInt32LE(4) + 8 <= bytes.length
  // mp3 has no length field: only check it starts with an ID3 tag or an MPEG frame sync
  return text(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
}

describe('bundled audio in public/audio', () => {
  it('has clips to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s is a whole, valid audio file', (name) => {
    expect(isWholeAudioFile(name, readFileSync(audioDir + name))).toBe(true)
  })

  it('rejects a truncated ogg, a renamed text file and a short wav', () => {
    const ogg = readFileSync(audioDir + files.find((name) => name.endsWith('.ogg'))!)
    expect(isWholeAudioFile('cut.ogg', ogg.subarray(0, ogg.length >> 1))).toBe(false)
    expect(isWholeAudioFile('note.ogg', Buffer.from('this is text, not audio'))).toBe(false)
    const riff = Buffer.alloc(44)
    riff.write('RIFF', 0, 'latin1')
    riff.writeUInt32LE(1000, 4)
    riff.write('WAVE', 8, 'latin1')
    expect(isWholeAudioFile('short.wav', riff)).toBe(false)
  })
})
