import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  PlayCircle,
  SkipForward,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';

const QueueControl = () => {
  const { socket } = useSocket();
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);

  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get('/services');
        setServices(res.data.data.services);
        if (res.data.data.services.length > 0) {
          setSelectedServiceId(res.data.data.services[0]._id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchServices();
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!selectedServiceId) return;
    try {
      const res = await api.get(`/tokens/queue-status/${selectedServiceId}`);
      setQueue(res.data.data.queue);
      setStats(res.data.data.stats);
    } catch (err) {
      console.error(err);
    }
  }, [selectedServiceId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Real-time updates
  useEffect(() => {
    if (!socket || !selectedServiceId) return;

    socket.emit('join:service', selectedServiceId);

    const handleQueueUpdate = (data) => setQueue(data.queue ? data.queue : data);
    const handleStatsUpdate = (data) => setStats(data);

    socket.on('queue:update', handleQueueUpdate);
    socket.on('queue:stats', handleStatsUpdate);

    return () => {
      socket.emit('leave:service', selectedServiceId);
      socket.off('queue:update', handleQueueUpdate);
      socket.off('queue:stats', handleStatsUpdate);
    };
  }, [socket, selectedServiceId]);

  const handleCallNext = async () => {
    setActionLoading('call');
    try {
      const res = await api.put(`/admin/call-next/${selectedServiceId}`);
      toast.success(res.data.message);
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to call next.');
    } finally {
      setActionLoading('');
    }
  };

  const handleUpdateStatus = async (tokenId, status) => {
    setActionLoading(tokenId);
    try {
      await api.put(`/admin/update-status/${tokenId}`, { status });
      toast.success(`Token ${status}.`);
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update.');
    } finally {
      setActionLoading('');
    }
  };

  const handleEmergencyToken = async () => {
    if (!selectedServiceId) return;
    setActionLoading('emergency');
    try {
      const res = await api.post('/admin/emergency-token', {
        serviceId: selectedServiceId,
      });
      toast.success(res.data.message);
      fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create emergency token.');
    } finally {
      setActionLoading('');
    }
  };

  const servingToken = queue.find((t) => t.status === 'serving');
  const waitingTokens = queue.filter((t) => t.status === 'waiting');

  return (
    <div className="animate-in" id="queue-control">
      <div className="page-header">
        <h1>Queue Control</h1>
        <p>Manage active queues and call patients</p>
      </div>

      {/* Service Selector */}
      <div className="flex gap-3 items-center mb-6" style={{ flexWrap: 'wrap' }}>
        <select
          className="form-input form-select"
          style={{ maxWidth: 300 }}
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          id="service-selector"
        >
          {services.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name} ({s.prefix})
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={fetchQueue}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

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
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon warning">
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{stats?.avgWaitMinutes || 0}m</div>
            <div className="stat-label">Avg Wait</div>
          </div>
        </div>
      </div>

      {/* Currently Serving */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title">Currently Serving</h2>
        </div>
        {servingToken ? (
          <div className="flex items-center gap-4" style={{ padding: '12px 0' }}>
            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'var(--success-light)',
                minWidth: 120,
                textAlign: 'center',
              }}
            >
              {servingToken.tokenNumber}
            </div>
            <div style={{ flex: 1 }}>
              <div className="font-bold">{servingToken.userId?.name || 'N/A'}</div>
              <div className="text-sm text-muted">
                Called at {new Date(servingToken.calledAt).toLocaleTimeString()}
              </div>
            </div>
            <button
              className="btn btn-success btn-sm"
              onClick={() => handleUpdateStatus(servingToken._id, 'completed')}
              disabled={actionLoading === servingToken._id}
            >
              <CheckCircle2 size={16} /> Complete
            </button>
            <button
              className="btn btn-warning btn-sm"
              onClick={() => handleUpdateStatus(servingToken._id, 'skipped')}
              disabled={actionLoading === servingToken._id}
            >
              <SkipForward size={16} /> Skip
            </button>
          </div>
        ) : (
          <p className="text-muted" style={{ padding: '16px 0' }}>
            No one is being served right now.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleCallNext}
          disabled={actionLoading === 'call' || waitingTokens.length === 0}
          id="call-next-btn"
        >
          {actionLoading === 'call' ? (
            <>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
              Calling...
            </>
          ) : (
            <>
              <PlayCircle size={20} />
              Call Next ({waitingTokens.length})
            </>
          )}
        </button>
        <button
          className="btn btn-danger"
          onClick={handleEmergencyToken}
          disabled={actionLoading === 'emergency'}
          id="emergency-btn"
        >
          {actionLoading === 'emergency' ? (
            <>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
              Creating...
            </>
          ) : (
            <>
              <Zap size={18} />
              Emergency Token
            </>
          )}
        </button>
      </div>

      {/* Waiting Queue */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Waiting Queue</h2>
          <span className="badge badge-warning">{waitingTokens.length} waiting</span>
        </div>

        {waitingTokens.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={48} />
            <h3>Queue is Clear!</h3>
            <p>All patients have been served.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Priority</th>
                  <th>Booked At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {waitingTokens.map((token, i) => (
                  <tr key={token._id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 700, fontSize: '1rem' }}>{token.tokenNumber}</td>
                    <td>{token.userId?.name || 'N/A'}</td>
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
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleUpdateStatus(token._id, 'skipped')}
                          disabled={actionLoading === token._id}
                        >
                          <SkipForward size={14} /> Skip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueControl;
