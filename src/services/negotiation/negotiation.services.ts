import toastHelper from '../../utils/toastHelper';
import api from '../api/api';

export interface Negotiation {
  _id?: string;
  productId: string | {
    _id: string;
    name: string;
    price: number;
    mainImage: string;
    skuFamilyId?: {
      _id: string;
      name: string;
    };
  };
  bidId: string;
  fromUserId: string | {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  FromUserType: 'Admin' | 'Customer';
  toUserId?: string | {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  toUserType?: 'Admin' | 'Customer';
  offerPrice: number;
  previousOfferPrice?: number | null;
  currency?: string;
  quantity?: number;
  previousQuantity?: number | null;
  isPlacedOrder?: boolean;
  message?: string;
  status: 'negotiation' | 'accepted' | 'rejected';
  isRead: boolean;
  confirmationToken?: string | null;
  confirmationExpiry?: string | Date | null;
  isConfirmedByCustomer?: boolean;
  confirmedAt?: string | Date | null;
  orderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NegotiationListResponse {
  negotiations: Negotiation[];
  totalPages: number;
  currentPage: number;
  total: number;
  message: string;
  success: boolean;
}

export interface NegotiationStats {
  totalNegotiations: number;
  activeNegotiations: number;
  acceptedNegotiations: number;
  customerBids: number;
  adminBids: number;
}

export interface NegotiationStatsResponse {
  data: NegotiationStats;
  message: string;
  success: boolean;
}

export interface RespondToNegotiationRequest {
  negotiationId: string;
  action: 'accept' | 'counter' | 'reject';
  offerPrice?: number;
  message?: string;
}

export class NegotiationService {
  // Get all negotiations for admin
  static async getAllNegotiations(page = 1, limit = 10, status?: string, customerId?: string, productId?: string): Promise<NegotiationListResponse> {
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
      const url = `${baseUrl}/api/${adminRoute}/negotiation/list`;

      const body: any = { page, limit };
      if (status) body.status = status;
      if (customerId) body.customerId = customerId;
      if (productId) body.productId = productId;

      const res = await api.post(url, body);
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch negotiations');
      }
      return res.data.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch negotiations';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // Respond to customer's negotiation
  static async respondToNegotiation(responseData: RespondToNegotiationRequest): Promise<any> {
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
      const url = `${baseUrl}/api/${adminRoute}/negotiation/respond`;

      console.log('Sending negotiation response:', responseData);
      const res = await api.post(url, responseData);
      console.log('Negotiation response received:', res.data);
      
      // Backend returns { status: 200, message: ..., data: ... }
      if (res.status === 200 && res.data) {
        if (res.data.status === 200) {
          // Success response
          return res.data.data || res.data;
        } else {
          // Backend returned an error status
          const errorMessage = res.data.message || 'Failed to send response';
          throw new Error(errorMessage);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error in respondToNegotiation:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send response';
      throw new Error(errorMessage);
    }
  }

  // Get negotiation details
  static async getNegotiationDetails(negotiationId: string): Promise<any> {
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
      const url = `${baseUrl}/api/${adminRoute}/negotiation/details`;

      const res = await api.post(url, { negotiationId });
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch negotiation details');
      }
      return res.data.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch negotiation details';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // Get accepted negotiations for admin
  static async getAcceptedNegotiations(page = 1, limit = 10, customerId?: string, productId?: string): Promise<NegotiationListResponse> {
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
      const url = `${baseUrl}/api/${adminRoute}/negotiation/accepted`;

      const body: any = { page, limit };
      if (customerId) body.customerId = customerId;
      if (productId) body.productId = productId;

      const res = await api.post(url, body);
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch accepted negotiations');
      }
      return res.data.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch accepted negotiations';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // Get rejected negotiations for admin
  static async getRejectedNegotiations(page = 1, limit = 10): Promise<NegotiationListResponse> {
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
      const url = `${baseUrl}/api/${adminRoute}/negotiation/rejected`;

      const res = await api.post(url, { page, limit });
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch rejected negotiations');
      }
      return res.data.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch rejected negotiations';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // Place order from accepted negotiation
  static async placeOrderFromNegotiation(negotiationId: string): Promise<any> {
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
      const url = `${baseUrl}/api/${adminRoute}/negotiation/place-order`;

      const res = await api.post(url, { negotiationId });
      if (res.status === 200 && res.data.data) {
        toastHelper.showTost(res.data.message || 'Order placed successfully!', 'success');
        return res.data.data;
      } else {
        toastHelper.showTost(res.data.message || 'Failed to place order', 'warning');
        return false;
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to place order';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // Get negotiation statistics
  static async getNegotiationStats(): Promise<NegotiationStatsResponse> {
    try {
      const baseUrl = import.meta.env.VITE_BASE_URL;
      const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
      const url = `${baseUrl}/api/${adminRoute}/negotiation/stats`;

      const res = await api.post(url, {});
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch negotiation statistics');
      }
      return res.data.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch negotiation statistics';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }
}

// Export as default
export default NegotiationService;
