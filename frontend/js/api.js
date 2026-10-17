// FeeFlow Centralized API Client
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('feeflow_token');
  },

  setToken(token) {
    localStorage.setItem('feeflow_token', token);
  },

  getUser() {
    const u = localStorage.getItem('feeflow_user');
    try {
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('feeflow_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('feeflow_token');
    localStorage.removeItem('feeflow_user');
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.clearSession();
        // Redirect to login if on protected page
        const path = window.location.pathname;
        if (path.includes('/pages/admin/') || path.includes('/pages/student/')) {
          window.location.href = '/login.html?expired=1';
        }
        throw new Error('Your session has expired. Please log in again.');
      }

      const resData = await response.json();

      if (!response.ok || resData.success === false) {
        throw new Error(resData.error || resData.message || 'Request failed');
      }

      return resData;
    } catch (err) {
      console.error('API Request Error:', err);
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
