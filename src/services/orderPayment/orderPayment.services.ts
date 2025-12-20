import api from '../api/api';
import toastHelper from '../../utils/toastHelper';

export interface OrderPayment {
  _id?: string;
  orderId?: string | {
    _id: string;
    orderNo: string;
    totalAmount: number;
    currency: string;
    status: string;
  };
  order?: string | {
    _id: string;
    orderNo: string;
    totalAmount: number;
    currency: string;
    status: string;
  };
  customerId?: string | {
    _id: string;
    name: string;
    email: string;
  };
  customer?: string | {
    _id: string;
    name: string;
    email: string;
  };
  paymentMethod?: 'Cash' | 'TT' | 'ThirdParty';
  module?: 'Cash' | 'TT' | 'ThirdParty';
  amount: number;
  currency: string;
  status: 'requested' | 'rejected' | 'verify' | 'approved' | 'paid';
  paymentDetails?: Record<string, any> | string;
  transactionRef?: string;
  otp?: string;
  otpExpiry?: string;
  otpVerified?: boolean;
  otpVerifiedAt?: string;
  verificationDocuments?: string[];
  verifiedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  verifiedAt?: string;
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  approvedAt?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderPaymentListResponse {
  docs: OrderPayment[];
  totalDocs: number;
  totalPages: number;
  page: number;
  limit: number;
}

export class OrderPaymentService {
  /**
   * List all payments with filters
   */
  static async listPayments(
    page = 1,
    limit = 10,
    orderId?: string,
    status?: string,
    paymentMethod?: string,
    customerId?: string
  ): Promise<{ status: number; data: OrderPaymentListResponse; message: string }> {
    try {
      const res = await api.post('/api/admin/order-payment/list', {
        page,
        limit,
        orderId,
        status,
        paymentMethod,
        customerId
      });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to fetch payments';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }

  /**
   * Get payment by ID
   */
  static async getPayment(paymentId: string): Promise<{ status: number; data: OrderPayment; message: string }> {
    try {
      const res = await api.post('/api/admin/order-payment/get', { paymentId });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to fetch payment';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }

  /**
   * Verify payment - Send OTP and upload documents
   */
  static async verifyPayment(
    paymentId: string,
    documents?: File[],
    remarks?: string
  ): Promise<{ status: number; data: OrderPayment; message: string }> {
    try {
      const formData = new FormData();
      formData.append('paymentId', paymentId);
      if (remarks) {
        formData.append('remarks', remarks);
      }
      if (documents && documents.length > 0) {
        for (let i = 0; i < documents.length; i++) {
          formData.append('documents', documents[i]);
        }
      }

      const res = await api.post('/api/admin/order-payment/verify', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const responseData = res.data;
      if (res.status === 200) {
        toastHelper.showTost(responseData.message || 'Payment verified successfully!', 'success');
      } else {
        toastHelper.showTost(responseData.message || 'Failed to verify payment', 'error');
      }

      return responseData;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to verify payment';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }

  /**
   * Approve payment
   */
  static async approvePayment(
    paymentId: string,
    remarks?: string
  ): Promise<{ status: number; data: OrderPayment; message: string }> {
    try {
      const res = await api.post('/api/admin/order-payment/approve', {
        paymentId,
        remarks
      });

      const responseData = res.data;
      if (res.status === 200) {
        toastHelper.showTost(responseData.message || 'Payment approved successfully!', 'success');
      } else {
        toastHelper.showTost(responseData.message || 'Failed to approve payment', 'error');
      }

      return responseData;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to approve payment';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }

  /**
   * Mark payment as paid
   */
  static async markAsPaid(
    paymentId: string,
    remarks?: string
  ): Promise<{ status: number; data: OrderPayment; message: string }> {
    try {
      const res = await api.post('/api/admin/order-payment/mark-paid', {
        paymentId,
        remarks
      });

      const responseData = res.data;
      if (res.status === 200) {
        toastHelper.showTost(responseData.message || 'Payment marked as paid successfully!', 'success');
      } else {
        toastHelper.showTost(responseData.message || 'Failed to mark payment as paid', 'error');
      }

      return responseData;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to mark payment as paid';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }

  /**
   * Send OTP for payment verification
   */
  static async sendOTP(paymentId: string): Promise<{ status: number; data: any; message: string }> {
    try {
      const res = await api.post('/api/admin/order-payment/send-otp', {
        paymentId
      });

      const responseData = res.data;
      if (res.status === 200) {
        toastHelper.showTost(responseData.message || 'OTP sent successfully!', 'success');
      } else {
        toastHelper.showTost(responseData.message || 'Failed to send OTP', 'error');
      }

      return responseData;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send OTP';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }

  /**
   * Verify OTP for payment
   */
  static async verifyOTP(paymentId: string, otp: string): Promise<{ status: number; data: OrderPayment; message: string }> {
    try {
      const res = await api.post('/api/admin/order-payment/verify-otp', {
        paymentId,
        otp
      });

      const responseData = res.data;
      if (res.status === 200) {
        toastHelper.showTost(responseData.message || 'OTP verified successfully!', 'success');
      } else {
        toastHelper.showTost(responseData.message || 'Failed to verify OTP', 'error');
      }

      return responseData;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to verify OTP';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }

  /**
   * Update payment - Edit payment details and status
   */
  static async updatePayment(
    paymentId: string,
    data: {
      status?: 'requested' | 'rejected' | 'verify' | 'approved' | 'paid';
      transactionRef?: string;
      remarks?: string;
      amount?: number;
      currency?: string;
      conversionRate?: number;
      calculatedAmount?: number;
    }
  ): Promise<{ status: number; data: OrderPayment; message: string }> {
    try {
      const res = await api.post('/api/admin/order-payment/update', {
        paymentId,
        ...data
      });

      const responseData = res.data;
      if (res.status === 200) {
        toastHelper.showTost(responseData.message || 'Payment updated successfully!', 'success');
      } else {
        toastHelper.showTost(responseData.message || 'Failed to update payment', 'error');
      }

      return responseData;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update payment';
      toastHelper.showTost(msg, 'error');
      throw err;
    }
  }
}

export default OrderPaymentService;


