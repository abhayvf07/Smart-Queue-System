import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import api from '../../api/axios';
import { Monitor, Clock, Users } from 'lucide-react';

const LiveDisplay = () => {
  const { socket } = useSocket();
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('all');
  const [queues, setQueues] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get('/services');
        const serviceList = res.data.data.services;
        setServices(serviceList);

        // Fetch queue for each service in parallel
        const queueData = {};
        await Promise.all(
          serviceList.map(async (s) => {
            try {
              const qRes = await api.get(`/tokens/queue-status/${s._id}`);
              queueData[s._id] = qRes.data.data;
            } catch {
              queueData[s._id] = { queue: [], stats: {} };
            }
          })
        );
        setQueues(queueData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchServices();
  }, []);

  // Real-time for all services
  useEffect(() => {
    if (!socket || services.length === 0) return;

    services.forEach((s) => {
      socket.emit('join:service', s._id);
      socket.emit('join:display', s._id);
    });

    // ONE listener, OUTSIDE the forEach — prevents N duplicate listeners
    const handleQueueUpdate = (data) => {
      if (data.length > 0 && data[0].serviceId) {
        const sid = data[0].serviceId._id || data[0].serviceId;
        setQueues((prev) => ({
          ...prev,
          [sid]: { ...prev[sid], queue: data },
        }));
      }
    };

    socket.on('queue:update', handleQueueUpdate);

    return () => {
      services.forEach((s) => socket.emit('leave:service', s._id));
      socket.off('queue:update', handleQueueUpdate); // exact same ref for proper cleanup
    };
  }, [socket, services]);

  const displayServices = selectedServiceId === 'all'
    ? services
    : services.filter((s) => s._id === selectedServiceId);

  return (
    <div className="live-display" id="live-display">
      {/* Header */}
      <div className="live-display-header">
        <div className="flex justify-between items-center" style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div>
            <h1 className="live-display-title">
              <Monitor size={32} style={{ display: 'inline', marginRight: 12 }} />
              SmartQueue Live
            </h1>
            <p className="live-display-subtitle">Real-time queue status display</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {currentTime.toLocaleTimeString()}
            </div>
            <div className="text-sm text-muted">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Service filter */}
        <div className="flex justify-center gap-2 mt-4">
          <button
            className={`btn btn-sm ${selectedServiceId === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedServiceId('all')}
          >
            All Services
          </button>
          {services.map((s) => (
            <button
              key={s._id}
              className={`btn btn-sm ${selectedServiceId === s._id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedServiceId(s._id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Display Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(400px, 1fr))`,
          gap: 24,
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {displayServices.map((service) => {
          const queueData = queues[service._id] || { queue: [], stats: {} };
          const serving = queueData.queue?.find((t) => t.status === 'serving');
          const waiting = queueData.queue?.filter((t) => t.status === 'waiting') || [];

          return (
            <div key={service._id} className="card" style={{ overflow: 'hidden' }}>
              {/* Service header */}
              <div
                className="flex justify-between items-center"
                style={{
                  padding: '16px 20px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  margin: '-24px -24px 20px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    {service.name}
                  </h2>
                  <div className="text-xs text-muted">
                    Prefix: {service.prefix}
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="badge badge-warning">
                    <Users size={10} /> {waiting.length} waiting
                  </span>
                </div>
              </div>

              {/* Currently Serving */}
              {serving ? (
                <div className="live-current-token" style={{ padding: 28, marginBottom: 20 }}>
                  <div className="live-current-label" style={{ fontSize: '0.8rem' }}>
                    NOW SERVING
                  </div>
                  <div className="live-current-number" style={{ fontSize: '4rem' }}>
                    {serving.tokenNumber}
                  </div>
                  <div className="live-current-service">
                    {serving.userId?.name || ''}
                  </div>
                </div>
              ) : (
                <div
                  className="text-center text-muted"
                  style={{
                    padding: 28,
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 20,
                  }}
                >
                  <Clock size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                  <div>No one being served</div>
                </div>
              )}

              {/* Next in line */}
              {waiting.length > 0 && (
                <div>
                  <div
                    className="text-xs text-muted"
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    Up Next
                  </div>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {waiting.slice(0, 8).map((token, i) => (
                      <div
                        key={token._id}
                        className={`live-queue-item ${i === 0 ? 'next' : ''}`}
                        style={{ minWidth: 80, flex: 'none' }}
                      >
                        <div
                          className="live-queue-number"
                          style={{ fontSize: i === 0 ? '1.5rem' : '1.1rem' }}
                        >
                          {token.tokenNumber}
                        </div>
                        {token.priority === 'emergency' && (
                          <span className="badge badge-emergency" style={{ fontSize: '0.6rem' }}>
                            URGENT
                          </span>
                        )}
                      </div>
                    ))}
                    {waiting.length > 8 && (
                      <div
                        className="live-queue-item"
                        style={{
                          minWidth: 80,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span className="text-muted">+{waiting.length - 8} more</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveDisplay;
