import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ChatPage } from '@/features/chat/ChatPage'
import { ConsentsPage } from '@/features/consents/ConsentsPage'
import { RequireConsents } from '@/features/consents/RequireConsents'
import { SettingsPage } from '@/features/settings/SettingsPage'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        // Signed in: language/consent screens and settings.
        element: <RequireAuth />,
        children: [
          { index: true, element: <Navigate to="/chat" replace /> },
          { path: '/consents', element: <ConsentsPage /> },
          { path: '/settings', element: <SettingsPage /> },
          {
            // Signed in + all consents of the current version (backend rule 7).
            element: <RequireConsents />,
            children: [{ path: '/chat', element: <ChatPage /> }],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
