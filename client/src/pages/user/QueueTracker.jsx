import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/axios';
import { ArrowLeft, Users, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

const QueueTracker = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { socket, joinService, leaveService } = useSocket();

  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const isValidId = /^[0-9a-fA-F]{24}$/.test(serviceId);

  const fetchQueue = async () => {
    if (!isValidId) return;
    try {
      const res = await api.get(`/tokens/queue-status/${serviceId}`);
      setQueue(res.data.data.queue);
      setStats(res.data.data.stats);
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isValidId) {
      setLoading(false);
      return;
    }
    fetchQueue();
    joinService(serviceId);
    return () => leaveService(serviceId);
  }, [serviceId, isValidId]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleQueueUpdate = (data) => setQueue(data);
    const handleStatsUpdate = (data) => setStats(data);

    socket.on('queue:update', handleQueueUpdate);
    socket.on('queue:stats', handleStatsUpdate);

    return () => {
      socket.off('queue:update', handleQueueUpdate);
      socket.off('queue:stats', handleStatsUpdate);
    };
  }, [socket]);

  const waitingTokens = queue.filter((t) => t.status === 'waiting');
  const servingToken = queue.find((t) => t.status === 'serving');

  return (
    <div className="animate-in" id="queue-tracker">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Live Queue</h1>
            <p>Real-time queue tracking</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: 60 }}>
          <div className="spinner"></div>
        </div>
      ) : !isValidId ? (
        <div className="empty-state">
          <AlertTriangle size={48} />
          <h3>Service Not Found</h3>
          <p>The queue you are looking for does not exist.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-icon primary">
                <Users size={22} />
              </div>
              <div>
                <div className="stat-value">{stats?.waiting || 0}</div>
                <div className="stat-label">Waiting</div>
              </div>
            </div>
            <div className="stat-card success">
              <div className="stat-icon success">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="stat-value">{stats?.completedToday || 0}</div>
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
          </div>

          {/* Currently Serving */}
          {servingToken && (
            <div className="live-current-token mb-6" style={{ padding: 32 }}>
              <div className="live-current-label">Now Serving</div>
              <div className="live-current-number" style={{ fontSize: '3.5rem' }}>
                {servingToken.tokenNumber}
              </div>
              <div className="live-current-service">
                {servingToken.userId?.name || 'Anonymous'}
              </div>
            </div>
          )}

          {/* Waiting Queue */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Waiting Queue ({waitingTokens.length})</h2>
            </div>

            {waitingTokens.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={48} />
                <h3>Queue is Empty</h3>
                <p>No one is currently waiting.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Token</th>
                      <th>Name</th>
                      <th>Priority</th>
                      <th>Booked At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingTokens.map((token, i) => (
                      <tr key={token._id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>
                          {i + 1}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: '1rem' }}>
                          {token.tokenNumber}
                        </td>
                        <td>{token.userId?.name || 'Anonymous'}</td>
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
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default QueueTracker;
