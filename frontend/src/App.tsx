import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ToastContext, useToastState } from '@/hooks/useToast'
import Login from '@/pages/Login'
import MainLayout from '@/components/MainLayout'
import Toaster from '@/components/Toaster'
import { PWAInstallBanner } from '@/components/PWAInstallBanner'
import { Loader2 } from 'lucide-react'

const Dashboard    = lazy(() => import('@/pages/Dashboard'))
const NewProject   = lazy(() => import('@/pages/NewProject'))
const EditProject  = lazy(() => import('@/pages/EditProject'))
const Projects     = lazy(() => import('@/pages/Projects'))
const ProjectDetail= lazy(() => import('@/pages/ProjectDetail'))
const Pricing      = lazy(() => import('@/pages/Pricing'))
const AdminPanel   = lazy(() => import('@/pages/AdminPanel'))
const MySettings   = lazy(() => import('@/pages/MySettings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary-500" size={28} />
    </div>
  )
}

function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const toastState = useToastState()

  return (
    <ToastContext.Provider value={toastState}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="projects/:id/edit" element={<EditProject />} />
              <Route path="new" element={<NewProject />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="settings" element={<MySettings />} />
              <Route
                path="admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
      <PWAInstallBanner />
    </ToastContext.Provider>
  )
}
