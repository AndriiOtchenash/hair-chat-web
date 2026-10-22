import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n, { rememberExplicitLanguage } from '@/i18n'
import { auth0 } from '@/test/auth0Mock'
import { API } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

/** jsdom has no object URLs: record what would be downloaded instead. */
function captureDownloads() {
  const downloads: { filename: string; href: string; blob: Blob }[] = []
  const blobs = new Map<string, Blob>()
  let n = 0
  URL.createObjectURL = vi.fn((blob: Blob) => {
    n += 1
    const url = `blob:test/${String(n)}`
    blobs.set(url, blob)
    return url
  })
  const revoke = vi.fn()
  URL.revokeObjectURL = revoke
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.href)
    if (blob) downloads.push({ filename: this.download, href: this.href, blob })
  })
  return { downloads, revoke }
}

function recordRequests() {
  const requests: { method: string; path: string; auth: string | null; body: Promise<string> }[] =
    []
  server.events.on('request:start', ({ request }) => {
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      auth: request.headers.get('Authorization'),
      body: request.clone().text(),
    })
  })
  return requests
}

const originalUrl = {
  createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
}
afterEach(() => {
  for (const [name, descriptor] of Object.entries(originalUrl)) {
    if (descriptor) Object.defineProperty(URL, name, descriptor)
    else Reflect.deleteProperty(URL, name)
  }
  server.events.removeAllListeners()
})

async function openSettings() {
  const user = userEvent.setup()
  renderApp('/settings')
  await screen.findByText('Your data')
  return user
}

describe('download my data', () => {
  it('downloads GET /me/export with the Bearer token under the server file name', async () => {
    const { downloads, revoke } = captureDownloads()
    const requests = recordRequests()
    const user = await openSettings()

    await user.click(screen.getByRole('button', { name: 'Download for transfer (JSON)' }))

    await waitFor(() => {
      expect(downloads).toHaveLength(1)
    })
    expect(downloads[0]?.filename).toBe('hair-chat-export-2026-10-22.json')
    expect(JSON.parse(await (downloads[0] as { blob: Blob }).blob.text())).toMatchObject({
      format_version: 1,
    })
    expect(requests.find((r) => r.path === '/api/me/export')?.auth).toBe('Bearer test-token')
    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith(downloads[0]?.href)
    })
  })

  it('falls back to hair-chat-export.json without Content-Disposition', async () => {
    const { downloads } = captureDownloads()
    server.use(http.get(`${API}/me/export`, () => HttpResponse.json({ format_version: 1 })))
    const user = await openSettings()

    await user.click(screen.getByRole('button', { name: 'Download for transfer (JSON)' }))

    await waitFor(() => {
      expect(downloads[0]?.filename).toBe('hair-chat-export.json')
    })
  })

  it('disables the button while loading and shows an error toast in the UI language', async () => {
    rememberExplicitLanguage('pl')
    await i18n.changeLanguage('pl')
    const { downloads } = captureDownloads()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get(`${API}/me/export`, async () => {
        await gate
        return HttpResponse.json({ code: 'internal_error', message: 'boom' }, { status: 500 })
      }),
    )
    const user = userEvent.setup()
    renderApp('/settings')

    await user.click(await screen.findByRole('button', { name: 'Pobierz do przeniesienia (JSON)' }))
    expect(await screen.findByRole('button', { name: 'Przygotowujemy plik…' })).toBeDisabled()
    release()

    expect(await screen.findByText('Błąd serwera. Spróbuj później.')).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pobierz do przeniesienia (JSON)' })).toBeEnabled()
    expect(downloads).toHaveLength(0)
  })
})

describe('download to read (HTML)', () => {
  it('builds an HTML file from the export with the conversations, in the UI language', async () => {
    const { downloads } = captureDownloads()
    const requests = recordRequests()
    const user = await openSettings()

    await user.click(screen.getByRole('button', { name: 'Download to read' }))

    await waitFor(() => {
      expect(downloads).toHaveLength(1)
    })
    const file = downloads[0] as { filename: string; blob: Blob }
    expect(file.filename).toBe('hair-chat-export-2026-10-22.html')
    expect(file.blob.type).toBe('text/html;charset=utf-8')
    const html = await file.blob.text()
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('Oily scalp')
    expect(html).toContain('How often should I wash oily hair?')
    expect(html).toContain('<strong>every 1–2 days</strong>')
    expect(requests.find((r) => r.path === '/api/me/export')?.auth).toBe('Bearer test-token')
    expect(
      screen.getByText(/“To read” is a page you can open in a browser or print/),
    ).toBeInTheDocument()
  })
})

describe('delete account', () => {
  async function openDeleteDialog() {
    const user = await openSettings()
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete your account?' })
    return { user, dialog }
  }

  it('explains what is deleted and enables the button only for the confirmation word', async () => {
    const { user, dialog } = await openDeleteDialog()

    expect(dialog).toHaveTextContent('profile, all your conversations and your consents')
    expect(dialog).toHaveTextContent('This cannot be undone')
    expect(dialog).toHaveTextContent('download your data first')

    const confirm = within(dialog).getByRole('button', { name: 'Delete forever' })
    const field = within(dialog).getByRole('textbox', { name: 'To confirm, type DELETE' })
    expect(confirm).toBeDisabled()
    await user.type(field, 'DELET')
    expect(confirm).toBeDisabled()
    await user.type(field, 'E')
    expect(confirm).toBeEnabled()
    await user.clear(field)
    await user.type(field, ' delete ')
    expect(confirm).toBeEnabled()
  })

  it('cancelling deletes nothing', async () => {
    const requests = recordRequests()
    const { user, dialog } = await openDeleteDialog()

    await user.type(within(dialog).getByRole('textbox'), 'DELETE')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(requests.some((r) => r.method === 'DELETE')).toBe(false)
    expect(auth0.logout).not.toHaveBeenCalled()
  })

  describe('with a localized word', () => {
    beforeEach(async () => {
      rememberExplicitLanguage('uk')
      await i18n.changeLanguage('uk')
    })

    it('asks for the word of the UI language but always sends {confirm: "DELETE"}', async () => {
      const requests = recordRequests()
      const user = userEvent.setup()
      renderApp('/settings')
      await user.click(await screen.findByRole('button', { name: 'Видалити акаунт' }))
      const dialog = await screen.findByRole('alertdialog')

      const field = within(dialog).getByRole('textbox', {
        name: 'Для підтвердження введіть ВИДАЛИТИ',
      })
      const confirm = within(dialog).getByRole('button', { name: 'Видалити назавжди' })
      await user.type(field, 'DELETE')
      expect(confirm).toBeDisabled()
      await user.clear(field)
      await user.type(field, 'видалити')
      await user.click(confirm)

      await waitFor(() => {
        expect(auth0.logout).toHaveBeenCalled()
      })
      const del = requests.find((r) => r.method === 'DELETE' && r.path === '/api/me')
      expect(JSON.parse(await (del as { body: Promise<string> }).body)).toEqual({
        confirm: 'DELETE',
      })
    })
  })

  it('after 204 signs out to /login?deleted=1 and makes no more API calls', async () => {
    const requests = recordRequests()
    const { user, dialog } = await openDeleteDialog()

    await user.type(within(dialog).getByRole('textbox'), 'DELETE')
    await user.click(within(dialog).getByRole('button', { name: 'Delete forever' }))

    await waitFor(() => {
      expect(auth0.logout).toHaveBeenCalledWith({
        logoutParams: { returnTo: `${window.location.origin}/login?deleted=1` },
      })
    })
    const deleteIndex = requests.findIndex((r) => r.method === 'DELETE' && r.path === '/api/me')
    expect(deleteIndex).toBeGreaterThanOrEqual(0)
    // A request after the deletion would recreate the user from the still-valid token.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(requests.slice(deleteIndex + 1)).toEqual([])
    expect(auth0.logout).toHaveBeenCalledOnce()
  })

  it('shows an error toast and stays signed in when the API refuses', async () => {
    server.use(
      http.delete(`${API}/me`, () =>
        HttpResponse.json({ code: 'internal_error', message: 'db down' }, { status: 500 }),
      ),
    )
    const { user, dialog } = await openDeleteDialog()

    await user.type(within(dialog).getByRole('textbox'), 'DELETE')
    await user.click(within(dialog).getByRole('button', { name: 'Delete forever' }))

    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
    expect(auth0.logout).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Delete forever' })).toBeEnabled()
  })
})

describe('revoke dialog', () => {
  it('links to the "Your data" section', async () => {
    const user = await openSettings()

    const row = await screen.findByRole('listitem', { name: 'Hair and scalp data' })
    await user.click(within(row).getByRole('button', { name: 'Withdraw' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw consent?' })
    expect(dialog).toHaveTextContent('To delete your data, see the Your data section.')

    const link = within(dialog).getByRole('link', { name: 'Your data' })
    expect(link).toHaveAttribute('href', '#your-data')
    await user.click(link)

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(document.activeElement?.id).toBe('your-data')
  })
})
