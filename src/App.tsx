import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { SeriesDetail } from './pages/SeriesDetail';
import { Reader } from './pages/Reader';
import { Profile } from './pages/Profile';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { SeriesManagement } from './pages/admin/SeriesManagement';
import { ChapterManagement } from './pages/admin/ChapterManagement';
import { AutoImport } from './pages/admin/AutoImport';
import { UserManagement } from './pages/admin/UserManagement';
import { CommentModeration } from './pages/admin/CommentModeration';
import { PageManagement } from './pages/admin/PageManagement';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
            <Routes>
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="series" element={<SeriesManagement />} />
                <Route path="chapters" element={<ChapterManagement />} />
                <Route path="import" element={<AutoImport />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="comments" element={<CommentModeration />} />
                <Route path="pages" element={<PageManagement />} />
                <Route path="analytics" element={<div>Analytics Page (Coming Soon)</div>} />
              </Route>

              {/* Main Site Routes */}
              <Route
                path="*"
                element={
                  <>
                    <Navbar />
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/series/:slug" element={<SeriesDetail />} />
                      <Route path="/series/:slug/:chapterNum" element={<Reader />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/manga" element={<div className="p-20 text-center">Manga List Page</div>} />
                      <Route path="/manhwa" element={<div className="p-20 text-center">Manhwa List Page</div>} />
                      <Route path="/novels" element={<div className="p-20 text-center">Novels List Page</div>} />
                      <Route path="/search" element={<div className="p-20 text-center">Search Results Page</div>} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    <BottomNav />
                  </>
                }
              />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
