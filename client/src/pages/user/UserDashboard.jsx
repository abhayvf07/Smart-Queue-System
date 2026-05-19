import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/axios';
import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

const UserDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  const fetchTokens = async () => {
    try {
      const res = await api.get('/tokens/my-tokens');
      setTokens(res.data.data.tokens);
    } catch (err) {
      console.error('Error fetching tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleTokenCalled = (data) => {
      toast.success(`🎉 Your token ${data.tokenNumber} is being called!`, {
        duration: 8000,
        style: {
          background: '#0f172a',
          color: '#f1f5f9',
          border: '1px solid #10b981',
        },
      });
      fetchTokens();
    };

    const handleTokenApproaching = (data) => {
      toast(`⏳ You're almost up! Position: ${data.position}`, {
        duration: 5000,
        icon: '🔔',
        style: {
          background: '#0f172a',
          color: '#f1f5f9',
          border: '1px solid #f59e0b',
        },
      });
      fetchTokens();
    };

    socket.on('token:called', handleTokenCalled);
    socket.on('token:approaching', handleTokenApproaching);

    return () => {
      socket.off('token:called', handleTokenCalled);
      socket.off('token:approaching', handleTokenApproaching);
    };
  }, [socket]);

  const handleCancel = async (tokenId) => {
    try {
      await api.put(`/tokens/cancel/${tokenId}`);
      toast.success('Token cancelled.');
      setConfirmCancelId(null);
      fetchTokens();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel.');
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      waiting: { class: 'badge-warning', label: 'Waiting' },
      serving: { class: 'badge-success', label: 'Now Serving' },
      completed: { class: 'badge-muted', label: 'Completed' },
      skipped: { class: 'badge-danger', label: 'Skipped' },
      cancelled: { class: 'badge-muted', label: 'Cancelled' },
    };
    const s = map[status] || { class: 'badge-muted', label: status };
    return <span className={`badge ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="animate-in" id="user-dashboard">
      <div className="page-header">
        <h1>Welcome, {user?.name} 👋</h1>
        <p>Track your queue position and manage your tokens</p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon primary">
            <Ticket size={22} />
          </div>
          <div>
            <div className="stat-value">{tokens.length}</div>
            <div className="stat-label">Active Tokens</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon warning">
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">
              {tokens.filter((t) => t.status === 'waiting').length}
            </div>
            <div className="stat-label">In Queue</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon success">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">
              {tokens.filter((t) => t.status === 'serving').length}
            </div>
            <div className="stat-label">Being Served</div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <Link to="/book-token" className="btn btn-primary" id="book-token-btn">
          <Plus size={18} />
          Book New Token
        </Link>
        <button className="btn btn-ghost" onClick={fetchTokens} id="refresh-btn">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Active Tokens */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Your Active Tokens</h2>
            <p className="card-subtitle">Real-time position updates</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center" style={{ padding: 40 }}>
            <div className="spinner"></div>
          </div>
        ) : tokens.length === 0 ? (
          <div className="empty-state">
            <Ticket size={64} />
            <h3>No Active Tokens</h3>
            <p>Book a token to join a queue and track your position in real-time.</p>
            <Link to="/book-token" className="btn btn-primary mt-4">
              <Plus size={18} /> Book Token
            </Link>
          </div>
        ) : (
          <div className="grid-auto">
            {tokens.map((token) => (
              <div
                key={token._id}
                className={`token-card ${token.status === 'serving' ? 'serving' : ''} ${
                  token.priority === 'emergency' ? 'emergency' : ''
                }`}
                id={`token-${token.tokenNumber}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="token-number">{token.tokenNumber}</div>
                  {token.priority === 'emergency' && (
                    <span className="badge badge-emergency">
                      <AlertTriangle size={12} /> Emergency
                    </span>
                  )}
                </div>
                <div className="token-service">
                  {token.serviceId?.name || 'Unknown Service'}
                </div>
                <div className="token-meta mb-4">
                  {getStatusBadge(token.status)}
                  {token.status === 'waiting' && token.position && (
                    <span className="text-sm text-muted">
                      Position: <strong style={{ color: 'var(--primary-light)' }}>#{token.position}</strong>
                    </span>
                  )}
                </div>

                {/* Queue Position Bar */}
                {token.status === 'waiting' && token.position && (
                  <div className="queue-position-bar" style={{ marginBottom: 12 }}>
                    <div className="queue-position-number">#{token.position}</div>
                    <div className="queue-position-info">
                      <div className="queue-position-label">
                        {token.position <= 2
                          ? '🔥 Almost your turn!'
                          : `${token.position - 1} ahead of you`}
                      </div>
                      <div className="queue-progress">
                        <div
                          className="queue-progress-fill"
                          style={{
                            width: `${Math.max(10, 100 - (token.position - 1) * 15)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {token.status === 'serving' && (
                  <div
                    className="flex items-center gap-2 animate-pulse"
                    style={{
                      padding: '10px 16px',
                      background: 'var(--success-glow)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--success-light)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    <CheckCircle2 size={16} />
                    It's your turn! Please proceed.
                  </div>
                )}

                <div className="flex gap-2">
                  {token.status === 'waiting' && (
                    confirmCancelId === token._id ? (
                      <>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancel(token._id)}
                          id={`confirm-cancel-${token.tokenNumber}`}
                        >
                          Yes, Cancel
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirmCancelId(null)}
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmCancelId(token._id)}
                        id={`cancel-${token.tokenNumber}`}
                      >
                        Cancel
                      </button>
                    )
                  )}
                  <Link
                    to={`/queue/${token.serviceId?._id}`}
                    className="btn btn-ghost btn-sm"
                  >
                    View Queue <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
