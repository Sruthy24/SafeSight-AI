import React, { useState, useEffect } from 'react';
import {
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Camera,
  MapPin,
  ExternalLink,
  CheckCheck,
  ShieldAlert,
} from 'lucide-react';
import api from '../services/api';
import { Link } from 'react-router-dom';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAlerts({ unread: filterUnread });
      setAlerts(res.alerts || []);
      setUnreadCount(res.unread_count || 0);
    } catch (err) {
      setError(err.message || 'Failed to load supervisor alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [filterUnread]);

  const handleMarkRead = async (alertId) => {
    try {
      await api.markAlertRead(alertId);
      fetchAlerts();
    } catch (err) {
      alert(`Error marking alert read: ${err.message}`);
    }
  };

  const handleAcknowledge = async (alertId) => {
    setAcknowledgingId(alertId);
    try {
      await api.acknowledgeAlert(alertId, 'Safety Supervisor');
      fetchAlerts();
    } catch (err) {
      alert(`Error acknowledging alert: ${err.message}`);
    } finally {
      setAcknowledgingId(null);
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)'
          }}>
            <BellRing size={22} color="#f8fafc" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Supervisor Safety Alerts
              {unreadCount > 0 && (
                <span style={{ fontSize: '0.74rem', background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  {unreadCount} UNREAD
                </span>
              )}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
              Real-time in-application hazard notifications generated for high-severity violations.
            </p>
          </div>
        </div>

        {/* Filter Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilterUnread(false)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: !filterUnread ? '1px solid #38bdf8' : '1px solid #334155',
              background: !filterUnread ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
              color: !filterUnread ? '#38bdf8' : '#cbd5e1'
            }}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setFilterUnread(true)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filterUnread ? '1px solid #ef4444' : '1px solid #334155',
              background: filterUnread ? 'rgba(239, 68, 68, 0.2)' : '#1e293b',
              color: filterUnread ? '#ef4444' : '#cbd5e1'
            }}
          >
            Unread Only ({unreadCount})
          </button>
        </div>
      </div>

      {/* Alerts Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}>
            Loading supervisor alerts...
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444', background: '#0f172a', borderRadius: '12px' }}>
            {error}
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}>
            <CheckCircle2 size={36} color="#4ade80" style={{ margin: '0 auto 10px', display: 'block' }} />
            <h4 style={{ margin: '0 0 4px', color: '#f8fafc', fontSize: '1.05rem' }}>No Active Safety Alerts</h4>
            <p style={{ margin: 0, fontSize: '0.82rem' }}>All high-severity alerts have been reviewed and acknowledged.</p>
          </div>
        ) : (
          alerts.map((a) => (
            <div
              key={a.id}
              style={{
                background: a.is_read === 0 ? '#131d35' : '#0f172a',
                border: a.is_read === 0 ? '1px solid #0284c7' : '1px solid #1e293b',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                transition: 'border 0.2s ease'
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: a.is_read === 0 ? '#38bdf8' : 'transparent',
                    boxShadow: a.is_read === 0 ? '0 0 8px #38bdf8' : 'none'
                  }} />
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.96rem' }}>
                    {a.alert_code}: {a.violation_type}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444'
                  }}>
                    {a.severity} HAZARD
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <Clock size={13} />
                  <span>{a.timestamp}</span>
                </div>
              </div>

              {/* Evidence details */}
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {a.evidence_summary}
              </p>

              {/* Location metadata & Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Camera size={13} color="#38bdf8" />
                    <span>{a.camera_id}</span>
                  </div>
                  <span>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={13} color="#38bdf8" />
                    <span>{a.zone}</span>
                  </div>
                  {a.incident_code && (
                    <>
                      <span>•</span>
                      <Link
                        to="/incidents"
                        style={{ color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                      >
                        <span>Incident: {a.incident_code}</span>
                        <ExternalLink size={11} />
                      </Link>
                    </>
                  )}
                  {a.acknowledged_by && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCheck size={13} /> Acknowledged by {a.acknowledged_by}
                      </span>
                    </>
                  )}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {a.is_read === 0 && (
                    <button
                      onClick={() => handleMarkRead(a.id)}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#94a3b8',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      Mark Read
                    </button>
                  )}
                  {!a.acknowledged_by && (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      disabled={acknowledgingId === a.id}
                      style={{
                        background: '#0284c7',
                        border: 'none',
                        color: '#f8fafc',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: acknowledgingId === a.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {acknowledgingId === a.id ? 'Acknowledging...' : 'Acknowledge Alert'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
