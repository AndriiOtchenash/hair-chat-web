import { Outlet, useMatches } from 'react-router'

import { cn } from '@/lib/utils'

import { Header } from './Header'

/** Route `handle` flags read by the layout. */
export interface RouteHandle {
  /** Page fills the viewport below the header (h-14) and scrolls inside its own panes. */
  fullHeight?: boolean
}

export function AppLayout() {
  const fullHeight = useMatches().some((m) => (m.handle as RouteHandle | undefined)?.fullHeight)
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Header wide={fullHeight} />
      <main
        className={cn(
          'mx-auto px-4 break-words',
          fullHeight ? 'flex h-[calc(100svh-3.5rem)] max-w-5xl flex-col py-4' : 'max-w-3xl py-8',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
