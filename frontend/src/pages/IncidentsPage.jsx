import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Filter,
  CheckCircle2,
  Clock,
  Camera,
  MapPin,
  FileText,
  ExternalLink,
  ChevronRight,
  Eye,
  Edit3,
  X,
  Search,
} from 'lucide-react';
import api from '../services/api';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected incident modal
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [statusSuccessMsg, setStatusSuccessMsg] = useState('');

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (zoneFilter !== 'all') params.zone = zoneFilter;

      const res = await api.getIncidents(params);
      setIncidents(res.incidents || []);
    } catch (err) {
      setError(err.message || 'Failed to load safety incidents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, severityFilter, zoneFilter]);

  const handleOpenModal = (inc) => {
    setSelectedIncident(inc);
    setNewStatus(inc.status);
    setSupervisorNotes(inc.notes || '');
    setStatusSuccessMsg('');
  };

  const handleUpdateStatus = async () => {
    if (!selectedIncident) return;
    setUpdating(true);
    setStatusSuccessMsg('');
    try {
      const res = await api.updateIncidentStatus(selectedIncident.id, newStatus, supervisorNotes);
      setStatusSuccessMsg('Status updated successfully!');
      setSelectedIncident(res.incident);
      fetchIncidents();
    } catch (err) {
      alert(`Error updating incident: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Filtered list by text search
  const filteredIncidents = incidents.filter(inc => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.incident_code?.toLowerCase().includes(q) ||
      inc.violation_type?.toLowerCase().includes(q) ||
      inc.zone?.toLowerCase().includes(q) ||
      inc.camera_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="#ef4444" size={24} />
            Incident Management Hub
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
            Track, audit, and resolve workplace safety violations identified by YOLOv8 and cross-referenced with safety policies.
          </p>
        </div>

        {/* Status Count Pills */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 600 }}>OPEN</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>
              {incidents.filter(i => i.status === 'Open').length}
            </div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#fcd34d', fontWeight: 600 }}>UNDER REVIEW</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
              {incidents.filter(i => i.status === 'Under Review').length}
            </div>
          </div>
          <div style={{ background: 'rgba(74, 222, 128, 0.15)', border: '1px solid rgba(74, 222, 128, 0.4)', borderRadius: '8px', padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 600 }}>RESOLVED</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22c55e' }}>
              {incidents.filter(i => i.status === 'Resolved').length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        gap: '14px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e293b', padding: '6px 12px', borderRadius: '8px', flex: '1', minWidth: '220px', border: '1px solid #334155' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by code, violation, zone, camera..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#f8fafc', outline: 'none', fontSize: '0.85rem', width: '100%' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', outline: 'none' }}
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Under Review">Under Review</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', outline: 'none' }}
          >
            <option value="all">All Severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Zone Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Zone:</span>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', outline: 'none' }}
          >
            <option value="all">All Zones</option>
            <option value="Zone A">Zone A (Assembly)</option>
            <option value="Zone B">Zone B (Welding)</option>
            <option value="Zone C">Zone C (Loading Dock)</option>
          </select>
        </div>
      </div>

      {/* Incidents Table / Cards */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            Loading incidents...
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
            {error}
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No incident records match the selected filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#1e293b', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Incident Code</th>
                  <th style={{ padding: '12px 16px' }}>Violation Type</th>
                  <th style={{ padding: '12px 16px' }}>Severity</th>
                  <th style={{ padding: '12px 16px' }}>Location</th>
                  <th style={{ padding: '12px 16px' }}>Date & Time</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    style={{ borderBottom: '1px solid #1e293b', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#38bdf8' }}>
                      {inc.incident_code}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#f8fafc', fontWeight: 600 }}>
                      {inc.violation_type}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: inc.severity === 'High' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: inc.severity === 'High' ? '#ef4444' : '#f59e0b'
                      }}>
                        {inc.severity} ({Math.round(inc.confidence * 100)}%)
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Camera size={13} color="#94a3b8" />
                        <span>{inc.camera_id}</span>
                        <span style={{ color: '#64748b' }}>•</span>
                        <MapPin size={13} color="#94a3b8" />
                        <span>{inc.zone}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.8rem' }}>
                      {inc.timestamp}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        background:
                          inc.status === 'Resolved'
                            ? 'rgba(74, 222, 128, 0.15)'
                            : inc.status === 'Under Review'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          inc.status === 'Resolved'
                            ? '#4ade80'
                            : inc.status === 'Under Review'
                            ? '#f59e0b'
                            : '#ef4444',
                        border:
                          inc.status === 'Resolved'
                            ? '1px solid rgba(74, 222, 128, 0.3)'
                            : inc.status === 'Under Review'
                            ? '1px solid rgba(245, 158, 11, 0.3)'
                            : '1px solid rgba(239, 68, 68, 0.3)'
                      }}>
                        {inc.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenModal(inc)}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          color: '#38bdf8',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incident Detail / Status Update Modal */}
      {selectedIncident && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Safety Incident Record
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                  {selectedIncident.incident_code}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>VIOLATION TYPE</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  {selectedIncident.violation_type}
                </div>
              </div>
              <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>SEVERITY & CONFIDENCE</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444', marginTop: '2px' }}>
                  {selectedIncident.severity} ({Math.round(selectedIncident.confidence * 100)}%)
                </div>
              </div>
              <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>LOCATION & CAMERA</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                  {selectedIncident.zone} ({selectedIncident.camera_id})
                </div>
              </div>
              <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>TIMESTAMP</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                  {selectedIncident.timestamp}
                </div>
              </div>
            </div>

            {/* Related Policy Document */}
            {selectedIncident.related_document && (
              <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={13} />
                  <span>SUPPORTING POLICY REFERENCE</span>
                </div>
                <div style={{ fontSize: '0.86rem', color: '#e2e8f0', marginTop: '4px' }}>
                  {selectedIncident.related_document}
                </div>
              </div>
            )}

            {/* Status Transition Control */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={15} color="#38bdf8" />
                <span>Update Incident Status</span>
              </h4>

              <div style={{ display: 'flex', gap: '10px' }}>
                {['Open', 'Under Review', 'Resolved'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setNewStatus(st)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: newStatus === st ? '2px solid #38bdf8' : '1px solid #334155',
                      background: newStatus === st ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
                      color: newStatus === st ? '#38bdf8' : '#cbd5e1'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Supervisor Audit Notes:
                </label>
                <textarea
                  value={supervisorNotes}
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  placeholder="Record supervisor verification notes or corrective actions taken..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {statusSuccessMsg && (
                <div style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 600 }}>
                  ✓ {statusSuccessMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  onClick={() => setSelectedIncident(null)}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={updating}
                  style={{
                    background: '#0284c7',
                    border: 'none',
                    color: '#f8fafc',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: updating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {updating ? 'Saving...' : 'Save Status Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
