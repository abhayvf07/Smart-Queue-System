import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  Sparkles,
  Brain,
  Loader2,
} from 'lucide-react';

const ServiceManager = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editService, setEditService] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', prefix: '', capacityPerHour: 20 });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const fetchServices = async () => {
    try {
      const res = await api.get('/services?active=true');
      setServices(res.data.data.services);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const openCreate = () => {
    setEditService(null);
    setForm({ name: '', description: '', prefix: '', capacityPerHour: 20 });
    setFormErrors({});
    setAiSuggestion(null);
    setShowModal(true);
  };

  const openEdit = (service) => {
    setEditService(service);
    setForm({
      name: service.name,
      description: service.description || '',
      prefix: service.prefix,
      capacityPerHour: service.capacityPerHour,
    });
    setFormErrors({});
    setAiSuggestion(null);
    setShowModal(true);
  };

  const handleAISuggest = async () => {
    if (!form.name.trim()) {
      setFormErrors({ name: 'Enter a service name first for AI classification.' });
      return;
    }
    setClassifying(true);
    setAiSuggestion(null);
    try {
      const res = await api.post('/services/classify', {
        name: form.name,
        description: form.description,
      });
      const cls = res.data.data.classification;
      setAiSuggestion(cls);
      // Auto-fill form with suggestions (don't overwrite if already set by user)
      setForm(prev => ({
        ...prev,
        prefix: prev.prefix || cls.suggestedPrefix,
        capacityPerHour: prev.capacityPerHour === 20 ? cls.suggestedCapacity : prev.capacityPerHour,
        description: prev.description || cls.reasoning,
      }));
    } catch (err) {
      toast.error('AI classification failed. Try again.');
    } finally {
      setClassifying(false);
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.prefix.trim()) errs.prefix = 'Prefix is required.';
    if (form.prefix.trim().length > 3) errs.prefix = 'Prefix max 3 characters.';
    if (!form.capacityPerHour || form.capacityPerHour < 1) errs.capacityPerHour = 'Invalid capacity.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      if (editService) {
        await api.put(`/services/${editService._id}`, form);
        toast.success('Service updated!');
      } else {
        await api.post('/services', form);
        toast.success('Service created!');
      }
      setShowModal(false);
      fetchServices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/services/${id}`);
      toast.success('Service deactivated.');
      setConfirmDeleteId(null);
      fetchServices();
    } catch (err) {
      toast.error('Failed to deactivate.');
    }
  };

  return (
    <div className="animate-in" id="service-manager">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>Manage Services</h1>
            <p>Add, edit, or deactivate queue services</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate} id="add-service-btn">
            <Plus size={18} /> Add Service
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: 60 }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="service-grid">
          {services.map((service) => (
            <div key={service._id} className="card" id={`service-card-${service.prefix}`}>
              <div className="flex justify-between items-center mb-3">
                <span
                  className="badge badge-primary"
                  style={{ fontSize: '1rem', fontWeight: 800, padding: '6px 14px' }}
                >
                  {service.prefix}
                </span>
                {service.active ? (
                  <span className="badge badge-success">
                    <CheckCircle2 size={10} /> Active
                  </span>
                ) : (
                  <span className="badge badge-danger">
                    <XCircle size={10} /> Inactive
                  </span>
                )}
              </div>
              <h3 className="card-title mb-1">{service.name}</h3>
              <p className="text-sm text-muted mb-4">{service.description || 'No description'}</p>
              <div className="text-xs text-muted mb-4">
                Capacity: {service.capacityPerHour}/hr
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => openEdit(service)}
                >
                  <Edit3 size={14} /> Edit
                </button>
                {confirmDeleteId === service._id ? (
                  <>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(service._id)}
                    >
                      Yes, Deactivate
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmDeleteId(service._id)}
                  >
                    <Trash2 size={14} /> Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editService ? 'Edit Service' : 'Add Service'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Service Name</label>
                <input
                  className={`form-input ${formErrors.name ? 'error' : ''}`}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., General OPD"
                />
                {formErrors.name && (
                  <div className="form-error"><AlertCircle size={12} /> {formErrors.name}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description"
                />
              </div>

              {/* AI Suggest Button — only show on create, not edit */}
              {!editService && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleAISuggest}
                    disabled={classifying || !form.name.trim()}
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      color: '#c084fc',
                      width: '100%',
                    }}
                  >
                    {classifying ? (
                      <><Loader2 size={14} className="animate-spin" /> Analyzing with Gemini AI...</>
                    ) : (
                      <><Sparkles size={14} /> AI Suggest — Auto-fill prefix & capacity</>
                    )}
                  </button>
                </div>
              )}

              {/* AI Suggestion Display */}
              {aiSuggestion && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(139, 92, 246, 0.06)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  marginBottom: 12,
                  fontSize: '0.8rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 700, color: '#c084fc' }}>
                    <Brain size={14} /> AI Classification
                  </div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong>Category:</strong> <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{aiSuggestion.category}</span><br />
                    <strong>Suggested Prefix:</strong> {aiSuggestion.suggestedPrefix}
                    {aiSuggestion.prefixOptions && (
                      <span style={{ color: 'var(--text-muted)' }}> (alternatives: {aiSuggestion.prefixOptions.join(', ')})</span>
                    )}<br />
                    <strong>Capacity:</strong> {aiSuggestion.suggestedCapacity}/hr — <em>{aiSuggestion.capacityReasoning}</em>
                  </div>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Prefix</label>
                  <input
                    className={`form-input ${formErrors.prefix ? 'error' : ''}`}
                    value={form.prefix}
                    onChange={(e) =>
                      setForm({ ...form, prefix: e.target.value.toUpperCase().slice(0, 3) })
                    }
                    placeholder="A"
                    maxLength={3}
                    disabled={!!editService}
                  />
                  {formErrors.prefix && (
                    <div className="form-error"><AlertCircle size={12} /> {formErrors.prefix}</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Capacity/Hour</label>
                  <input
                    type="number"
                    className={`form-input ${formErrors.capacityPerHour ? 'error' : ''}`}
                    value={form.capacityPerHour}
                    onChange={(e) =>
                      setForm({ ...form, capacityPerHour: parseInt(e.target.value) || 0 })
                    }
                    min={1}
                  />
                </div>
              </div>

              <div className="flex gap-3" style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editService ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceManager;
