import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const { token } = useAuth();
  const tokenRef = useRef(token);

  // Keep tokenRef in sync without triggering reconnection
  useEffect(() => {
    tokenRef.current = token;
    // Dynamically update the auth token on the connected socket
    if (socketRef.current) {
      socketRef.current.auth.token = token;
      // If disconnected (e.g. token was null, now has value), reconnect
      if (token && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    }
  }, [token]);

  // Single connection lifecycle — does NOT depend on [token]
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    socketRef.current = io(apiUrl, {
      auth: { token: tokenRef.current },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      setConnected(true);
      console.log('Socket connected:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected');
    });

    socketRef.current.on('connect_error', (err) => {
      console.log('Socket connection error:', err.message);
    });

    socketRef.current.on('overload:alert', (data) => {
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-in fade-in zoom-in duration-300' : 'animate-out fade-out zoom-out duration-300'
          } max-w-md w-full bg-slate-900/95 border border-red-500/30 shadow-2xl rounded-xl pointer-events-auto flex ring-1 ring-black/5 backdrop-blur-xl`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-slate-100">
                  Queue Overload Alert
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {data.message || `Service is experiencing heavy traffic!`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-slate-800">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-slate-200 focus:outline-none cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      ), {
        id: `overload-${data.serviceId}`,
        duration: 8000,
      });
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []); // Empty dependency — single connection lifecycle

  const joinService = useCallback((serviceId) => {
    socketRef.current?.emit('join:service', serviceId);
  }, []);

  const leaveService = useCallback((serviceId) => {
    socketRef.current?.emit('leave:service', serviceId);
  }, []);

  const joinDisplay = useCallback((serviceId) => {
    socketRef.current?.emit('join:display', serviceId);
  }, []);

  return (
    <SocketContext.Provider
      value={{ socket: socketRef.current, connected, joinService, leaveService, joinDisplay }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};