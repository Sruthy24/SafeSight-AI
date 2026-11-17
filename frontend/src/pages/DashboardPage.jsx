import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  HardHat,
  Eye,
  ShieldAlert,
  Image as ImageIcon,
  Video,
  CheckCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Bot,
  BookOpen,
  BellRing,
  Camera,
  MapPin,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import api from '../services/api';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    api.getDashboardStats(false)
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Dashboard error:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const categoryData = stats?.violations_by_category?.length > 0
    ? stats.violations_by_category
    : [
        { category: 'Missing Helmet', count: 0 },
        { category: 'Missing Safety Vest', count: 0 },
        { category: 'Missing Goggles', count: 0 }
      ];

  const severityData = (stats?.severity_distribution || []).filter(item => item.value > 0);

  const cameraData = stats?.camera_activity?.length > 0
    ? stats.camera_activity
    : [
        { camera_id: 'CAM-01', inspections_count: 0, violations_count: 0 },
        { camera_id: 'CAM-02', inspections_count: 0, violations_count: 0 },
        { camera_id: 'CAM-03', inspections_count: 0, violations_count: 0 },
      ];

  const zoneData = stats?.zone_violations?.length > 0
    ? stats.zone_violations
    : [
        { zone: 'Zone A', count: 0 },
        { zone: 'Zone B', count: 0 },
        { zone: 'Zone C', count: 0 },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert color="#38bdf8" size={26} />
            SafeSight Enterprise Safety Operations
          </h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.86rem' }}>
            Integrated Overview: Milestone 1 (YOLOv8 Detection) • Milestone 2 (Document RAG) • Milestone 3 (LangGraph Agents)
          </p>
        </div>

        {/* Quick Launch Shortcuts */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            to="/assistant"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#0284c7',
              color: '#f8fafc',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}
          >
            <Bot size={16} />
            <span>AI Assistant</span>
          </Link>

          <Link
            to="/alerts"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ef4444',
              color: '#f8fafc',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
          >
            <BellRing size={16} />
            <span>Supervisor Alerts ({stats?.unread_alerts_count ?? 0})</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (6 Metric Cards) */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon blue">
            <ImageIcon size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Inspections</span>
            <span className="stat-value">{stats?.total_inspections ?? 0}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <ShieldAlert size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Violations</span>
            <span className="stat-value">{stats?.total_violations ?? 0}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">PPE Compliance</span>
            <span className="stat-value" style={{ color: (stats?.compliance_rate ?? 100) >= 75 ? '#4ade80' : '#f59e0b' }}>
              {stats?.compliance_rate ?? 100}%
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <AlertTriangle size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Open Incidents</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>
              {stats?.open_incidents ?? 0}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon teal">
            <ShieldCheck size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Resolved Incidents</span>
            <span className="stat-value" style={{ color: '#22c55e' }}>
              {stats?.resolved_incidents ?? 0}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <BellRing size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Active Alerts</span>
            <span className="stat-value" style={{ color: (stats?.unread_alerts_count ?? 0) > 0 ? '#ef4444' : '#4ade80' }}>
              {stats?.unread_alerts_count ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Violations by Category Bar Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <ShieldAlert size={18} color="#0284c7" />
              Violations by Category
            </h3>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Distribution Donut Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <AlertTriangle size={18} color="#f59e0b" />
              Violations by Severity
            </h3>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                No severity data to display.
              </div>
            )}
          </div>
        </div>

        {/* Camera-wise Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Camera size={18} color="#38bdf8" />
              Camera-Wise Activity & Violations
            </h3>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cameraData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <XAxis dataKey="camera_id" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="inspections_count" name="Inspections" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="violations_count" name="Violations" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone-wise Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <MapPin size={18} color="#4ade80" />
              Zone-Wise Violation Distribution
            </h3>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="zone" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={70} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Bar dataKey="count" name="Violations" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Activity (Alerts & Incidents Feeds) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Recent Alerts Feed */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">
              <BellRing size={18} color="#ef4444" />
              Recent Supervisor Alerts
            </h3>
            <Link to="/alerts" style={{ fontSize: '0.8rem', color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View All</span>
              <ChevronRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(stats?.recent_alerts || []).length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '16px', textAlign: 'center' }}>
                No recent alerts.
              </div>
            ) : (
              (stats.recent_alerts).map((alt) => (
                <div
                  key={alt.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.86rem' }}>
                      {alt.alert_code}: {alt.violation_type}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444'
                    }}>
                      {alt.severity}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.76rem' }}>
                    <span>{alt.camera_id}</span>
                    <span>•</span>
                    <span>{alt.zone}</span>
                    <span>•</span>
                    <span>{alt.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Incidents Feed */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">
              <AlertTriangle size={18} color="#0284c7" />
              Recent Safety Incidents
            </h3>
            <Link to="/incidents" style={{ fontSize: '0.8rem', color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View All</span>
              <ChevronRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(stats?.recent_incidents || []).length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '16px', textAlign: 'center' }}>
                No recent incidents logged.
              </div>
            ) : (
              (stats.recent_incidents).map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.86rem' }}>
                      {inc.incident_code}: {inc.violation_type}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: inc.status === 'Resolved' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: inc.status === 'Resolved' ? '#4ade80' : '#f59e0b'
                    }}>
                      {inc.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.76rem' }}>
                    <span>{inc.camera_id}</span>
                    <span>•</span>
                    <span>{inc.zone}</span>
                    <span>•</span>
                    <span>{inc.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
