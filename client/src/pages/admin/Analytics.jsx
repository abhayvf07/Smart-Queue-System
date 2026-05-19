import { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  BarChart3,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [analyticsRes, servicesRes] = await Promise.all([
        api.get(`/admin/analytics${selectedService ? `?serviceId=${selectedService}` : ''}`),
        api.get('/services'),
      ]);
      setAnalytics(analyticsRes.data.data);
      setServices(servicesRes.data.data.services);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedService]);

  // Use server-side aggregated counts (accurate for all tokens, not just latest 50)
  const statusCounts = analytics?.statusCounts || {};
  const priorityCounts = analytics?.priorityCounts || {};
  const totalTokens = analytics?.totalTokensToday || 0;

  // Bar chart helpers — simple CSS-based chart
  const StatusBar = ({ label, count, total, color }) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div style={{ marginBottom: 16 }}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm" style={{ fontWeight: 600 }}>{label}</span>
          <span className="text-sm text-muted">{count} ({pct}%)</span>
        </div>
        <div style={{
          width: '100%',
          height: 8,
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center" style={{ padding: 60 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-in" id="analytics-page">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>📊 Analytics & Metrics</h1>
            <p>Queue performance, throughput, and insights</p>
          </div>
          <select
            className="form-input form-select"
            style={{ maxWidth: 260 }}
            value={selectedService}
            onChange={(e) => {
              setSelectedService(e.target.value);
              setLoading(true);
            }}
            id="analytics-service-filter"
          >
            <option value="">All Services</option>
            {services.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.prefix})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon primary">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">{analytics?.totalCompleted || 0}</div>
            <div className="stat-label">Completed Today</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon warning">
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{analytics?.avgWaitMinutes || 0}m</div>
            <div className="stat-label">Avg Wait Time</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon success">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="stat-value">{totalTokens}</div>
            <div className="stat-label">Total Tokens Today</div>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon danger">
            <Zap size={22} />
          </div>
          <div>
            <div className="stat-value">{priorityCounts.emergency || 0}</div>
            <div className="stat-label">Emergency Tokens</div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid-2 mb-6">
        {/* Token Status Distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Token Status Distribution</h2>
              <p className="card-subtitle">Today's breakdown by status</p>
            </div>
            <Activity size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <StatusBar label="✅ Completed" count={statusCounts.completed || 0} total={totalTokens} color="var(--success)" />
          <StatusBar label="⏳ Waiting" count={statusCounts.waiting || 0} total={totalTokens} color="var(--warning)" />
          <StatusBar label="🟢 Serving" count={statusCounts.serving || 0} total={totalTokens} color="var(--primary)" />
          <StatusBar label="⏭️ Skipped" count={statusCounts.skipped || 0} total={totalTokens} color="var(--danger)" />
          <StatusBar label="❌ Cancelled" count={statusCounts.cancelled || 0} total={totalTokens} color="var(--text-muted)" />
        </div>

        {/* Peak Hours */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Peak Hours</h2>
              <p className="card-subtitle">Busiest times today</p>
            </div>
            <Calendar size={20} style={{ color: 'var(--warning)' }} />
          </div>
          {analytics?.peakHours?.length > 0 ? (
            <div>
              {analytics.peakHours.map((ph, i) => {
                const maxCount = analytics.peakHours[0].count;
                const pct = Math.round((ph.count / maxCount) * 100);
                const hourLabel = `${String(ph.hour).padStart(2, '0')}:00 - ${String(ph.hour + 1).padStart(2, '0')}:00`;
                return (
                  <div key={ph.hour} style={{ marginBottom: 18 }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="flex items-center gap-2">
                        {i === 0 && <span style={{ color: 'var(--warning)' }}>🔥</span>}
                        <span className="text-sm" style={{ fontWeight: 600 }}>{hourLabel}</span>
                      </span>
                      <span className="text-sm" style={{ fontWeight: 700, color: i === 0 ? 'var(--warning-light)' : 'var(--text-secondary)' }}>
                        {ph.count} tokens
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: 8,
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: i === 0
                          ? 'linear-gradient(90deg, var(--warning), var(--warning-light))'
                          : 'var(--warning)',
                        borderRadius: 'var(--radius-full)',
                        opacity: 1 - (i * 0.15),
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <BarChart3 size={40} />
              <h3>No Data Yet</h3>
              <p>Peak hours will appear as tokens are processed.</p>
            </div>
          )}
        </div>
      </div>

      {/* Service Breakdown */}
      {analytics?.serviceBreakdown?.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <div>
              <h2 className="card-title">Service Performance</h2>
              <p className="card-subtitle">Breakdown by service today</p>
            </div>
            <BarChart3 size={20} style={{ color: 'var(--success)' }} />
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
                  <th>Cancelled</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {analytics.serviceBreakdown.map((sb) => {
                  const getCount = (status) =>
                    sb.statuses.find((s) => s.status === status)?.count || 0;
                  const total = sb.statuses.reduce((sum, s) => sum + s.count, 0);
                  return (
                    <tr key={sb._id}>
                      <td style={{ fontWeight: 700 }}>{sb.serviceName}</td>
                      <td><span className="badge badge-warning">{getCount('waiting')}</span></td>
                      <td><span className="badge badge-primary">{getCount('serving')}</span></td>
                      <td><span className="badge badge-success">{getCount('completed')}</span></td>
                      <td><span className="badge badge-danger">{getCount('skipped')}</span></td>
                      <td><span className="badge badge-muted">{getCount('cancelled')}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Key Performance Indicators</h2>
            <p className="card-subtitle">System health metrics</p>
          </div>
        </div>
        <div className="grid-3" style={{ gap: 16 }}>
          <div style={{
            padding: 20,
            background: 'rgba(59, 130, 246, 0.06)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
          }}>
            <div className="text-xs text-muted mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Throughput
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {analytics?.totalCompleted || 0}
              <span className="text-sm text-muted" style={{ fontWeight: 400 }}> /day</span>
            </div>
            <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
              <ArrowUpRight size={12} />
              Tokens completed today
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'rgba(245, 158, 11, 0.06)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
          }}>
            <div className="text-xs text-muted mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Avg Response Time
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {analytics?.avgWaitMinutes || 0}
              <span className="text-sm text-muted" style={{ fontWeight: 400 }}> min</span>
            </div>
            <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.75rem', color: analytics?.avgWaitMinutes > 15 ? 'var(--danger)' : 'var(--success)' }}>
              {analytics?.avgWaitMinutes > 15 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {analytics?.avgWaitMinutes > 15 ? 'Above target (15m)' : 'Below target (15m)'}
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'rgba(139, 92, 246, 0.06)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
          }}>
            <div className="text-xs text-muted mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Completion Rate
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {totalTokens > 0
                ? Math.round(((statusCounts.completed || 0) / totalTokens) * 100)
                : 0}
              <span className="text-sm text-muted" style={{ fontWeight: 400 }}>%</span>
            </div>
            <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.75rem', color: 'var(--secondary-light)' }}>
              <Activity size={12} />
              Completed / Total
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
