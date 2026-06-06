import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, Clock, History, ChevronLeft, ChevronRight } from 'lucide-react';

const TokenHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  const fetchHistory = async (pageToFetch = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/tokens/history?page=${pageToFetch}&limit=10`);
      if (res.data.data.tokens) {
        setHistory(res.data.data.tokens);
        setTotalPages(res.data.data.pagination?.pages || 1);
        setPage(pageToFetch);
      }
    } catch (err) {
      console.error('Error fetching token history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page);
  }, []);

  const getStatusBadge = (status) => {
    const map = {
      waiting: { class: 'badge-warning', label: 'Waiting' },
      serving: { class: 'badge-success', label: 'Serving' },
      completed: { class: 'badge-success', label: 'Completed' },
      skipped: { class: 'badge-danger', label: 'Skipped' },
      cancelled: { class: 'badge-muted', label: 'Cancelled' },
    };
    const s = map[status] || { class: 'badge-muted', label: status };
    return <span className={`badge ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="animate-in" id="token-history">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Token History</h1>
            <p>View your past bookings and visits</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <History size={20} className="text-primary" /> Past Tokens
          </h2>
        </div>

        {loading && history.length === 0 ? (
          <div className="flex justify-center" style={{ padding: 40 }}>
            <div className="spinner"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <Clock size={48} />
            <h3>No History Found</h3>
            <p>You haven't booked any tokens yet.</p>
            <Link to="/book-token" className="btn btn-primary mt-4">
              Book a Token
            </Link>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Token Number</th>
                    <th>Status</th>
                    <th>Wait Time</th>
                  </tr>
                </thead>
                <tbody style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                  {history.map((token) => {
                    const createdDate = new Date(token.createdAt);
                    let waitTimeStr = '-';
                    if (token.calledAt) {
                      const calledDate = new Date(token.calledAt);
                      const diffMins = Math.round((calledDate - createdDate) / 60000);
                      waitTimeStr = `${diffMins} min`;
                    }
                    return (
                      <tr key={token._id}>
                        <td className="text-sm font-medium">
                          {createdDate.toLocaleDateString()} {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="font-bold text-slate-200">
                          {token.serviceId?.name || 'Unknown'}
                        </td>
                        <td className="font-black text-primary-light text-lg">
                          {token.tokenNumber}
                        </td>
                        <td>{getStatusBadge(token.status)}</td>
                        <td className="text-slate-400">{waitTimeStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === 1 || loading}
                  onClick={() => fetchHistory(page - 1)}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <div className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === totalPages || loading}
                  onClick={() => fetchHistory(page + 1)}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TokenHistory;
