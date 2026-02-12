// auth.js - Módulo de autenticación standalone

const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:8787"
  : "https://posmin-auth-service.eliseo050595.workers.dev";

const REFRESH_TOKEN_KEY = "refresh_token";
const REFRESH_INTERVAL = 252e5;

let authState = {
  access: null,
  refresh: null,
  user: null,
};

let refreshInterval = null;

function getStoredRefresh() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setStoredRefresh(token) {
  token
    ? localStorage.setItem(REFRESH_TOKEN_KEY, token)
    : localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function apiCall(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (authState.access) {
    options.headers.Authorization = `Bearer ${authState.access}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (response.status === 401 && endpoint !== "/refresh") {
    try {
      await refreshToken();

      const retry = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${authState.access}`,
        },
      });

      if (!retry.ok) throw new Error("Retry failed");
      return retry.json();
    } catch (error) {
      logout();
      throw error;
    }
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Error desconocido" }));
    throw new Error(error.error || error.message || "Error en la petición");
  }

  return response.json();
}

async function register(email, password, company_name) {
  return await apiCall("/register", "POST", {
    email,
    password,
    company_name,
  });
}

async function login(email, password) {
  const res = await apiCall("/login", "POST", { email, password });

  authState = {
    access: res.accessToken,
    refresh: res.refreshToken,
    user: res.user,
  };

  setStoredRefresh(res.refreshToken);
  startAutoRefresh();

  return res;
}

async function refreshToken() {
  const stored = getStoredRefresh();
  if (!stored) throw new Error("No hay refresh token");

  const res = await apiCall("/refresh", "POST", {
    refresh_token: stored,
  });

  authState.access = res.accessToken;
  authState.refresh = res.refreshToken;
  authState.user = res.user;

  setStoredRefresh(res.refreshToken);

  return res;
}

async function logout() {
  stopAutoRefresh();

  try {
    await apiCall("/logout", "POST");
  } catch (error) {
    console.error("Error al hacer logout:", error);
  } finally {
    authState = { access: null, refresh: null, user: null };
    setStoredRefresh(null);
    window.location.replace("/index.html");
  }
}

function startAutoRefresh() {
  stopAutoRefresh();

  refreshInterval = setInterval(async () => {
    try {
      await refreshToken();
    } catch (error) {
      console.error("Error auto-refresh:", error);
      logout();
    }
  }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

async function initAuth() {
  const stored = getStoredRefresh();
  if (!stored) throw new Error("No autenticado");

  const res = await refreshToken();
  startAutoRefresh();
  return res;
}

function requireAuth() {
  if (!getStoredRefresh()) {
    window.location.replace("/index.html");
  }
}

function isAuthenticated() {
  return !!getStoredRefresh();
}

function getUser() {
  return authState.user;
}

function getAccessToken() {
  return authState.access;
}

function hasRole(...roles) {
  return authState.user && roles.includes(authState.user.role);
}

async function apiRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (authState.access) {
    options.headers.Authorization = `Bearer ${authState.access}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Error desconocido" }));
    throw new Error(error.error || error.message || "Error en la petición");
  }

  return response.json();
}

export {
  register,
  login,
  logout,
  refreshToken,
  initAuth,
  requireAuth,
  isAuthenticated,
  getUser,
  getAccessToken,
  hasRole,
  apiRequest,
};
