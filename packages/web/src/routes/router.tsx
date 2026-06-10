import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/app-layout'
import { SettingsLayout } from '@/layouts/settings-layout'
import { ChatPage } from '@/pages/chat/chat-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { GeneralSettingsPage } from '@/pages/settings/general-settings-page'
import { ModelsSettingsPage } from '@/pages/settings/models-settings-page'
import { ProvidersSettingsPage } from '@/pages/settings/providers-settings-page'

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
        element: <ChatPage />,
      },
      {
        path: 'chat/:sessionId',
        element: <ChatPage />,
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
          {
            path: 'providers',
            element: <ProvidersSettingsPage />,
          },
        ],
      },
    ],
  },
])
