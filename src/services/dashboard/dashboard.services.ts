import api from '../api/api';

export interface DashboardStats {
  customers: {
    total: number;
    today: number;
    change: number;
    isPositive: boolean;
  };
  orders: {
    total: number; // Total delivered orders count
    today: number; // Today delivered orders
    todayPlaced?: number; // Today orders placed
    change: number;
    isPositive: boolean;
  };
  sales: {
    total: number; // Total sales amount
    today: number;
    change: number;
    isPositive: boolean;
  };
  products: {
    total: number;
    active: number; // Approved products count
  };
  bids: {
    active: number;
  };
  wallet: {
    total: number; // Total wallet balance
  };
}

export interface ChartData {
  period: 'today' | 'week' | 'month' | 'year';
  categories: string[];
  data: number[];
  total: number;
}

export interface RecentOrder {
  id: string;
  orderId: string;
  name: string;
  variants: string;
  category: string;
  price: string;
  status: 'Delivered' | 'Pending' | 'Canceled';
  originalStatus: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  totalAmount: number;
  itemCount: number;
  image: string;
}

export const DashboardService = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.post('/api/admin/dashboard/stats', {});
    return response.data.data;
  },

  getSalesChart: async (period: 'today' | 'week' | 'month' | 'year' = 'month'): Promise<ChartData> => {
    const response = await api.post('/api/admin/dashboard/sales-chart', { period });
    return response.data.data;
  },

  getCustomersChart: async (period: 'today' | 'week' | 'month' | 'year' = 'month'): Promise<ChartData> => {
    const response = await api.post('/api/admin/dashboard/customers-chart', { period });
    return response.data.data;
  },

  getRecentOrders: async (limit: number = 5): Promise<RecentOrder[]> => {
    const response = await api.post('/api/admin/dashboard/recent-orders', { limit });
    // Ensure we always return an array, even if the response structure is different
    const orders = response.data?.data?.orders || response.data?.orders || response.data?.data || [];
    return Array.isArray(orders) ? orders : [];
  },
};


