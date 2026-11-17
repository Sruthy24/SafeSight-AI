import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileImage,
  Video,
  X,
  Play,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Layers,
  Sparkles,
  Sliders,
  Check,
  RefreshCw,
  Eye
} from 'lucide-react';
import api from '../services/api';

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState('image'); // 'image' or 'video'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confidence, setConfidence] = useState(0.40);
  const [requireHelmet, setRequireHelmet] = useState(true);
  const [requireVest, setRequireVest] = useState(true);
  const [requireGoggles, setRequireGoggles] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);

  // Image Results
  const [imageResult, setImageResult] = useState(null);

  // Blob URLs for JWT-protected images (annotated image + violation snapshots)
  // These are needed because plain <img src> cannot attach Authorization headers.
  const [annotatedBlobUrl, setAnnotatedBlobUrl] = useState(null);
  const [snapshotBlobUrls, setSnapshotBlobUrls] = useState({}); // keyed by violation id

  // Video Job Results
  const [videoJob, setVideoJob] = useState(null);
  const pollingRef = useRef(null);

  const fileInputRef = useRef(null);

  // Helper: revoke all current annotated + snapshot Blob URLs to prevent memory leaks
  const revokeImageBlobUrls = () => {
    if (annotatedBlobUrl) URL.revokeObjectURL(annotatedBlobUrl);
    Object.values(snapshotBlobUrls).forEach((u) => { if (u) URL.revokeObjectURL(u); });
  };

  // Clean up all object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (annotatedBlobUrl) URL.revokeObjectURL(annotatedBlobUrl);
      Object.values(snapshotBlobUrls).forEach((u) => { if (u) URL.revokeObjectURL(u); });
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (file) => {
    if (!file) return;
    setError(null);
    setImageResult(null);
    setVideoJob(null);
    // Revoke previous authenticated image Blob URLs
    revokeImageBlobUrls();
    setAnnotatedBlobUrl(null);
    setSnapshotBlobUrls({});

    const isVideo = file.type.startsWith('video/') || /\.(mp4|avi|mov)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

    if (activeTab === 'image' && !isImage) {
      setError("Please select a supported image file (JPG, PNG, WEBP).");
      return;
    }
    if (activeTab === 'video' && !isVideo) {
      setError("Please select a supported video file (MP4, AVI, MOV).");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("Selected file exceeds the 50 MB limit.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageResult(null);
    setVideoJob(null);
    setError(null);
    // Revoke authenticated image Blob URLs
    revokeImageBlobUrls();
    setAnnotatedBlobUrl(null);
    setSnapshotBlobUrls({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  // Run Image Analysis
  const handleAnalyzeImage = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setError(null);
    // Revoke any previous Blob URLs before a fresh analysis
    revokeImageBlobUrls();
    setAnnotatedBlobUrl(null);
    setSnapshotBlobUrls({});
    setImageResult(null);
    setStatusMessage('Uploading image and preparing YOLOv8 inference...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('confidence', confidence);
    formData.append('require_helmet', requireHelmet);
    formData.append('require_vest', requireVest);
    formData.append('require_goggles', requireGoggles);
    formData.append('demo_mode', demoMode);

    try {
      setStatusMessage('Running YOLOv8 PPE detection & spatial rule engine...');
      const result = await api.analyzeImage(formData);
      setImageResult(result);

      // Fetch the annotated image via authenticated request → Blob URL
      // (plain <img> cannot attach the JWT Bearer token to /api/files/* endpoints)
      setStatusMessage('Loading annotated image...');
      const annotBlob = await api.fetchAuthenticatedImage(result.annotated_url);
      setAnnotatedBlobUrl(annotBlob);

      // Fetch violation snapshot thumbnails
      if (result.violations && result.violations.length > 0) {
        const snapMap = {};
        await Promise.all(
          result.violations.map(async (v) => {
            if (v.snapshot_path) {
              snapMap[v.id] = await api.fetchAuthenticatedImage(v.snapshot_path);
            }
          })
        );
        setSnapshotBlobUrls(snapMap);
      }

      setAnalyzing(false);
      setStatusMessage('');
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process image.");
      setAnalyzing(false);
      setStatusMessage('');
    }
  };

  // Run Video Analysis
  const handleAnalyzeVideo = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setError(null);
    setStatusMessage('Uploading video to background processor...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('confidence', confidence);
    formData.append('require_helmet', requireHelmet);
    formData.append('require_vest', requireVest);
    formData.append('require_goggles', requireGoggles);

    try {
      const response = await api.analyzeVideo(formData);
      const jobId = response.job_id;
      setStatusMessage('Video processing queued. Polling frame analysis...');

      // Poll job status every 1.5 seconds
      pollingRef.current = setInterval(async () => {
        try {
          const job = await api.getJobStatus(jobId);
          setVideoJob(job);
          if (job.status === 'completed') {
            clearInterval(pollingRef.current);
            setAnalyzing(false);
          } else if (job.status === 'failed') {
            clearInterval(pollingRef.current);
            setAnalyzing(false);
            setError(job.error_message || "Video processing failed.");
          } else {
            setStatusMessage(`Processing video frames (${job.progress_pct || 0}% completed)...`);
          }
        } catch (pollErr) {
          console.error("Job poll error:", pollErr);
        }
      }, 1500);

    } catch (err) {
      setError(err.message || "Failed to upload video.");
      setAnalyzing(false);
    }
  };

  // Update Violation Audit Status
  const handleUpdateAuditStatus = async (violationId, newStatus) => {
    try {
      await api.updateViolationStatus(violationId, newStatus);
      // Update local state in imageResult
      if (imageResult) {
        const updated = imageResult.violations.map(v =>
          v.id === violationId ? { ...v, audit_status: newStatus } : v
        );
        setImageResult({ ...imageResult, violations: updated });
      }
    } catch (err) {
      alert("Failed to update violation status: " + err.message);
    }
  };

  return (
    <div>
      {/* Page Title & Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Visual Upload & Inspection</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Upload workplace imagery or CCTV footage for automated PPE detection and compliance auditing.
          </p>
        </div>

        {/* Media Selector Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: 'var(--radius-sm)', padding: '4px' }}>
          <button
            onClick={() => { setActiveTab('image'); handleRemoveFile(); }}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'image' ? '#ffffff' : 'transparent',
              color: activeTab === 'image' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'image' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <FileImage size={16} />
            Image Inspection
          </button>
          <button
            onClick={() => { setActiveTab('video'); handleRemoveFile(); }}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'video' ? '#ffffff' : 'transparent',
              color: activeTab === 'video' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'video' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Video size={16} />
            Video Stream Analysis
          </button>
        </div>
      </div>

      {/* Upload and Configuration Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedFile ? '1.2fr 0.8fr' : '1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Upload Zone */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h3 className="card-title">
              <UploadCloud size={18} color="var(--primary)" />
              {activeTab === 'image' ? 'Select Workplace Image' : 'Select Workplace Video'}
            </h3>
            {selectedFile && (
              <button onClick={handleRemoveFile} className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }}>
                <X size={14} /> Remove File
              </button>
            )}
          </div>

          {!selectedFile ? (
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept={activeTab === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/avi,video/quicktime'}
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
              <div className="dropzone-icon">
                {activeTab === 'image' ? <FileImage size={28} /> : <Video size={28} />}
              </div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Drag and drop your {activeTab === 'image' ? 'image' : 'video'} here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {activeTab === 'image'
                  ? 'Supports JPG, JPEG, PNG, WEBP (Max 50 MB)'
                  : 'Supports MP4, AVI, MOV (Max 50 MB)'}
              </div>
            </div>
          ) : (
            <div>
              {/* Media Preview */}
              <div style={{
                maxHeight: '340px',
                backgroundColor: '#020617',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px'
              }}>
                {activeTab === 'image' ? (
                  <img src={previewUrl} alt="Preview" style={{ maxHeight: '340px', maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                  <video src={previewUrl} controls style={{ maxHeight: '340px', maxWidth: '100%' }} />
                )}
              </div>

              {/* File Info Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>
                  <b>File:</b> {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </div>
                <button
                  onClick={activeTab === 'image' ? handleAnalyzeImage : handleAnalyzeVideo}
                  disabled={analyzing}
                  className="btn btn-primary"
                  style={{ minWidth: '160px' }}
                >
                  {analyzing ? (
                    <>
                      <RefreshCw size={16} className="spin-animation" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      {activeTab === 'image' ? 'Analyze Image' : 'Start Video Analysis'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: 'var(--red-light)',
              color: 'var(--red)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.85rem'
            }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Analyzing Progress Message */}
          {analyzing && (
            <div style={{
              marginTop: '16px',
              padding: '14px 18px',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.88rem'
            }}>
              <RefreshCw size={18} className="spin-animation" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Configuration Panel */}
        {selectedFile && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <h3 className="card-title">
                <Sliders size={18} color="var(--teal)" />
                Inspection Parameters
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Confidence Threshold */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <label style={{ fontWeight: 600 }}>Confidence Threshold</label>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{Math.round(confidence * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.85"
                  step="0.05"
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Initial default is 0.40. Higher values filter ambiguous detections.
                </div>
              </div>

              {/* Safety Rules Checklist */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
                  Active Compliance Rules:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={requireHelmet}
                      onChange={(e) => setRequireHelmet(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                    />
                    <span><b>Require Hard Hat / Helmet</b> <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>[High Severity]</span></span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={requireVest}
                      onChange={(e) => setRequireVest(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                    />
                    <span><b>Require Hi-Vis Safety Vest</b> <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>[High Severity]</span></span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={requireGoggles}
                      onChange={(e) => setRequireGoggles(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                    />
                    <span><b>Require Protective Eye Goggles</b> <span style={{ color: 'var(--orange)', fontSize: '0.75rem' }}>[Medium Severity]</span></span>
                  </label>
                </div>
              </div>

              {/* Demonstration Mode Toggle */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={demoMode}
                    onChange={(e) => setDemoMode(e.target.checked)}
                    style={{ accentColor: 'var(--teal)', width: '16px', height: '16px' }}
                  />
                  <span><b>Enable PPE Demonstration Mode</b></span>
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Demonstrates rule evaluation logic when running without custom PPE weights.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* IMAGE RESULTS: SIDE-BY-SIDE PANELS & VIOLATIONS TABLE     */}
      {/* ========================================================== */}
      {imageResult && (
        <div style={{ marginTop: '28px' }}>
          {/* Summary Scorecard Bar */}
          <div className="stat-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-icon blue"><Layers size={22} /></div>
              <div className="stat-content">
                <span className="stat-label">Workers Detected</span>
                <span className="stat-value">{imageResult.total_persons}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon teal"><CheckCircle size={22} /></div>
              <div className="stat-content">
                <span className="stat-label">PPE Detections</span>
                <span className="stat-value">{imageResult.total_ppe_detected}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon red"><AlertOctagon size={22} /></div>
              <div className="stat-content">
                <span className="stat-label">Violations Identified</span>
                <span className="stat-value">{imageResult.total_violations}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green"><Clock size={22} /></div>
              <div className="stat-content">
                <span className="stat-label">Latency / Compliance</span>
                <span className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {imageResult.processing_time_ms}ms / {imageResult.compliance_rate}%
                </span>
              </div>
            </div>
          </div>

          {/* Two Large Panels: Original vs Annotated */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Left Panel: Original Image */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <h3 className="card-title">Original Uploaded Image</h3>
              </div>
              <div style={{
                height: '420px',
                backgroundColor: '#020617',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Original"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ color: '#64748b', textAlign: 'center', fontSize: '0.85rem' }}>
                    <Eye size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <div>Original image unavailable</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Annotated Image */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ color: 'var(--primary)' }}>
                  Annotated Detection Image (YOLOv8)
                </h3>
              </div>
              <div style={{
                height: '420px',
                backgroundColor: '#020617',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {annotatedBlobUrl ? (
                  <img
                    src={annotatedBlobUrl}
                    alt="Annotated"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : analyzing ? (
                  <div style={{ color: '#64748b', textAlign: 'center', fontSize: '0.85rem' }}>
                    <RefreshCw size={28} className="spin-animation" style={{ marginBottom: '8px', opacity: 0.6 }} />
                    <div>Generating annotated image...</div>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', textAlign: 'center', fontSize: '0.85rem' }}>
                    <Sparkles size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <div>Annotated image unavailable</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.6 }}>Check Flask terminal for errors</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Violations Identified Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <AlertTriangle size={18} color="var(--red)" />
                Violations Identified
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Inspection Code: <b>{imageResult.inspection_code}</b>
              </span>
            </div>

            {imageResult.violations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--green)' }}>
                <CheckCircle size={36} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                <b>Zero Safety Violations Detected!</b>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>All detected workers are fully compliant with configured safety rules.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>Snapshot</th>
                      <th>Violation Type</th>
                      <th>Severity</th>
                      <th>Confidence</th>
                      <th>Audit Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageResult.violations.map((v) => (
                      <tr key={v.id}>
                        <td>
                          {v.snapshot_path ? (
                            snapshotBlobUrls[v.id] ? (
                              <img
                                src={snapshotBlobUrls[v.id]}
                                alt="Snapshot"
                                style={{ width: '70px', height: '52px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading...</span>
                            )
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N/A</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{v.type || v.violation_type}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{v.reason || v.notes}</div>
                        </td>
                        <td>
                          <span className={`badge badge-${(v.severity || 'Medium').toLowerCase()}`}>
                            {v.severity}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {Math.round((v.confidence || 0) * 100)}%
                        </td>
                        <td>
                          <span className={`badge badge-${(v.audit_status || 'Detected').toLowerCase().replace(/\s+/g, '-')}`}>
                            {v.audit_status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            {v.audit_status !== 'Verified' && (
                              <button
                                onClick={() => handleUpdateAuditStatus(v.id, 'Verified')}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                title="Mark as Verified Violation"
                              >
                                <Check size={12} /> Verify
                              </button>
                            )}
                            <select
                              value={v.audit_status}
                              onChange={(e) => handleUpdateAuditStatus(v.id, e.target.value)}
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
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIDEO ANALYSIS RESULTS: TIMELINE & CHRONOLOGICAL EVENTS    */}
      {/* ========================================================== */}
      {videoJob && (
        <div style={{ marginTop: '28px' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Video size={18} color="var(--primary)" />
                Video Inspection Summary
              </h3>
              <span className={`badge ${videoJob.status === 'completed' ? 'badge-verified' : 'badge-detected'}`}>
                {videoJob.status.toUpperCase()}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span>Sampling & Inference Progress:</span>
                <b>{videoJob.progress_pct}%</b>
              </div>
              <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${videoJob.progress_pct}%`,
                  backgroundColor: 'var(--primary)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* Video Metric Pills */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              <div><b>Processed Frames:</b> {videoJob.processed_frames}</div>
              <div><b>Video Duration:</b> {videoJob.duration_sec?.toFixed(1) || 0}s</div>
              <div><b>Total Violations:</b> <span style={{ color: 'var(--red)', fontWeight: 700 }}>{videoJob.violations_count}</span></div>
            </div>

            {/* Chronological Timeline */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              Chronological Incident Events
            </h4>

            {videoJob.timeline && videoJob.timeline.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {videoJob.timeline.map((event, idx) => (
                  <div key={idx} style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    backgroundColor: 'var(--bg-card)'
                  }}>
                    <div style={{ position: 'relative', height: '160px', backgroundColor: '#020617' }}>
                      <img
                        src={api.getMediaUrl(event.snapshot_url)}
                        alt="Violation frame"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        Timestamp: {event.timestamp_display}
                      </div>
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {event.violations?.[0]?.type || 'Safety Alert'}
                        </span>
                        <span className="badge badge-high" style={{ fontSize: '0.7rem' }}>High</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Frame #{event.frame_idx} • {event.violations_count} violation(s)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                {videoJob.status === 'completed' ? 'No violations detected across sampled video frames.' : 'Analyzing frames...'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
