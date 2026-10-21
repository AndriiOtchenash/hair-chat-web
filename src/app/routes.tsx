import type { RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { MePage } from '@/features/me/MePage'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [{ index: true, element: <MePage /> }],
      },
      { path: '*', element: <LoginPage /> },
    ],
  },
]
