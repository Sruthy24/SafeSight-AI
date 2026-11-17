import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BookOpen, UploadCloud, FileText, Search, MessageSquare,
  CheckCircle, AlertCircle, Loader2, Trash2, ChevronDown,
  ChevronUp, FileSearch, Brain, X, RefreshCw, Database
} from 'lucide-react';
import api from '../services/api';

/* ─── helpers ─────────────────────────────────────────── */
const STATUS_META = {
  uploaded:   { label: 'Uploaded',   color: '#2563eb', bg: '#eff6ff' },
  processing: { label: 'Processing', color: '#f97316', bg: '#fff7ed' },
  indexed:    { label: 'Indexed',    color: '#10b981', bg: '#ecfdf5' },
  error:      { label: 'Error',      color: '#ef4444', bg: '#fef2f2' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.uploaded;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 12,
      fontSize: '0.73rem', fontWeight: 700,
      background: m.bg, color: m.color,
    }}>
      {status === 'processing' && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
      {status === 'indexed'    && <CheckCircle size={11} />}
      {status === 'error'      && <AlertCircle size={11} />}
      {m.label}
    </span>
  );
}

function SourceCard({ source, index }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="doc-source-card">
      <button className="doc-source-header" onClick={() => setOpen(p => !p)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={14} color="#2563eb" />
          <strong style={{ fontSize: '0.85rem' }}>{source.filename}</strong>
          <span className="doc-source-page">Page {source.page}</span>
          <span style={{ marginLeft: 6, fontSize: '0.73rem', color: '#94a3b8' }}>
            Score: {(source.score * 100).toFixed(1)}%
          </span>
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <p className="doc-source-text">{source.text}</p>
      )}
    </div>
  );
}

/* ─── Main Page Component ─────────────────────────────── */
export default function DocumentIntelligencePage() {
  /* Upload state */
  const [dragging, setDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null); // {type:'success'|'error', text}
  const fileInputRef = useRef(null);

  /* Documents list state */
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());

  /* Search state */
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);

  /* Q&A state */
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [qaResult, setQaResult] = useState(null);
  const [qaError, setQaError] = useState(null);

  /* Fetch documents on mount */
  useEffect(() => { fetchDocuments(); }, []);

  async function fetchDocuments() {
    setLoadingDocs(true);
    try {
      const data = await api.listDocuments();
      setDocuments(data.documents || []);
    } catch (e) {
      console.error('Failed to load documents', e);
    } finally {
      setLoadingDocs(false);
    }
  }

  /* ── Drag-and-drop handlers ───── */
  const onDragOver = useCallback(e => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }, []);

  function selectFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt'].includes(ext)) {
      setUploadMsg({ type: 'error', text: 'Only PDF and TXT files are supported.' });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadMsg({ type: 'error', text: 'File exceeds 50 MB limit.' });
      return;
    }
    setUploadFile(file);
    setUploadMsg(null);
  }

  /* ── Upload ────────────────────── */
  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const data = await api.uploadDocument(fd);
      setUploadMsg({ type: 'success', text: `"${data.original_name}" uploaded! Now click Process.` });
      setUploadFile(null);
      await fetchDocuments();
    } catch (e) {
      setUploadMsg({ type: 'error', text: e.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  /* ── Process ───────────────────── */
  async function handleProcess(docId) {
    setProcessingIds(prev => new Set(prev).add(docId));
    // Optimistically update status in list
    setDocuments(prev =>
      prev.map(d => d.doc_id === docId ? { ...d, status: 'processing' } : d)
    );
    try {
      await api.processDocument(docId);
      await fetchDocuments();
    } catch (e) {
      setDocuments(prev =>
        prev.map(d => d.doc_id === docId ? { ...d, status: 'error', error: e.message } : d)
      );
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(docId); return s; });
    }
  }

  /* ── Delete ────────────────────── */
  async function handleDelete(docId, name) {
    if (!window.confirm(`Delete "${name}" from the knowledge base?`)) return;
    try {
      await api.deleteDocument(docId);
      setDocuments(prev => prev.filter(d => d.doc_id !== docId));
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  /* ── Search ────────────────────── */
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    setSearchError(null);
    try {
      const data = await api.searchDocuments(searchQuery.trim(), 5);
      setSearchResults(data);
    } catch (e) {
      setSearchError(e.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  /* ── Q&A ───────────────────────── */
  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setQaResult(null);
    setQaError(null);
    try {
      const data = await api.askDocument(question.trim(), 3);
      setQaResult(data);
    } catch (e) {
      setQaError(e.message || 'Q&A failed.');
    } finally {
      setAsking(false);
    }
  }

  const indexedCount = documents.filter(d => d.status === 'indexed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page header ── */}
      <div className="doc-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="stat-icon blue" style={{ width: 44, height: 44 }}>
            <BookOpen size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Document Intelligence
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Upload, extract, and query your safety documents using AI
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--green-light)', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, color: 'var(--green)' }}>
            <Database size={13} />
            {indexedCount} document{indexedCount !== 1 ? 's' : ''} indexed
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchDocuments} disabled={loadingDocs}>
            <RefreshCw size={13} style={loadingDocs ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Two-column row: Upload + Documents ── */}
      <div className="doc-two-col">
        {/* Upload Panel */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <div className="card-title"><UploadCloud size={16} /> Upload Document</div>
          </div>

          {/* Dropzone */}
          <div
            className={`dropzone ${dragging ? 'active' : ''}`}
            style={{ minHeight: 160, marginBottom: 16 }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !uploadFile && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) selectFile(e.target.files[0]); e.target.value = ''; }}
            />
            {uploadFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
                <div className="dropzone-icon" style={{ background: 'var(--primary-light)' }}>
                  <FileText size={22} color="var(--primary)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {uploadFile.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                  onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadMsg(null); }}
                >
                  <X size={16} /> Remove
                </button>
              </div>
            ) : (
              <>
                <div className="dropzone-icon">
                  <UploadCloud size={24} />
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Drag &amp; drop or click to select
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  PDF or TXT · Max 50 MB
                </div>
              </>
            )}
          </div>

          {uploadMsg && (
            <div className={`doc-alert ${uploadMsg.type === 'error' ? 'doc-alert-error' : 'doc-alert-success'}`}>
              {uploadMsg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
              {uploadMsg.text}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!uploadFile || uploading}
            onClick={handleUpload}
          >
            {uploading
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
              : <><UploadCloud size={15} /> Upload Document</>}
          </button>
        </div>

        {/* Documents List */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <div className="card-title"><FileText size={16} /> Documents ({documents.length})</div>
          </div>

          {loadingDocs ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: '20px 0' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          ) : documents.length === 0 ? (
            <div className="doc-empty-state">
              <FileText size={36} color="#cbd5e1" />
              <span>No documents yet. Upload one to get started.</span>
            </div>
          ) : (
            <div className="doc-list">
              {documents.map(doc => (
                <div key={doc.doc_id} className="doc-list-item">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                    <FileText size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.original_name || doc.filename}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                        {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                        {doc.size_mb && <span>{doc.size_mb} MB</span>}
                      </div>
                      {doc.error && (
                        <div style={{ fontSize: '0.73rem', color: 'var(--red)', marginTop: 3 }}>{doc.error}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <StatusBadge status={doc.status} />
                    {(doc.status === 'uploaded' || doc.status === 'error') && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={processingIds.has(doc.doc_id)}
                        onClick={() => handleProcess(doc.doc_id)}
                      >
                        {processingIds.has(doc.doc_id)
                          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Brain size={12} />}
                        Process
                      </button>
                    )}
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--red-light)', color: 'var(--red)', border: 'none', padding: '5px 8px' }}
                      onClick={() => handleDelete(doc.doc_id, doc.original_name || doc.filename)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Search Panel ── */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-header">
          <div className="card-title"><FileSearch size={16} /> Semantic Search</div>
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="doc-search-input"
              placeholder="Search your documents… e.g. 'PPE requirements for confined spaces'"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              disabled={searching}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!searchQuery.trim() || searching}>
            {searching
              ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <Search size={15} />}
            Search
          </button>
        </form>

        {searchError && (
          <div className="doc-alert doc-alert-error"><AlertCircle size={14} />{searchError}</div>
        )}

        {searchResults && (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} for "{searchResults.query}"
            </div>
            {searchResults.results.length === 0 ? (
              <div className="doc-empty-state">
                <Search size={32} color="#cbd5e1" />
                <span>No matching content found. Try a different query.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {searchResults.results.map((r, i) => (
                  <div key={r.chunk_id} className="doc-result-card">
                    <div className="doc-result-meta">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={13} color="#2563eb" />
                        <strong>{r.filename}</strong>
                        <span className="doc-source-page">Page {r.page}</span>
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>
                        {(r.score * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="doc-result-text">{r.text}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!searchResults && !searchError && (
          <div className="doc-empty-state" style={{ border: 'none', background: 'none' }}>
            <Search size={32} color="#cbd5e1" />
            <span>Enter a query above to find relevant content across all indexed documents.</span>
          </div>
        )}
      </div>

      {/* ── Q&A Panel ── */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-header">
          <div className="card-title"><MessageSquare size={16} /> AI Question &amp; Answer</div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Answers are extracted directly from your documents
          </span>
        </div>

        <form onSubmit={handleAsk} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <MessageSquare size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="doc-search-input"
              placeholder="Ask a question… e.g. 'What PPE is required on the factory floor?'"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              disabled={asking}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!question.trim() || asking}>
            {asking
              ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <Brain size={15} />}
            Ask AI
          </button>
        </form>

        {qaError && (
          <div className="doc-alert doc-alert-error"><AlertCircle size={14} />{qaError}</div>
        )}

        {qaResult && (
          <div>
            {/* Answer box */}
            <div className="doc-answer-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                <Brain size={16} color="#2563eb" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>AI Answer</span>
                {qaResult.found
                  ? <span style={{ marginLeft: 'auto', fontSize: '0.73rem', color: 'var(--green)', fontWeight: 600 }}>✓ Based on document content</span>
                  : <span style={{ marginLeft: 'auto', fontSize: '0.73rem', color: 'var(--orange)', fontWeight: 600 }}>⚠ Not found in documents</span>}
              </div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>
                {qaResult.answer}
              </p>
            </div>

            {/* Source references */}
            {qaResult.sources.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Source References ({qaResult.sources.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {qaResult.sources.map((s, i) => <SourceCard key={i} source={s} index={i} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {!qaResult && !qaError && (
          <div className="doc-empty-state" style={{ border: 'none', background: 'none' }}>
            <Brain size={32} color="#cbd5e1" />
            <span>Ask any question about your indexed documents. Answers are grounded in real content — never hallucinated.</span>
          </div>
        )}
      </div>
    </div>
  );
}
