import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

test.describe('Mimi Desktop Pet', () => {
  let app: Awaited<ReturnType<typeof electron.launch>>

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      env: { ...process.env }
    })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('app launches and creates a window', async () => {
    const window = await app.firstWindow()
    expect(window).toBeTruthy()

    const title = await window.title()
    expect(title).toBeDefined()
  })

  test('pet character is visible', async () => {
    const window = await app.firstWindow()
    const pet = await window.waitForSelector('.pet', { timeout: 10000 })
    expect(pet).toBeTruthy()
  })

  test('pet body has correct size', async () => {
    const window = await app.firstWindow()
    const body = await window.waitForSelector('.pet-body', { timeout: 10000 })
    const box = await body.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeCloseTo(80, -1)
    expect(box!.height).toBeCloseTo(80, -1)
  })

  test('clicking pet opens chat container', async () => {
    const window = await app.firstWindow()
    const pet = await window.waitForSelector('.pet', { timeout: 10000 })
    await pet.click()

    const chat = await window.waitForSelector('.chat-container', { timeout: 5000 })
    expect(chat).toBeTruthy()
  })

  test('chat has tab bar with 4 tabs', async () => {
    const window = await app.firstWindow()
    const pet = await window.waitForSelector('.pet', { timeout: 10000 })
    await pet.click()

    const tabs = await window.waitForSelector('.tab-bar', { timeout: 5000 })
    expect(tabs).toBeTruthy()

    const tabButtons = await window.$$('.tab-btn')
    expect(tabButtons.length).toBe(4)
  })

  test('clicking pet again closes chat', async () => {
    const window = await app.firstWindow()
    const pet = await window.waitForSelector('.pet', { timeout: 10000 })
    await pet.click()

    // Chat should be visible
    await window.waitForSelector('.chat-container', { timeout: 5000 })
    // Click pet again
    await pet.click()

    // Chat should be gone
    const chatVisible = await window.isVisible('.chat-container')
    expect(chatVisible).toBe(false)
  })

  test('settings button opens settings panel', async () => {
    const window = await app.firstWindow()
    const pet = await window.waitForSelector('.pet', { timeout: 10000 })
    await pet.click()

    const settingsBtn = await window.waitForSelector('.settings-btn', { timeout: 5000 })
    await settingsBtn.click()

    const settings = await window.waitForSelector('.settings-panel', { timeout: 5000 })
    expect(settings).toBeTruthy()
  })

  test('default theme is blue', async () => {
    const window = await app.firstWindow()
    const theme = await window.getAttribute('html', 'data-theme')
    expect(theme).toBe('blue')
  })

  test('drag region exists for window movement', async () => {
    const window = await app.firstWindow()
    const dragRegion = await window.$('.drag-region')
    expect(dragRegion).toBeTruthy()
  })
})
