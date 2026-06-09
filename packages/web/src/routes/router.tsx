import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/app-layout'
import { PlaceholderPage } from '@/pages/placeholder-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/new-chat" replace />,
      },
      {
        path: 'new-chat',
        element: <PlaceholderPage titleKey="pages.newChat" />,
      },
      {
        path: 'skills',
        element: <PlaceholderPage titleKey="pages.skills" />,
      },
      {
        path: 'settings',
        element: <PlaceholderPage titleKey="pages.setting" />,
      },
    ],
  },
])
