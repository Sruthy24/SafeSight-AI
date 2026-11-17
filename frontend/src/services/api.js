/**
 * SafeSight AI - API Client Service
 * Centralized service for communicating with Flask REST API.
 * All requests automatically include the JWT Authorization header.
 * A 401 response clears the stored token and redirects to /login.
 */

import { getToken } from './authService';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

/**
 * Build default headers for every request.
 * Attaches Bearer token when one exists in localStorage.
 */
function buildHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Handle 401 responses by clearing auth state and redirecting to /login.
 * Avoids circular dependency by directly touching localStorage + location.
 */
function handleUnauthorized() {
  localStorage.removeItem('safesight_access_token');
  localStorage.removeItem('safesight_user');
  // Only redirect if not already on the auth pages
  if (!window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/register')) {
    window.location.href = '/login';
  }
}

async function handleResponse(response) {
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }
  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      }
    } catch {
      // Keep default errorMsg
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export const api = {
  /**
   * Build a full URL for a media subpath returned by the backend.
   * Respects VITE_API_BASE so it works in any environment.
   *
   * Backend returns paths like:
   *   "api/files/uploads/<filename>"
   *   "api/files/processed/<filename>"
   *
   * We strip the leading "api/" so we don't double-up with the "/api" already in API_BASE.
   */
  getMediaUrl(subpath) {
    if (!subpath) return '';
    if (subpath.startsWith('http://') || subpath.startsWith('https://')) return subpath;
    // Strip leading "api/" if present (backend includes it, API_BASE already ends with /api)
    const withoutApiPrefix = subpath.startsWith('api/') ? subpath.slice(4) : subpath;
    const clean = withoutApiPrefix.replace(/^\/+/, '');
    return `${API_BASE}/${clean}`;
  },

  /**
   * Fetch a JWT-protected image URL with the Bearer token and return a Blob URL.
   *
   * This is necessary because plain <img src="..."> browser requests cannot attach
   * Authorization headers, so the @jwt_required() /api/files/* endpoint returns 401.
   *
   * Returns a blob: URL string on success, or null on any error (401, 404, network, etc.).
   * Callers are responsible for calling URL.revokeObjectURL(blobUrl) when done.
   */
  async fetchAuthenticatedImage(subpath) {
    if (!subpath) return null;
    const url = this.getMediaUrl(subpath);
    try {
      const res = await fetch(url, { headers: buildHeaders() });
      if (!res.ok) {
        console.warn(`[SafeSight] Image fetch failed: ${res.status} ${res.statusText} — ${url}`);
        return null;
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error(`[SafeSight] Image fetch error for ${url}:`, err);
      return null;
    }
  },

  // Health and System Status (public – no token needed, but included if present)
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`, {
      headers: buildHeaders(),
    });
    if (!res.ok) throw new Error('Backend offline');
    return res.json();
  },

  // Dashboard Analytics
  async getDashboardStats(demo = false) {
    const res = await fetch(`${API_BASE}/dashboard/stats?demo=${demo}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  // Image Analysis
  async analyzeImage(formData) {
    const res = await fetch(`${API_BASE}/analyze/image`, {
      method: 'POST',
      headers: buildHeaders(), // Do NOT set Content-Type for FormData (browser sets it with boundary)
      body: formData,
    });
    return handleResponse(res);
  },

  // Video Analysis
  async analyzeVideo(formData) {
    const res = await fetch(`${API_BASE}/analyze/video`, {
      method: 'POST',
      headers: buildHeaders(),
      body: formData,
    });
    return handleResponse(res);
  },

  // Video Job Status Polling
  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  // Inspections
  async getInspections(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inspections?${query}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  async getInspectionById(id) {
    const res = await fetch(`${API_BASE}/inspections/${id}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  // Violations & Audit
  async getViolations(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/violations?${query}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  async updateViolationStatus(violationId, auditStatus, notes = '') {
    const res = await fetch(`${API_BASE}/violations/${violationId}`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ audit_status: auditStatus, notes }),
    });
    return handleResponse(res);
  },

  // Reports
  async generateReport(payload) {
    const res = await fetch(`${API_BASE}/reports/generate`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async getReports(limit = 50) {
    const res = await fetch(`${API_BASE}/reports?limit=${limit}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  getReportDownloadUrl(reportId) {
    // Append token as query param so the browser can open the PDF directly
    const token = getToken();
    const base = `${API_BASE}/reports/${reportId}/download`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },

  // ── Milestone 2: Document Intelligence ─────────────────────────────────────

  /** Upload a PDF or TXT document */
  async uploadDocument(formData) {
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: buildHeaders(),
      body: formData,
    });
    return handleResponse(res);
  },

  /** List all uploaded/indexed documents */
  async listDocuments() {
    const res = await fetch(`${API_BASE}/documents/list`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  /** Trigger extraction + chunking + embedding + indexing for a document */
  async processDocument(docId) {
    const res = await fetch(`${API_BASE}/documents/${docId}/process`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
    });
    return handleResponse(res);
  },

  /** Semantic search across all indexed documents */
  async searchDocuments(query, topK = 5) {
    const res = await fetch(`${API_BASE}/documents/search`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query, top_k: topK }),
    });
    return handleResponse(res);
  },

  /** AI Q&A: answer a question from document content */
  async askDocument(question, topK = 3) {
    const res = await fetch(`${API_BASE}/documents/ask`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ question, top_k: topK }),
    });
    return handleResponse(res);
  },

  /** Delete a document from the knowledge base */
  async deleteDocument(docId) {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  // ── Milestone 3: Multimodal AI Assistant & LangGraph Workflows ───────────

  /** Run LangGraph agent on user question */
  async askAgent(question) {
    const res = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ question }),
    });
    return handleResponse(res);
  },

  /** Get suggested questions for AI Assistant */
  async getSuggestedQuestions() {
    const res = await fetch(`${API_BASE}/agent/suggested`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  // ── Milestone 3: Incident Management ─────────────────────────────────────

  /** List incidents with optional filters */
  async getIncidents(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/incidents?${query}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  /** Get single incident details */
  async getIncidentById(incidentId) {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  /** Update incident status & notes */
  async updateIncidentStatus(incidentId, status, notes = '') {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, notes }),
    });
    return handleResponse(res);
  },

  // ── Milestone 3: Supervisor Alerts ───────────────────────────────────────

  /** List supervisor alerts */
  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/alerts?${query}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  /** Mark alert as read */
  async markAlertRead(alertId) {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/read`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
    });
    return handleResponse(res);
  },

  /** Acknowledge alert */
  async acknowledgeAlert(alertId, supervisorName = '') {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
      method: 'PATCH',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ supervisor_name: supervisorName }),
    });
    return handleResponse(res);
  },
};

export default api;
