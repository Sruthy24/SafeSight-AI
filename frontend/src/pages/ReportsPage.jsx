import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Plus,
  CheckCircle,
  FileText,
  AlertTriangle,
  Clock,
  RefreshCw,
  Sparkles,
  Layers
} from 'lucide-react';
import api from '../services/api';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState('SafeSight AI - Workplace Safety Compliance Audit');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [includeSnapshots, setIncludeSnapshots] = useState(true);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchReports = () => {
    setLoading(true);
    api.getReports()
      .then(data => {
        setReports(data.reports || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Reports error:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      title: reportTitle,
      include_snapshots: includeSnapshots,
      filters: {
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        violation_type: categoryFilter !== 'all' ? categoryFilter : undefined,
      }
    };

    try {
      const response = await api.generateReport(payload);
      setSuccessMessage(`Report "${response.report.report_code}" generated successfully!`);
      setGenerating(false);
      fetchReports();
    } catch (err) {
      setErrorMessage(err.message || "Failed to generate PDF report.");
      setGenerating(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Workplace Safety Compliance Reports</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Generate and download formal, certified PDF audit reports using ReportLab.
          </p>
        </div>

        <button onClick={fetchReports} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Archive
        </button>
      </div>

      {/* Generator Configuration Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Plus size={18} color="var(--primary)" />
            Generate New Safety Compliance PDF Report
          </h3>
        </div>

        <form onSubmit={handleGenerateReport}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Report Title
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            {/* Severity Filter */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Filter by Severity
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              >
                <option value="all">Include All Severities (High, Medium, Low)</option>
                <option value="High">High Severity Only</option>
                <option value="Medium">Medium Severity Only</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Filter by PPE Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              >
                <option value="all">All PPE Categories</option>
                <option value="Helmet">Hard Hat / Helmet Violations</option>
                <option value="Vest">Hi-Vis Safety Vest Violations</option>
                <option value="Goggles">Eye Protection Violations</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeSnapshots}
                onChange={(e) => setIncludeSnapshots(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
              />
              <span><b>Embed Visual Snapshots & Evidence:</b> Include cropped violation images in the PDF document.</span>
            </label>

            <button
              type="submit"
              disabled={generating}
              className="btn btn-primary"
              style={{ minWidth: '220px' }}
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="spin-animation" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  Generate PDF Audit Report
                </>
              )}
            </button>
          </div>
        </form>

        {successMessage && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'var(--green-light)',
            color: 'var(--green)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem'
          }}>
            <CheckCircle size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'var(--red-light)',
            color: 'var(--red)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem'
          }}>
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Reports History Archive */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FileText size={18} color="var(--teal)" />
            Generated Reports Archive ({reports.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading report archive...
          </div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={36} color="var(--primary)" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No Reports Generated Yet</h4>
            <p style={{ fontSize: '0.85rem' }}>Use the generator above to create your first OSHA-compliant safety PDF audit report.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Report Code</th>
                  <th>Title</th>
                  <th>Date & Time</th>
                  <th>Inspections</th>
                  <th>Violations</th>
                  <th style={{ textAlign: 'right' }}>Download PDF</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {r.report_code}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.report_title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.filename}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {r.total_inspections}
                    </td>
                    <td>
                      <span className="badge badge-high">
                        {r.total_violations} Violations
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href={api.getReportDownloadUrl(r.id)}
                        download={r.filename}
                        className="btn btn-outline btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Download size={14} /> Download PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
