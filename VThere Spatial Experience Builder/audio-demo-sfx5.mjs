import { chromium } from 'playwright'

const url = 'http://localhost:5174/'
const shotDir = 'C:/Users/gohwh/AppData/Local/Temp/claude/c--Users-gohwh-Documents-GitHub-Project5-DoReMi-yaki/8828bec3-32bb-4443-a439-32d5fb325c3a/scratchpad'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const audioRequests = []
page.on('request', (req) => { if (req.url().includes('/audio/') && req.url().endsWith('.ogg')) audioRequests.push(req.url()) })

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('text=Load audio demo', { timeout: 15000 })
await page.click('text=Load audio demo')
await page.waitForTimeout(300)
await page.click('text=Run simulation')
await page.waitForSelector('text=Visitor simulation', { timeout: 10000 })
await page.waitForTimeout(500)

const canvas = page.locator('canvas').first()
const box = await canvas.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

await page.mouse.move(cx, cy)
await page.mouse.click(cx, cy)
await page.waitForTimeout(800)

await page.mouse.move(cx, cy + 8, { steps: 4 })
await page.waitForTimeout(300)
await page.screenshot({ path: `${shotDir}/08-aimed-fine.png` })

await page.mouse.click(cx, cy)
await page.waitForTimeout(1000)
console.log('After fine aim+click:', JSON.stringify([...new Set(audioRequests)]))

await browser.close()
