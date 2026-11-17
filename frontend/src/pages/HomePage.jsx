import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  AlertOctagon,
  CheckCircle,
  FileText,
  UploadCloud,
  ArrowRight,
  TrendingUp,
  HardHat,
  Eye,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import api from '../services/api';

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats()
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load stats:", err);
        setLoading(false);
      });
  }, []);

  const totalInspections = stats?.total_inspections ?? 0;
  const totalViolations = stats?.total_violations ?? 0;
  const highSeverity = stats?.high_severity_violations ?? 0;
  const complianceRate = stats?.compliance_rate ?? 100;
  const recentInspections = stats?.recent_inspections ?? [];
  const recentViolations = stats?.recent_violations ?? [];

  return (
    <div>
      {/* Hero Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 100%)',
        borderRadius: 'var(--radius)',
        padding: '32px',
        color: '#ffffff',
        marginBottom: '28px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ maxWidth: '650px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <ShieldAlert size={18} />
            Workplace Visual Safety Intelligence
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '10px' }}>
            Welcome to SafeSight AI
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Automated workplace safety detection powered by YOLOv8 deep learning and computer vision.
            Detect missing hard hats, safety vests, and protective eyewear across images, videos, and live monitoring channels in real time.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/upload" className="btn btn-primary" style={{ padding: '12px 22px', fontSize: '0.95rem' }}>
            <UploadCloud size={18} />
            Start New Inspection
          </Link>
          <Link to="/reports" className="btn btn-secondary" style={{ padding: '12px 20px', fontSize: '0.95rem', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }}>
            <FileText size={18} />
            Open Safety Reports
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Inspections</span>
            <span className="stat-value">{loading ? '...' : totalInspections}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">PPE Compliance</span>
            <span className="stat-value" style={{ color: complianceRate >= 80 ? 'var(--green)' : 'var(--orange)' }}>
              {loading ? '...' : `${complianceRate}%`}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Violations</span>
            <span className="stat-value">{loading ? '...' : totalViolations}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <AlertOctagon size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">High-Severity Hazards</span>
            <span className="stat-value" style={{ color: highSeverity > 0 ? 'var(--red)' : 'var(--text-primary)' }}>
              {loading ? '...' : highSeverity}
            </span>
          </div>
        </div>
      </div>

      {/* Database Empty State vs Recent Inspections Table */}
      {totalInspections === 0 && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <FolderOpen size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            No Safety Inspections Recorded Yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 20px auto', fontSize: '0.9rem' }}>
            The SQLite inspection database is ready and connected. Upload a workplace photo or industrial video to run YOLOv8 PPE detection and generate compliance records.
          </p>
          <Link to="/upload" className="btn btn-primary">
            <UploadCloud size={16} />
            Upload Visual Media
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
          {/* Recent Inspections Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <FileText size={18} color="var(--primary)" />
                Recent Inspections
              </h3>
              <Link to="/audit" style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                View All &rarr;
              </Link>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Media</th>
                    <th>Compliance</th>
                    <th>Violations</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInspections.map((insp) => (
                    <tr key={insp.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                        {insp.inspection_code}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {insp.filename}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          color: insp.compliance_rate >= 80 ? 'var(--green)' : 'var(--red)'
                        }}>
                          {insp.compliance_rate}%
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${insp.total_violations > 0 ? 'badge-high' : 'badge-verified'}`}>
                          {insp.total_violations} {insp.total_violations === 1 ? 'alert' : 'alerts'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Violations Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <AlertTriangle size={18} color="var(--orange)" />
                Recent Safety Violations
              </h3>
              <Link to="/audit" style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Audit Center &rarr;
              </Link>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Confidence</th>
                    <th>Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentViolations.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                        {v.violation_type}
                      </td>
                      <td>
                        <span className={`badge badge-${v.severity.toLowerCase()}`}>
                          {v.severity}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {Math.round(v.confidence * 100)}%
                      </td>
                      <td>
                        <span className={`badge badge-${v.audit_status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {v.audit_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
