import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});



// Request interceptor — attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sq_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle errors globally with auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const message =
      error.response?.data?.message || error.message || 'Something went wrong.';

    // Auto-logout on 401 — but skip for auth endpoints and already-retried requests
    if (error.response?.status === 401) {
      const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/refresh');

      // Don't attempt refresh for auth endpoints or already-retried requests
      if (isAuthEndpoint || originalRequest._retry) {
        // For non-auth endpoints that failed retry, redirect to login
        if (!isAuthEndpoint && window.location.pathname !== '/login') {
          localStorage.removeItem('sq_token');
          localStorage.removeItem('sq_user');
          localStorage.removeItem('sq_refresh_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Attempt token refresh
      const refreshToken = localStorage.getItem('sq_refresh_token');
      if (refreshToken) {
        originalRequest._retry = true;

        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          const { token: newToken, refreshToken: newRefreshToken } = res.data.data;

          localStorage.setItem('sq_token', newToken);
          if (newRefreshToken) {
            localStorage.setItem('sq_refresh_token', newRefreshToken);
          }

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('sq_token');
          localStorage.removeItem('sq_user');
          localStorage.removeItem('sq_refresh_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token available — redirect to login
        localStorage.removeItem('sq_token');
        localStorage.removeItem('sq_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Don't toast for validation errors (let forms handle them)
    if (error.response?.status !== 400) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
