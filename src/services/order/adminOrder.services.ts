// adminOrder.services.ts
import toastHelper from '../../utils/toastHelper';
import api from '../api/api';

export interface OrderItem {
  productId: { _id: string; name: string; price: number; moq?: number; stock?: number };
  skuFamilyId: { _id: string; name: string };
  quantity: number;
  price: number;
}

export interface Address {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface PaymentDetails {
  module?: string;
  currency?: string;
  acceptedTerms?: boolean;
  fields?: Record<string, any>; // Dynamic fields map
  uploadedFiles?: string[]; // File paths
  transactionRef?: string;
  status?: string;
  remarks?: string;
}

export interface Order {
  _id: string;
  customerId: { _id: string; name?: string; email?: string };
  cartItems: OrderItem[];
  billingAddress?: Address;
  shippingAddress?: Address;
  currentLocation?: string;
  deliveryLocation?: string;
  currency?: string;
  otherCharges?: number | null;
  discount?: number | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  verifiedBy?: { _id: string; name?: string; email?: string } | string | null;
  approvedBy?: { _id: string; name?: string; email?: string } | string | null;
  canVerify?: boolean;
  canApprove?: boolean;
  tracking?: TrackingItem[];
  orderTrackingStatus?: string;
  paymentDetails?: PaymentDetails;
  appliedCharges?: any[];
  adminSelectedPaymentMethod?: string;
  orderTrackingIds?: string[];
  modificationConfirmationToken?: string | null;
  modificationConfirmationExpiry?: string | Date | null;
  isConfirmedByCustomer?: boolean;
  modificationConfirmedAt?: string | Date | null;
  quantitiesModified?: boolean;
  receiverDetails?: {
    name?: string | null;
    mobile?: string | null;
  };
  deliveryOTP?: string | null;
  deliveryOTPExpiry?: string | Date | null;
  deliveryOTPVerified?: boolean;
  deliveryOTPVerifiedAt?: string | Date | null;
  paymentIds?: string[]; // Array of payment IDs
  paymentDetails?: string | string[]; // Can be single ObjectId or array of ObjectIds
}

export interface TrackingItem {
  status: string;
  changedBy?: any;
  userType: string;
  changedAt: string;
  message?: string;
  images?: string[];
}

export interface ListResponse {
  data: {
    docs: Order[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page: number;
    pagingCounter: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
  };
  status: number;
  message: string;
}

export interface TrackingResponse {
  data: {
    docs: TrackingItem[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page: number;
    pagingCounter: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
  };
  status: number;
  message: string;
}

export class AdminOrderService {
  static getOrderList = async (
    page: number,
    limit: number,
    search?: string,
    status?: string
  ): Promise<ListResponse> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/list`;

    const body: any = { page, limit };
    if (search) body.search = search;
    if (status) body.status = status;

    try {
      const res = await api.post(url, body);
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch orders';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static updateOrderStatus = async (
    orderId: string,
    status: string,
    cartItems?: OrderItem[],
    message?: string,
    paymentMethod?: string,
    otherCharges?: number | null,
    images?: File[],
    discount?: number | null
  ): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/update-status`;

    let res;
    
    // Always use FormData to support images (even if no images, it's more flexible)
    const formData = new FormData();
    formData.append('orderId', orderId);
    formData.append('status', status);
    
    if (cartItems && cartItems.length > 0) {
      formData.append('cartItems', JSON.stringify(cartItems.map(item => ({
        productId: item.productId._id,
        skuFamilyId: item.skuFamilyId._id,
        quantity: item.quantity,
        price: item.price,
      }))));
    }
    if (message) {
      formData.append('message', message);
    }
    if (paymentMethod) {
      formData.append('paymentMethod', paymentMethod);
    }
    if (otherCharges !== undefined && otherCharges !== null) {
      formData.append('otherCharges', otherCharges.toString());
    }
    if (discount !== undefined && discount !== null) {
      formData.append('discount', discount.toString());
    }
    
    // Add images if provided
    if (images && images.length > 0) {
      images.forEach((file) => {
        formData.append('images', file);
      });
    }

    try {
      res = await api.post(url, formData);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update order status';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }

      // Check if backend requires payment method selection
      if (res.status === 200 && res.data && res.data.data && res.data.data.requiresPaymentMethodSelection) {
        // Don't show success toast - this is not a successful update, just a request for payment method
        // Return the data so component can handle it
        return res.data;
      }
      
      if (res.status === 200 && res.data.data) {
        toastHelper.showTost(res.data.message || `Order status updated to ${status}!`, 'success');
        return res.data;
      } else {
        toastHelper.showTost(res.data.message || 'Failed to update order status', 'warning');
        return false;
      }
  };

  static getOrderStages = async (
    currentLocation: string,
    deliveryLocation: string,
    currency: string
  ): Promise<string[]> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/get-stages`;

    try {
      const res = await api.post(url, { currentLocation, deliveryLocation, currency });
      if (res.data?.data?.stages) {
        return res.data.data.stages;
      }
      // Fallback to default stages
      return ['requested', 'rejected', 'verify', 'approved', 'confirm', 'waiting_for_payment', 'payment_received', 'packing', 'ready_to_ship', 'on_the_way', 'ready_to_pick', 'delivered', 'cancelled'];
    } catch (err: any) {
      console.error('Failed to fetch order stages:', err);
      // Return default stages on error
      return ['requested', 'rejected', 'verify', 'approved', 'confirm', 'waiting_for_payment', 'payment_received', 'packing', 'ready_to_ship', 'on_the_way', 'ready_to_pick', 'delivered', 'cancelled'];
    }
  };

  static getOrderTracking = async (orderId: string, page: number = 1, limit: number = 10): Promise<TrackingResponse> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/tracking/list`;

    try {
      const res = await api.post(url, { orderId, page, limit });
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch order tracking';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static exportOrdersExcel = async (status?: string): Promise<Blob> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/export`;
    try {
      const body: any = {};
      if (status) body.status = status;
      const res = await api.post(url, body, { responseType: 'blob' });
      return res.data as Blob;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to export orders';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static resendModificationConfirmation = async (orderId: string): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/resend-modification-confirmation`;

    try {
      const res = await api.post(url, { orderId });
      if (res.status === 200 && res.data.data) {
        // Don't show toast here - let the component handle it
        return res.data;
      } else {
        toastHelper.showTost(res.data.message || 'Failed to send confirmation email', 'warning');
        return false;
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to send confirmation email';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static sendDeliveryOTP = async (orderId: string): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/send-delivery-otp`;

    try {
      const res = await api.post(url, { orderId });
      if (res.status === 200 && res.data.data) {
        toastHelper.showTost(res.data.message || 'OTP sent successfully!', 'success');
        return res.data;
      } else {
        toastHelper.showTost(res.data.message || 'Failed to send OTP', 'warning');
        return false;
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to send OTP';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static verifyDeliveryOTP = async (orderId: string, otp: string): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/verify-delivery-otp`;

    try {
      const res = await api.post(url, { orderId, otp });
      if (res.status === 200 && res.data.data) {
        toastHelper.showTost(res.data.message || 'OTP verified successfully!', 'success');
        return res.data;
      } else {
        toastHelper.showTost(res.data.message || 'Failed to verify OTP', 'warning');
        return false;
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to verify OTP';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static downloadInvoice = async (orderId: string): Promise<void> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/order/download-invoice`;

    try {
      const res = await api.post(url, { orderId }, { responseType: 'blob' });
      
      // Create blob from response data
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Invoice_${orderId}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toastHelper.showTost('Invoice downloaded successfully!', 'success');
    } catch (err: any) {
      // Handle error - check if it's a blob error response
      let errorMessage = 'Failed to download invoice';
      if (err.response?.data instanceof Blob) {
        try {
          const errorText = await err.response.data.text();
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = 'Failed to download invoice';
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };
}

export default AdminOrderService;