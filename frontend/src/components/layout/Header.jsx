import React, { useState, useEffect } from 'react';
import {
  Bell,
  Sun,
  Moon,
  Server,
  LogOut,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Header({ pageTitle, theme, onToggleTheme }) {
  const [backendConnected, setBackendConnected] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkConn = () => {
      api.getHealth()
        .then(() => setBackendConnected(true))
        .catch(() => setBackendConnected(false));

      api.getAlerts({ unread: true, limit: 5 })
        .then(res => {
          setAlerts(res.alerts || []);
          setUnreadCount(res.unread_count || 0);
        })
        .catch(() => {});
    };
    checkConn();
    const interval = setInterval(checkConn, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="top-header">
      <div className="header-left">
        <h2 className="page-title">{pageTitle || 'SafeSight AI'}</h2>
      </div>

      <div className="header-right">
        {/* Backend Connection Badge */}
        <div className="header-badge">
          <Server size={14} color={backendConnected ? '#10b981' : '#ef4444'} />
          <span style={{ fontSize: '0.8rem' }}>
            {backendConnected ? 'Flask API Online' : 'Connecting to API...'}
          </span>
          <span className={`status-dot ${backendConnected ? '' : 'offline'}`} />
        </div>

        {/* Current Date */}
        <div className="header-time">
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            className="theme-toggle-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Supervisor Alerts"
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '15px',
                height: '15px',
                borderRadius: '50%',
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.62rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '44px',
              width: '310px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '10px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              padding: '12px',
              zIndex: 100
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '8px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#f8fafc' }}>
                  Supervisor Safety Alerts
                </span>
                <span style={{ fontSize: '0.74rem', color: '#38bdf8', cursor: 'pointer' }} onClick={() => { setShowNotifications(false); navigate('/alerts'); }}>
                  View All
                </span>
              </div>
              {alerts.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                  No active unread alerts.
                </div>
              ) : (
                alerts.map(a => (
                  <div
                    key={a.id}
                    onClick={() => { setShowNotifications(false); navigate('/alerts'); }}
                    style={{ fontSize: '0.8rem', padding: '8px 6px', borderBottom: '1px solid #1e293b', cursor: 'pointer', borderRadius: '4px' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{a.alert_code}: {a.violation_type}</span>
                      <span style={{ fontSize: '0.66rem', color: '#ef4444', fontWeight: 700 }}>{a.severity}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: '2px' }}>
                      {a.camera_id} • {a.zone} • {a.timestamp}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Logout Button */}
        {user && (
          <button
            className="theme-toggle-btn"
            onClick={handleLogout}
            title={`Sign out (${user.email})`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
