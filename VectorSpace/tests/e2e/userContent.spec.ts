import { expect, test } from '@playwright/test'
import { openEditor } from '../openEditor'

// userAudio.ts keeps imported clips in IndexedDB and registers them into a shared catalog
// every time the editor mounts. With routing the editor mounts again each time the
// visitor comes back to /editor, and must not list the same clip twice.
// SKIPPED: the audio/assets left rail is turned off (see EditorPage.tsx); restore it from git
// commit 68caea5 (EditorPage.tsx lines 268-499) and un-skip this.
test.skip('an imported clip is listed once after leaving and re-entering the editor', async ({ page }) => {
  await openEditor(page)
  // store one clip the way userAudio.ts does (database, store and record shape)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('vectorspace-user-audio', 1)
        open.onupgradeneeded = () => open.result.createObjectStore('clips', { keyPath: 'id' })
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const tx = open.result.transaction('clips', 'readwrite')
          tx.objectStore('clips').put({ id: 'seed', name: 'Seeded clip', fileName: 'seed.ogg', blob: new Blob(['x'], { type: 'audio/ogg' }), contentType: 'audio/ogg', addedAt: 1, contentHash: 'seed' })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.reload()

  const seeded = page.locator('.audio-card', { hasText: 'Seeded clip' })
  await page.getByRole('button', { name: 'Assets' }).click()
  await expect(seeded).toHaveCount(1)

  await page.getByRole('button', { name: 'Home' }).click()
  await page.getByRole('link', { name: 'Editor' }).click()
  await page.getByRole('button', { name: 'Assets' }).click()
  await expect(seeded).toHaveCount(1)
})
