import { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  BarChart3,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Brain,
  Sparkles,
  SmilePlus,
  Meh,
  Frown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = {
  completed: '#10b981', // green
  waiting: '#f59e0b',   // amber
  serving: '#3b82f6',   // blue
  skipped: '#ef4444',   // red
  cancelled: '#64748b', // slate
};

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#f59e0b',
  frustrated: '#ef4444',
};

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState(null);
  const [sentiment, setSentiment] = useState(null);

  const fetchAll = async () => {
    try {
      const results = await Promise.allSettled([
        api.get(`/admin/analytics${selectedService ? `?serviceId=${selectedService}` : ''}`),
        api.get('/services'),
        api.get(`/admin/forecast${selectedService ? `?serviceId=${selectedService}` : ''}`),
        api.get('/admin/sentiment?days=7'),
      ]);
      setAnalytics(results[0].status === 'fulfilled' ? results[0].value.data.data : null);
      setServices(results[1].status === 'fulfilled' ? results[1].value.data.data.services : []);
      setForecast(results[2].status === 'fulfilled' ? results[2].value.data.data : null);
      setSentiment(results[3].status === 'fulfilled' ? results[3].value.data.data : null);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedService]);

  if (loading) {
    return (
      <div className="flex justify-center" style={{ padding: 60 }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const statusCounts = analytics?.statusCounts || {};
  const priorityCounts = analytics?.priorityCounts || {};
  const totalTokens = analytics?.totalTokensToday || 0;

  // Prepare Pie Chart Data
  const pieData = [
    { name: 'Completed', value: statusCounts.completed || 0, color: COLORS.completed },
    { name: 'Waiting', value: statusCounts.waiting || 0, color: COLORS.waiting },
    { name: 'Serving', value: statusCounts.serving || 0, color: COLORS.serving },
    { name: 'Skipped', value: statusCounts.skipped || 0, color: COLORS.skipped },
    { name: 'Cancelled', value: statusCounts.cancelled || 0, color: COLORS.cancelled },
  ].filter(item => item.value > 0);

  // Prepare Peak Hours Data
  const peakHoursData = analytics?.peakHours?.map(ph => ({
    hourLabel: `${String(ph.hour).padStart(2, '0')}:00`,
    Tokens: ph.count,
  })).sort((a, b) => a.hourLabel.localeCompare(b.hourLabel)) || [];

  // Prepare Forecast Data
  const forecastData = forecast?.forecast
    ?.filter(f => f.predictedTokens > 0)
    ?.map(f => ({
      hourLabel: `${String(f.hour).padStart(2, '0')}:00`,
      Predicted: f.predictedTokens,
    })) || [];

  // Prepare Sentiment Pie Data
  const sentimentStats = sentiment?.stats || {};
  const sentimentPieData = [
    { name: 'Positive', value: sentimentStats.positive || 0, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: sentimentStats.neutral || 0, color: SENTIMENT_COLORS.neutral },
    { name: 'Frustrated', value: sentimentStats.frustrated || 0, color: SENTIMENT_COLORS.frustrated },
  ].filter(item => item.value > 0);

  return (
    <div className="animate-in" id="analytics-page">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>📊 Analytics & Metrics</h1>
            <p>Queue performance, AI insights, and sentiment analysis</p>
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

      {/* AI-Powered Section: Forecast + Sentiment */}
      <div className="mb-4 flex items-center gap-2 text-primary-light font-bold">
        <Sparkles size={18} /> AI Insights
      </div>
      <div className="grid-2 mb-8" style={{ gap: 24 }}>
        {/* Tomorrow's Forecast */}
        <div className="card flex flex-col justify-between">
          <div className="card-header">
            <div>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Tomorrow's Forecast
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.15))',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#c084fc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  <Sparkles size={10} /> AI
                </span>
                {forecast?.confidence && (
                  <span className={`badge ${forecast.confidence === 'high' ? 'badge-success' : forecast.confidence === 'low' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                    {forecast.confidence} confidence
                  </span>
                )}
              </h2>
              <p className="card-subtitle">
                {forecast?.targetDay ? `Predicted traffic for ${forecast.targetDay}` : 'EWMA forecasting'}
              </p>
            </div>
            <Brain size={20} style={{ color: '#a78bfa' }} />
          </div>

          <div style={{ height: 260 }}>
            {forecastData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.15)" />
                  <XAxis 
                    dataKey="hourLabel" 
                    stroke="var(--text-muted)" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#0f172a', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      color: '#fff',
                      fontFamily: 'inherit'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Predicted" 
                    stroke="#a78bfa" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1} 
                    fill="url(#colorForecast)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <Brain size={40} style={{ color: '#a78bfa' }} />
                <h3>Building Forecast</h3>
                <p>Need more historical data to generate predictions.</p>
              </div>
            )}
          </div>
        </div>

        {/* Chatbot Sentiment Analysis */}
        <div className="card flex flex-col justify-between">
          <div className="card-header">
            <div>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Chatbot Sentiment
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  <Sparkles size={10} /> NLP
                </span>
              </h2>
              <p className="card-subtitle">User satisfaction from chatbot conversations (7 days)</p>
            </div>
            <SmilePlus size={20} style={{ color: '#34d399' }} />
          </div>

          <div style={{ height: 260, position: 'relative' }} className="flex justify-center items-center">
            {sentimentPieData.length > 0 ? (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sentimentPieData.map((entry, index) => (
                        <Cell key={`sent-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: '#0f172a', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border-light)',
                        color: '#fff',
                        fontFamily: 'inherit'
                      }} 
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span className="text-xs text-muted" style={{ fontWeight: 600 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Satisfaction percentage in center of donut */}
                <div style={{
                  position: 'absolute',
                  top: '40%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>
                    {sentimentStats.satisfactionRate || 0}%
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Satisfied
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <SmilePlus size={40} style={{ color: '#34d399' }} />
                <h3>No Sentiment Data</h3>
                <p>Start chatbot conversations to see sentiment trends.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column Charts section */}
      <div className="grid-2 mb-6" style={{ gap: 24 }}>
        {/* Token Status Distribution */}
        <div className="card flex flex-col justify-between">
          <div className="card-header">
            <div>
              <h2 className="card-title">Token Status Distribution</h2>
              <p className="card-subtitle">Today's real-time statuses</p>
            </div>
            <Activity size={20} style={{ color: 'var(--primary)' }} />
          </div>

          <div style={{ height: 260, position: 'relative' }} className="flex justify-center items-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: '#0f172a', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-light)',
                      color: '#fff',
                      fontFamily: 'inherit'
                    }} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-muted" style={{ fontWeight: 600 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <BarChart3 size={40} />
                <h3>No Status Data</h3>
                <p>No tokens have been generated today.</p>
              </div>
            )}
          </div>
        </div>

        {/* Peak Hours Area/Bar Chart */}
        <div className="card flex flex-col justify-between">
          <div className="card-header">
            <div>
              <h2 className="card-title">Peak Processing Hours</h2>
              <p className="card-subtitle">Hourly token throughput today</p>
            </div>
            <Calendar size={20} style={{ color: 'var(--warning)' }} />
          </div>

          <div style={{ height: 260 }}>
            {peakHoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={peakHoursData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--warning)" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.15)" />
                  <XAxis 
                    dataKey="hourLabel" 
                    stroke="var(--text-muted)" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#0f172a', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-light)',
                      color: '#fff',
                      fontFamily: 'inherit'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Tokens" 
                    stroke="var(--warning)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTokens)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <BarChart3 size={40} />
                <h3>No Hourly Data</h3>
                <p>Peak hours will map as tokens get created.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Breakdown Table */}
      {analytics?.serviceBreakdown?.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <div>
              <h2 className="card-title">Service Performance Breakdown</h2>
              <p className="card-subtitle">Detailed service metrics for today</p>
            </div>
            <BarChart3 size={20} style={{ color: 'var(--success)' }} />
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>Waiting</th>
                  <th>Serving</th>
                  <th>Completed</th>
                  <th>Skipped</th>
                  <th>Cancelled</th>
                  <th>Total Booked</th>
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
            <p className="card-subtitle">Automated system efficiency score</p>
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
              Throughput Rate
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {analytics?.totalCompleted || 0}
              <span className="text-sm text-muted" style={{ fontWeight: 400 }}> /day</span>
            </div>
            <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
              <ArrowUpRight size={12} />
              Processed tokens today
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'rgba(245, 158, 11, 0.06)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
          }}>
            <div className="text-xs text-muted mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Average Processing Delay
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {analytics?.avgWaitMinutes || 0}
              <span className="text-sm text-muted" style={{ fontWeight: 400 }}> min</span>
            </div>
            <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.75rem', color: analytics?.avgWaitMinutes > 15 ? 'var(--danger)' : 'var(--success)' }}>
              {analytics?.avgWaitMinutes > 15 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {analytics?.avgWaitMinutes > 15 ? 'Above target limit (15m)' : 'Within target boundary'}
            </div>
          </div>

          <div style={{
            padding: 20,
            background: 'rgba(139, 92, 246, 0.06)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
          }}>
            <div className="text-xs text-muted mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Token Success Index
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {totalTokens > 0
                ? Math.round(((statusCounts.completed || 0) / totalTokens) * 100)
                : 0}
              <span className="text-sm text-muted" style={{ fontWeight: 400 }}>%</span>
            </div>
            <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.75rem', color: 'var(--secondary-light)' }}>
              <Activity size={12} />
              Completion vs Abandonment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
