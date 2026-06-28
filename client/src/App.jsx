import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ChatBot from './components/ChatBot';

// Layout
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// User pages
import UserDashboard from './pages/user/UserDashboard';
import BookToken from './pages/user/BookToken';
import QueueTracker from './pages/user/QueueTracker';
import TokenHistory from './pages/user/TokenHistory';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import QueueControl from './pages/admin/QueueControl';
import ServiceManager from './pages/admin/ServiceManager';
import Analytics from './pages/admin/Analytics';

// Display
import LiveDisplay from './pages/display/LiveDisplay';

/**
 * Shared layout for user routes (Navbar only, no sidebar).
 */
const UserLayout = ({ children, toggleSidebar, isSidebarOpen }) => (
  <div className="app-layout">
    <Navbar onMenuToggle={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    <main className="main-content no-sidebar">{children}</main>
  </div>
);

/**
 * Shared layout for admin routes (Sidebar + Navbar).
 */
const AdminLayout = ({ children, toggleSidebar, isSidebarOpen, closeSidebar }) => (
  <div className="app-layout">
    <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
    <Navbar onMenuToggle={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    <main className="main-content">{children}</main>
  </div>
);

const AppLayout = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <span className="text-muted">Loading SmartQueue...</span>
      </div>
    );
  }

  return (
    <SocketProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          isAuthenticated
            ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />
            : <Login />
        } />
        <Route path="/register" element={
          isAuthenticated
            ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />
            : <Register />
        } />
        <Route path="/display" element={<LiveDisplay />} />

        {/* User routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute requiredRole="user">
            <UserLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen}>
              <UserDashboard />
            </UserLayout>
          </ProtectedRoute>
        } />
        <Route path="/book-token" element={
          <ProtectedRoute requiredRole="user">
            <UserLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen}>
              <BookToken />
            </UserLayout>
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute requiredRole="user">
            <UserLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen}>
              <TokenHistory />
            </UserLayout>
          </ProtectedRoute>
        } />
        <Route path="/queue/:serviceId" element={
          <ProtectedRoute requiredRole="user">
            <UserLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen}>
              <QueueTracker />
            </UserLayout>
          </ProtectedRoute>
        } />

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} closeSidebar={closeSidebar}>
              <AdminDashboard />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/queue" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} closeSidebar={closeSidebar}>
              <QueueControl />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/services" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} closeSidebar={closeSidebar}>
              <ServiceManager />
            </AdminLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} closeSidebar={closeSidebar}>
              <Analytics />
            </AdminLayout>
          </ProtectedRoute>
        } />

        {/* Default redirect */}
        <Route path="/" element={
          isAuthenticated
            ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />
            : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isAuthenticated && !location.pathname.includes('/display') && <ChatBot />}
    </SocketProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0f172a',
              color: '#f1f5f9',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '10px',
              fontFamily: "'Inter', sans-serif",
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            },
          }}
        />
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
