import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    // Connect socket
    const socketInstance = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Socket connected:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected');
    });

    socketInstance.on('connect_error', (err) => {
      console.log('Socket connection error:', err.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  // Join a service room
  const joinService = (serviceId) => {
    if (socket) {
      socket.emit('join:service', serviceId);
    }
  };

  // Leave a service room
  const leaveService = (serviceId) => {
    if (socket) {
      socket.emit('leave:service', serviceId);
    }
  };

  // Join live display room
  const joinDisplay = (serviceId) => {
    if (socket) {
      socket.emit('join:display', serviceId);
    }
  };

  return (
    <SocketContext.Provider
      value={{ socket, connected, joinService, leaveService, joinDisplay }}
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
