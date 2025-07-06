import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
} from '@tanstack/react-router'
import Dashboard from './Dashboard'
import EditQuestion from './EditQuestion'
import CreateQuestion from './CreateQuestion'

const rootRoute = createRootRoute({
  component: App,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

export const editQuestionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/questions/$id/edit',
  component: EditQuestion,
})

export const createQuestionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/questions/new',
  component: CreateQuestion,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  editQuestionRoute,
  createQuestionRoute,
])

const router = createRouter({
  routeTree,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
