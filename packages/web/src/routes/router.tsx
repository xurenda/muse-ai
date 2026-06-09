import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/app-layout'
import { SettingsLayout } from '@/layouts/settings-layout'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { GeneralSettingsPage } from '@/pages/settings/general-settings-page'
import { ModelsSettingsPage } from '@/pages/settings/models-settings-page'

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
        element: <SettingsLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="general" replace />,
          },
          {
            path: 'general',
            element: <GeneralSettingsPage />,
          },
          {
            path: 'models',
            element: <ModelsSettingsPage />,
          },
        ],
      },
    ],
  },
])
