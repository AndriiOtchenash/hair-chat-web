import { Outlet } from 'react-router'

import { Header } from './Header'

export function AppLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 break-words">
        <Outlet />
      </main>
    </div>
  )
}
