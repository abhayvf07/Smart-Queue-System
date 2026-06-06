import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { LogOut, Wifi, WifiOff, Menu } from 'lucide-react';

const Navbar = ({ onMenuToggle, isSidebarOpen }) => {
  const { user, logout, isAdmin } = useAuth();
  const { connected } = useSocket();

  return (
    <nav className={`navbar ${!isAdmin ? 'full-width' : ''}`} id="main-navbar">
      <div className="flex items-center gap-3">
        <button
          className="btn btn-ghost btn-sm md:hidden"
          onClick={onMenuToggle}
          id="menu-toggle-btn"
        >
          <Menu size={18} />
        </button>
        {!isAdmin && (
          <div className="navbar-brand">
            <div className="logo-icon">⚡</div>
            SmartQueue
          </div>
        )}
      </div>

      <div className="navbar-user">
        <div className="flex items-center gap-2" style={{ fontSize: '0.75rem' }}>
          {connected ? (
            <span className="flex items-center gap-1" style={{ color: 'var(--success)' }}>
              <Wifi size={14} /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1" style={{ color: 'var(--danger)' }}>
              <WifiOff size={14} /> Offline
            </span>
          )}
        </div>

        {user && (
          <>
            <div className="navbar-user-info">
              <div className="name">{user.name}</div>
              <div className="role">{user.role}</div>
            </div>
            <div className="navbar-avatar" id="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout} id="logout-btn">
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
