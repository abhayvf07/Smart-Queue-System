import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Ticket, Users, Zap, ArrowLeft, AlertCircle } from 'lucide-react';

const BookToken = () => {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get('/services/recommend');
        setServices(res.data.data.recommendations);
      } catch (err) {
        console.error('Failed to load recommended services, falling back to standard list:', err);
        try {
          const fallbackRes = await api.get('/services');
          const baseServices = fallbackRes.data.data.services;
          
          // Enrich fallback response with stats
          const enrichedServices = await Promise.all(
            baseServices.map(async (service) => {
              try {
                const qRes = await api.get(`/tokens/queue-status/${service._id}`);
                return { 
                  ...service, 
                  stats: qRes.data.data.stats, 
                  estimatedMinutes: qRes.data.data.stats.avgWaitMinutes || 0 
                };
              } catch (e) {
                return service;
              }
            })
          );
          setServices(enrichedServices);
        } catch (e) {
          toast.error('Failed to load services.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const handleBook = async () => {
    if (!selectedService) {
      toast.error('Please select a service first.');
      return;
    }

    setBooking(true);
    try {
      const res = await api.post('/tokens/book', {
        serviceId: selectedService._id,
      });
      toast.success(res.data.message);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to book token.');
    } finally {
      setBooking(false);
    }
  };

  const recommendedServiceId = services[0]?._id;

  return (
    <div className="animate-in" id="book-token-page">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(-1)}
            id="back-btn"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Book a Token</h1>
            <p>Select a service to join the queue</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: 60 }}>
          <div className="spinner"></div>
        </div>
      ) : services.length === 0 ? (
        <div className="empty-state">
          <AlertCircle size={64} />
          <h3>No Services Available</h3>
          <p>There are no active services at the moment. Please check back later.</p>
        </div>
      ) : (
        <>
          <div className="service-grid mb-6">
            {services.map((service, index) => {
              const isRecommended = service._id === recommendedServiceId;
              const waitingCount = service.stats?.waiting ?? 0;
              const waitTime = service.estimatedMinutes ?? 0;

              return (
                <div
                  key={service._id}
                  className={`service-card card hover:border-primary cursor-pointer relative transition-all duration-300 hover:translate-y-[-4px] ${
                    selectedService?._id === service._id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedService(service)}
                  id={`service-${service.prefix}`}
                  style={{ position: 'relative', overflow: 'visible' }}
                >
                  {isRecommended && (
                    <span className="absolute -top-3 left-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-emerald-500/20 border border-emerald-400/20 flex items-center gap-1 z-10 animate-pulse">
                      <Zap size={10} className="fill-slate-950" /> Recommended
                    </span>
                  )}

                  <div className="flex justify-between items-center mb-2">
                    <div className="service-card-name text-slate-100 font-semibold">{service.name}</div>
                    <span
                      className={`badge ${isRecommended ? 'badge-success' : 'badge-primary'}`}
                      style={{ fontSize: '0.85rem', fontWeight: 800 }}
                    >
                      {service.prefix}
                    </span>
                  </div>
                  <div className="service-card-desc text-slate-400 text-xs mb-3">{service.description}</div>
                  <div className="service-card-meta flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-800/60 pt-2.5 mt-auto">
                    <span className="flex items-center gap-1 text-slate-400 text-xs">
                      <Users size={12} className="text-slate-400" /> {service.capacityPerHour}/hr cap
                    </span>
                    <span className="flex items-center gap-1 text-indigo-400 text-xs font-semibold">
                      <Users size={12} className="text-indigo-400 animate-pulse" /> {waitingCount} waiting
                    </span>
                    {waitTime !== undefined && (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                        <Zap size={12} className="text-emerald-400" /> ~{waitTime} min wait
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedService && (
            <div
              className="card animate-in p-6"
            >
              <h3 className="card-title text-slate-100 text-lg font-bold mb-2 flex items-center gap-2">
                <Ticket size={20} className="text-indigo-400" /> Confirm Booking
              </h3>
              <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                You're about to join the queue for <strong className="text-indigo-300">{selectedService.name}</strong>.
                Your token prefix will be <strong className="text-indigo-300">{selectedService.prefix}</strong>.
              </p>
              
              {selectedService.estimatedMinutes !== undefined && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Zap size={16} />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400 font-medium">Estimated wait time</span>
                    <span className="text-sm font-bold text-emerald-400">{selectedService.estimatedMinutes} minutes</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  className="btn btn-primary btn-lg flex items-center gap-2 cursor-pointer"
                  onClick={handleBook}
                  disabled={booking}
                  id="confirm-book-btn"
                >
                  {booking ? (
                    <>
                      <div
                        className="spinner"
                        style={{ width: 18, height: 18, borderWidth: 2 }}
                      ></div>
                      Booking...
                    </>
                  ) : (
                    <>
                      <Ticket size={18} />
                      Book Token
                    </>
                  )}
                </button>
                <button
                  className="btn btn-ghost cursor-pointer"
                  onClick={() => setSelectedService(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BookToken;
