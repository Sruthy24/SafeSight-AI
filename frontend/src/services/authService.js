/**
 * SafeSight AI – Authentication Service
 * Handles login, registration, logout and JWT token management.
 * All communication with the backend auth endpoints lives here.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const TOKEN_KEY = 'safesight_access_token';
const USER_KEY  = 'safesight_user';

// ── Token Helpers ────────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function parseResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  if (!res.ok) {
    // Forward validation field errors or a generic message
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.fields = data.fields || null;
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Register a new user account.
 * @returns {{ access_token, user }}
 */
export async function register(fullName, email, password, confirmPassword) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
      confirm_password: confirmPassword,
    }),
  });
  const data = await parseResponse(res);
  saveToken(data.access_token);
  saveUser(data.user);
  return data;
}

/**
 * Log in with email + password.
 * @returns {{ access_token, user }}
 */
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseResponse(res);
  saveToken(data.access_token);
  saveUser(data.user);
  return data;
}

/**
 * Notify the backend and clear local state.
 */
export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore network errors on logout – local state is cleared regardless
    }
  }
  clearStorage();
}

/**
 * Fetch the current user profile from the backend (validates token).
 */
export async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    clearStorage();
    return null;
  }
  const data = await res.json();
  saveUser(data.user);
  return data.user;
}

const authService = {
  getToken,
  isAuthenticated,
  getCachedUser,
  register,
  login,
  logout,
  fetchCurrentUser,
};

export default authService;
