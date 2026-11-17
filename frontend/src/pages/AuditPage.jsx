import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Filter,
  Search,
  Check,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Eye,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

export default function AuditPage() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Selected violation for snapshot modal
  const [selectedViolation, setSelectedViolation] = useState(null);

  const fetchViolations = () => {
    setLoading(true);
    api.getViolations({
      severity: filterSeverity,
      audit_status: filterStatus,
      violation_type: filterCategory
    })
      .then(data => {
        setViolations(data.violations || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Audit error:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchViolations();
  }, [filterSeverity, filterStatus, filterCategory]);

  const handleStatusChange = async (violationId, newStatus) => {
    try {
      await api.updateViolationStatus(violationId, newStatus);
      setViolations(violations.map(v =>
        v.id === violationId ? { ...v, audit_status: newStatus } : v
      ));
      if (selectedViolation && selectedViolation.id === violationId) {
        setSelectedViolation({ ...selectedViolation, audit_status: newStatus });
      }
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  const filteredViolations = violations.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (v.violation_type && v.violation_type.toLowerCase().includes(q)) ||
      (v.inspection_code && v.inspection_code.toLowerCase().includes(q)) ||
      (v.source_filename && v.source_filename.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Safety Events & Audit Log</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Review, verify, and resolve safety violations recorded across all workplace inspections.
          </p>
        </div>

        <button onClick={fetchViolations} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Log
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search by code, file, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Severity Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            >
              <option value="all">All Severities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Detected">Detected</option>
              <option value="Verified">Verified</option>
              <option value="False Positive">False Positive</option>
              <option value="Requires Review">Requires Review</option>
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Category:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            >
              <option value="all">All Categories</option>
              <option value="Helmet">Helmet</option>
              <option value="Vest">Safety Vest</option>
              <option value="Goggles">Eye Goggles</option>
            </select>
          </div>
        </div>
      </div>

      {/* Violations Table */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading audit records from database...
          </div>
        ) : filteredViolations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <CheckCircle size={36} color="var(--green)" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No Matching Records</h4>
            <p style={{ fontSize: '0.85rem' }}>Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Snapshot</th>
                  <th>Inspection ID</th>
                  <th>Timestamp</th>
                  <th>Media File</th>
                  <th>Violation Type</th>
                  <th>Severity</th>
                  <th>Confidence</th>
                  <th>Audit Status</th>
                  <th style={{ textAlign: 'right' }}>Audit Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.snapshot_path ? (
                        <img
                          src={api.getMediaUrl(v.snapshot_path)}
                          alt="Violation"
                          onClick={() => setSelectedViolation(v)}
                          style={{
                            width: '60px',
                            height: '44px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            border: '1px solid var(--border-color)'
                          }}
                          title="Click to zoom snapshot"
                        />
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Preview</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      {v.inspection_code}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {v.source_filename}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {v.violation_type}
                    </td>
                    <td>
                      <span className={`badge badge-${v.severity.toLowerCase()}`}>
                        {v.severity}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {Math.round(v.confidence * 100)}%
                    </td>
                    <td>
                      <span className={`badge badge-${v.audit_status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {v.audit_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <select
                        value={v.audit_status}
                        onChange={(e) => handleStatusChange(v.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Detected">Detected</option>
                        <option value="Verified">Verified</option>
                        <option value="False Positive">False Positive</option>
                        <option value="Requires Review">Requires Review</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snapshot Preview Modal */}
      {selectedViolation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            maxWidth: '560px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Violation Snapshot Detail</h3>
              <button onClick={() => setSelectedViolation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#020617' }}>
              <img
                src={api.getMediaUrl(selectedViolation.snapshot_path)}
                alt="Enlarged violation snapshot"
                style={{ maxHeight: '320px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
              />
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem', marginBottom: '16px' }}>
                <div><b>Type:</b> {selectedViolation.violation_type}</div>
                <div><b>Severity:</b> <span className={`badge badge-${selectedViolation.severity.toLowerCase()}`}>{selectedViolation.severity}</span></div>
                <div><b>Confidence:</b> {Math.round(selectedViolation.confidence * 100)}%</div>
                <div><b>Status:</b> {selectedViolation.audit_status}</div>
                <div><b>Inspection:</b> {selectedViolation.inspection_code}</div>
                <div><b>Source File:</b> {selectedViolation.source_filename}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => handleStatusChange(selectedViolation.id, 'Verified')}
                  className="btn btn-primary btn-sm"
                >
                  <Check size={14} /> Mark Verified
                </button>
                <button
                  onClick={() => handleStatusChange(selectedViolation.id, 'False Positive')}
                  className="btn btn-secondary btn-sm"
                >
                  Mark False Positive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
