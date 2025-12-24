import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SocketService } from '../services/socket/socket';
import { LOCAL_STORAGE_KEYS } from '../constants/localStorage';

type SocketContextValue = {
  socket: any | null;
  socketService: typeof SocketService | null;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, socketService: null });

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<any | null>(null);
  const [socketService, setSocketService] = useState<typeof SocketService | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN);
    if (token) {
      SocketService.connect();
      setSocket(SocketService.instance);
      setSocketService(SocketService);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEYS.TOKEN) {
        if (e.newValue) {
          SocketService.connect();
          setSocket(SocketService.instance);
          setSocketService(SocketService);
        } else {
          SocketService.disconnect();
          setSocket(null);
          setSocketService(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      // Cleanup new order callback on unmount
      SocketService.removeNewOrderCallback();
    };
  }, []);

  const value = useMemo(() => ({ socket, socketService }), [socket, socketService]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}


