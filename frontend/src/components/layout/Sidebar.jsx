import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  Home,
  UploadCloud,
  Cctv,
  FileCheck2,
  FileSpreadsheet,
  BookOpen,
  Cpu,
  Clock,
  UserCircle,
  Bot,
  AlertTriangle,
  BellRing,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ theme }) {
  const [engineStatus, setEngineStatus] = useState({
    model_loaded: false,
    mode_label: 'Checking Engine...',
    is_custom_ppe: false
  });
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    // Check engine status
    api.getHealth()
      .then(data => {
        if (data.ai_engine) {
          setEngineStatus(data.ai_engine);
        }
      })
      .catch(() => {
        setEngineStatus({
          model_loaded: false,
          mode_label: 'Engine Offline',
          is_custom_ppe: false
        });
      });

    // Check unread supervisor alerts
    api.getAlerts({ unread: true })
      .then(res => setUnreadAlerts(res.unread_count || 0))
      .catch(() => setUnreadAlerts(0));

    // Update time clock every second
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { to: '/', label: 'Overview', icon: Home },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/assistant', label: 'AI Assistant', icon: Bot, badge: 'M3' },
    { to: '/upload', label: 'Upload & Inspect', icon: UploadCloud },
    { to: '/live-monitor', label: 'Live Monitor', icon: Cctv },
    { to: '/documents', label: 'Document Intelligence', icon: BookOpen },
    { to: '/incidents', label: 'Incident Management', icon: AlertTriangle },
    { to: '/alerts', label: 'Supervisor Alerts', icon: BellRing, count: unreadAlerts },
    { to: '/reports', label: 'Reports Hub', icon: FileSpreadsheet },
    { to: '/audit', label: 'Events & Audit', icon: FileCheck2 },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="logo-badge">
          <ShieldAlert size={24} />
        </div>
        <div className="brand-text">
          <h1>SafeSight AI</h1>
          <span>Industrial Safety Vision</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: '#0284c7',
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {item.badge}
                </span>
              )}
              {item.count > 0 && (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: '#ef4444',
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {item.count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Indicators */}
      <div className="sidebar-footer">
        {/* Logged-in user */}
        {user && (
          <div className="system-status-indicator" style={{ gap: '8px' }}>
            <UserCircle size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>SIGNED IN AS</div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {user.full_name || user.email}
              </div>
            </div>
          </div>
        )}

        <div className="system-status-indicator">
          <Cpu size={14} color="#38bdf8" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>AI ENGINE</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {engineStatus.mode_label}
            </div>
          </div>
          <div className={`status-dot ${engineStatus.model_loaded ? '' : 'offline'}`} />
        </div>

        <div className="system-status-indicator">
          <Clock size={14} color="#38bdf8" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>LOCAL TIME</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f8fafc' }}>
              {currentTime}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
          Infosys Springboard AI Milestone
        </div>
      </div>
    </aside>
  );
}
