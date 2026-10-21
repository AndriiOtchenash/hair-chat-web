import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { API, consentsFixture, consentsHandlers } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render'

function recordDeletes() {
  const paths: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'DELETE') paths.push(new URL(request.url).pathname)
  })
  return paths
}

describe('SettingsPage', () => {
  it('shows the account and the status of every consent', async () => {
    server.use(
      ...consentsHandlers(consentsFixture({ granted: ['age_18'], older: ['health_data'] })),
    )
    renderApp('/settings')

    expect(await screen.findByText('01929b2e-7c4a-7d3e-9f00-123456789abc')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()

    const age = await screen.findByRole('listitem', { name: 'I am 18 or older' })
    expect(age).toHaveTextContent(/Accepted on/)
    expect(screen.getByRole('listitem', { name: 'Hair and scalp data' })).toHaveTextContent(
      'Needs to be accepted again',
    )
    expect(
      screen.getByRole('listitem', { name: 'Answers come from artificial intelligence' }),
    ).toHaveTextContent('Not accepted')
    expect(screen.getByRole('link', { name: 'Give consents' })).toHaveAttribute('href', '/consents')
  })

  it('withdraws a consent after confirmation that explains the consequences', async () => {
    const deletes = recordDeletes()
    const user = userEvent.setup()
    renderApp('/settings')

    const row = await screen.findByRole('listitem', { name: 'Hair and scalp data' })
    await user.click(within(row).getByRole('button', { name: 'Withdraw' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw consent?' })
    expect(dialog).toHaveTextContent('the chat becomes unavailable')
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

    expect(await screen.findByText('Consent withdrawn.')).toBeInTheDocument()
    expect(deletes).toEqual(['/api/consents/health_data'])
    await waitFor(() => {
      expect(screen.getByRole('listitem', { name: 'Hair and scalp data' })).toHaveTextContent(
        'Not accepted',
      )
    })
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const deletes = recordDeletes()
    const user = userEvent.setup()
    renderApp('/settings')

    const row = await screen.findByRole('listitem', { name: 'I am 18 or older' })
    await user.click(within(row).getByRole('button', { name: 'Withdraw' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deletes).toEqual([])
  })

  it('shows a failed withdrawal as a toast', async () => {
    server.use(
      http.delete(`${API}/consents/:type`, () =>
        HttpResponse.json({ code: 'internal_error', message: 'boom' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderApp('/settings')

    const row = await screen.findByRole('listitem', { name: 'I am 18 or older' })
    await user.click(within(row).getByRole('button', { name: 'Withdraw' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument()
  })
})
