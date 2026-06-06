import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListOrdered,
  Settings,
  BarChart3,
  Monitor,
  Zap,
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/admin/queue', icon: ListOrdered, label: 'Queue Control' },
    { to: '/admin/services', icon: Settings, label: 'Manage Services' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  const otherLinks = [
    { to: '/display', icon: Monitor, label: 'Live Display' },
  ];

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="admin-sidebar">
        <div className="sidebar-header">
        <div className="sidebar-logo">⚡</div>
        <div>
          <div className="sidebar-title">SmartQueue</div>
          <div className="sidebar-subtitle">Admin Panel</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Management</div>
          {adminLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              id={`sidebar-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <link.icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Display</div>
          {otherLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              id={`sidebar-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <link.icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="text-xs text-muted">
          © 2026 SmartQueue System
        </div>
      </div>
    </aside>
    {isOpen && (
      <div 
        className="sidebar-overlay fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
    )}
    </>
  );
};

export default Sidebar;
