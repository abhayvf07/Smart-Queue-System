import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Ticket,
  TrendingUp,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentTokens, setRecentTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, tokensRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/tokens?limit=5'),
      ]);
      setStats(analyticsRes.data.data);
      setRecentTokens(tokensRes.data.data.tokens);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates — refresh dashboard when queue changes
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => fetchData();

    socket.on('queue:update', handleUpdate);
    socket.on('queue:stats', handleUpdate);

    return () => {
      socket.off('queue:update', handleUpdate);
      socket.off('queue:stats', handleUpdate);
    };
  }, [socket, fetchData]);

  const getStatusBadge = (status) => {
    const map = {
      waiting: { class: 'badge-warning', label: 'Waiting' },
      serving: { class: 'badge-success', label: 'Serving' },
      completed: { class: 'badge-muted', label: 'Done' },
      skipped: { class: 'badge-danger', label: 'Skipped' },
      cancelled: { class: 'badge-muted', label: 'Cancelled' },
    };
    const s = map[status] || { class: 'badge-muted', label: status };
    return <span className={`badge ${s.class}`}>{s.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center" style={{ padding: 60 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-in" id="admin-dashboard">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Overview of queue operations and performance</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon primary">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">{stats?.totalCompleted || 0}</div>
            <div className="stat-label">Completed Today</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon warning">
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{stats?.avgWaitMinutes || 0}m</div>
            <div className="stat-label">Avg Wait Time</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon success">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="stat-value">
              {stats?.serviceBreakdown?.length || 0}
            </div>
            <div className="stat-label">Active Services</div>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon danger">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="stat-value">
              {stats?.peakHours?.[0]
                ? `${stats.peakHours[0].hour}:00`
                : 'N/A'}
            </div>
            <div className="stat-label">Peak Hour</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid-2 mb-6">
        <Link to="/admin/queue" className="card" style={{ textDecoration: 'none' }}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="card-title">Queue Control</h3>
              <p className="text-sm text-muted mt-1">
                Call next, skip, and manage active queues
              </p>
            </div>
            <ArrowRight size={20} style={{ color: 'var(--primary)' }} />
          </div>
        </Link>
        <Link to="/admin/services" className="card" style={{ textDecoration: 'none' }}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="card-title">Manage Services</h3>
              <p className="text-sm text-muted mt-1">
                Add, edit, or deactivate queue services
              </p>
            </div>
            <ArrowRight size={20} style={{ color: 'var(--primary)' }} />
          </div>
        </Link>
      </div>

      {/* Service Breakdown */}
      {stats?.serviceBreakdown?.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="card-title">Service Breakdown (Today)</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Waiting</th>
                  <th>Serving</th>
                  <th>Completed</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {stats.serviceBreakdown.map((sb) => {
                  const getCount = (status) =>
                    sb.statuses.find((s) => s.status === status)?.count || 0;
                  return (
                    <tr key={sb._id}>
                      <td style={{ fontWeight: 600 }}>{sb.serviceName}</td>
                      <td>
                        <span className="badge badge-warning">{getCount('waiting')}</span>
                      </td>
                      <td>
                        <span className="badge badge-success">{getCount('serving')}</span>
                      </td>
                      <td>
                        <span className="badge badge-primary">{getCount('completed')}</span>
                      </td>
                      <td>
                        <span className="badge badge-danger">{getCount('skipped')}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Tokens */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Tokens</h2>
          <Link to="/admin/queue" className="btn btn-ghost btn-sm">
            View All <ArrowRight size={14} />
          </Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>User</th>
                <th>Service</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTokens.map((token) => (
                <tr key={token._id}>
                  <td style={{ fontWeight: 700 }}>{token.tokenNumber}</td>
                  <td>{token.userId?.name || 'N/A'}</td>
                  <td>{token.serviceId?.name || 'N/A'}</td>
                  <td>{getStatusBadge(token.status)}</td>
                  <td>
                    {token.priority === 'emergency' ? (
                      <span className="badge badge-emergency">
                        <AlertTriangle size={10} /> Emergency
                      </span>
                    ) : (
                      <span className="badge badge-muted">Normal</span>
                    )}
                  </td>
                  <td className="text-muted text-sm">
                    {new Date(token.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
