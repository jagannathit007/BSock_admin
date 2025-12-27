import api from '../api/api';
import toastHelper from '../../utils/toastHelper';

export class BusinessRequestsService {
  static getBusinessRequests = async (
    page: number,
    limit: number,
    search?: string,
    requestType?: 'customer' | 'seller'
  ): Promise<{ docs: any[]; totalDocs: number }> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/customer/list`;

    try {
      const body: any = { page, limit };
      if (search) body.search = search;
      // Always send requestType, default to 'customer' if not provided
      body.requestType = requestType || 'customer';
      const res = await api.post(url, body);
      const docs = res.data?.data?.docs || res.data?.data || [];
      const totalDocsRaw = res.data?.data?.totalDocs ?? docs.length ?? 0;
      const totalDocs = typeof totalDocsRaw === 'string' ? parseInt(totalDocsRaw, 10) : totalDocsRaw;
      return { docs, totalDocs };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch business requests';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static verifyCustomer = async (
    customerId: string
  ): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/customer/verify`;

    try {
      const res = await api.post(url, { customerId });
      const message = res.data?.message || 'Customer business request verified successfully';
      toastHelper.showTost(message, 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to verify customer business request';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static verifySeller = async (
    sellerId: string
  ): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/seller/verify`;

    try {
      const res = await api.post(url, { customerId: sellerId }); // Backend accepts customerId (from validator) or sellerId
      const message = res.data?.message || 'Seller business request verified successfully';
      toastHelper.showTost(message, 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to verify seller business request';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static updateCustomerStatus = async (
    customerId: string,
    status: 'approved' | 'pending' | 'rejected'
  ): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/customer/approve`;

    try {
      const res = await api.post(url, { customerId, status });
      const message = res.data?.message || `Customer ${status} successfully`;
      toastHelper.showTost(message, 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update customer status';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static updateSellerStatus = async (
    sellerId: string,
    status: 'approved' | 'pending' | 'rejected'
  ): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/seller/approve`;

    try {
      const res = await api.post(url, { sellerId, status });
      const message = res.data?.message || `Seller ${status} successfully`;
      toastHelper.showTost(message, 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update seller status';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };
}


