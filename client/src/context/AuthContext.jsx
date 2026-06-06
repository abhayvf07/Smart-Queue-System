import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('sq_token'));
  const [loading, setLoading] = useState(true);

  // Load user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.data.user);
        } catch {
          // Token invalid/expired
          localStorage.removeItem('sq_token');
          localStorage.removeItem('sq_user');
          localStorage.removeItem('sq_refresh_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  const register = useCallback(async (name, email, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, password });
      const { user: userData, token: jwtToken, refreshToken } = res.data.data;

      localStorage.setItem('sq_token', jwtToken);
      localStorage.setItem('sq_user', JSON.stringify(userData));
      localStorage.setItem('sq_refresh_token', refreshToken);
      setToken(jwtToken);
      setUser(userData);

      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed.';
      return { success: false, message };
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user: userData, token: jwtToken, refreshToken } = res.data.data;

      localStorage.setItem('sq_token', jwtToken);
      localStorage.setItem('sq_user', JSON.stringify(userData));
      localStorage.setItem('sq_refresh_token', refreshToken);
      setToken(jwtToken);
      setUser(userData);

      toast.success(`Welcome back, ${userData.name}!`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed.';
      return { success: false, message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('sq_refresh_token');
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Logout API call failed — still clear local state
    }
    localStorage.removeItem('sq_token');
    localStorage.removeItem('sq_user');
    localStorage.removeItem('sq_refresh_token');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully.');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
