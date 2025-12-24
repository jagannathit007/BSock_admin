import { io, Socket } from 'socket.io-client';
import { LOCAL_STORAGE_KEYS } from '../../constants/localStorage';
import toastHelper from '../../utils/toastHelper';

type UserType = 'admin' | 'customer' | 'seller';

class SocketServiceClass {
  private socket: Socket | null = null;

  connect(baseUrl?: string) {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN);
    if (!token) return;

    const url = baseUrl || (import.meta.env.VITE_BASE_URL as string);
    if (!url) return;

    if (this.socket) {
      if (this.socket.connected) return;
      try { this.socket.disconnect(); } catch {}
      this.socket = null;
    }

    this.socket = io(url, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected', this.socket?.id);
      // Auto-join room when connected
      this.joinRoom();
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Message listener for backend userMessage
    this.socket.on('userMessage', (payload: any) => {
      console.log('Received userMessage:', payload);
    });

    // Message listener for sendToAll
    this.socket.on('message', (payload: any) => {
      console.log('Received broadcast message:', payload);
    });

    // Listen for force logout event (when permissions/role are changed)
    this.socket.on('forceLogout', (payload: any) => {
      console.log('Received forceLogout event:', payload);
      this.handleForceLogout(payload);
    });

    // Listen for new order event (when customer places an order)
    this.socket.on('newOrder', (payload: any) => {
      console.log('Received newOrder event:', payload);
      this.handleNewOrder(payload);
    });
  }

  // Handle force logout event
  private handleForceLogout(payload: any) {
    const reason = payload.reason || 'Your permissions have been updated. Please login again.';
    
    // Show toast notification
    toastHelper.showTost(reason, 'warning');
    
    // Clear localStorage
    localStorage.removeItem(LOCAL_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_ID);
    localStorage.removeItem('adminPermissions');
    localStorage.removeItem('adminRole');
    
    // Disconnect socket
    this.disconnect();
    
    // Use setTimeout to allow toast to show before redirect
    setTimeout(() => {
      // Use window.location to force a full page reload and redirect
      // This ensures all state is cleared
      window.location.href = '/signin';
    }, 1500); // 1.5 second delay to show toast
  }

  // Store callback for new order handling
  private newOrderCallback: ((data: any) => void) | null = null;

  // Register callback for new order event
  onNewOrder(callback: (data: any) => void) {
    this.newOrderCallback = callback;
  }

  // Remove new order callback
  removeNewOrderCallback() {
    this.newOrderCallback = null;
  }

  // Handle new order event
  private handleNewOrder(payload: any) {
    const orderData = payload.order || {};
    const message = payload.message || `New order placed: ${orderData.orderNo || orderData.orderId}`;
    
    // Show toast notification
    toastHelper.showTost(message, 'info');
    
    // Call registered callback if available
    if (this.newOrderCallback) {
      this.newOrderCallback(payload);
    } else {
      // Default behavior: redirect to orders page
      const redirectPath = payload.redirectTo || '/orders';
      // Use HashRouter navigation (window.location.hash)
      window.location.hash = `#${redirectPath}`;
    }
  }

  disconnect() {
    if (this.socket) {
      try { this.socket.removeAllListeners(); } catch {}
      try { this.socket.disconnect(); } catch {}
      this.socket = null;
    }
  }

  get instance(): Socket | null {
    return this.socket;
  }

  // Get user data from localStorage
  private getUserData(): { userId: string; userType: UserType } | null {
    const userId = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_ID);
    
    if (!userId) {
      console.warn('Missing userId in localStorage');
      return null;
    }
    
    return { userId, userType:'admin' };
  }

  // Join room with userId and userType
  joinRoom() {
    console.log('Attempting to join room...');
    if (!this.socket) return;
    console.log('Socket instance exists');
    
    const userData = this.getUserData();
    console.log('User data:', userData);
    if (!userData) return;
    
    this.socket.emit('joinRoom', {
      userId: userData.userId,
      userType: userData.userType
    });
  }

  // Leave room
  leaveRoom() {
    if (!this.socket) return;
    
    const userData = this.getUserData();
    if (!userData) return;
    
    this.socket.emit('leaveRoom', {
      userId: userData.userId,
      userType: userData.userType
    });
  }

  // Send message to all connected users
  sendToAll(message: any) {
    if (!this.socket) return;
    this.socket.emit('sendToAll', message);
  }

  // Negotiation-specific socket methods
  joinNegotiation(negotiationId: string) {
    if (!this.socket) return;
    
    const userData = this.getUserData();
    if (!userData) return;
    
    this.socket.emit('joinNegotiation', {
      negotiationId,
      userId: userData.userId,
      userType: userData.userType
    });
  }

  leaveNegotiation(negotiationId: string) {
    if (!this.socket) return;
    
    const userData = this.getUserData();
    if (!userData) return;
    
    this.socket.emit('leaveNegotiation', {
      negotiationId,
      userId: userData.userId,
      userType: userData.userType
    });
  }

  // Listen for negotiation notifications
  onNegotiationNotification(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('negotiationNotification', callback);
  }

  // Listen for negotiation broadcasts
  onNegotiationBroadcast(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('negotiationBroadcast', callback);
  }

  // Listen for negotiation updates
  onNegotiationUpdate(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('negotiationUpdate', callback);
  }

  // Listen for user joining/leaving negotiations
  onUserJoinedNegotiation(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('userJoinedNegotiation', callback);
  }

  onUserLeftNegotiation(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('userLeftNegotiation', callback);
  }

  // Listen for typing indicators
  onUserTyping(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('userTyping', callback);
  }

  // Send typing indicator
  sendNegotiationTyping(negotiationId: string, isTyping: boolean) {
    if (!this.socket) return;
    
    const userData = this.getUserData();
    if (!userData) return;
    
    this.socket.emit('negotiationTyping', {
      negotiationId,
      userId: userData.userId,
      userType: userData.userType,
      isTyping
    });
  }

  // Mark negotiation as read
  markNegotiationRead(negotiationId: string) {
    if (!this.socket) return;
    
    const userData = this.getUserData();
    if (!userData) return;
    
    this.socket.emit('markNegotiationRead', {
      negotiationId,
      userId: userData.userId,
      userType: userData.userType
    });
  }

  // Remove all negotiation listeners
  removeNegotiationListeners() {
    if (!this.socket) return;
    this.socket.off('negotiationNotification');
    this.socket.off('negotiationBroadcast');
    this.socket.off('negotiationUpdate');
    this.socket.off('userJoinedNegotiation');
    this.socket.off('userLeftNegotiation');
    this.socket.off('userTyping');
    this.socket.off('negotiationRead');
  }

  // Listen for force logout event
  onForceLogout(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('forceLogout', callback);
  }

  // Remove force logout listener
  offForceLogout() {
    if (!this.socket) return;
    this.socket.off('forceLogout');
  }
}

export const SocketService = new SocketServiceClass();