import toastHelper from '../../utils/toastHelper';
import api from '../api/api';

interface SubSkuFamily {
  _id?: string;
  id?: string;
  code: string;
  name: string;
  brand: string;
  description: string;
  images: string[];
  colorVariant: string[];
  country: string;
  simType: string[];
  networkBands: string[];
  skuFamilyId: string;
  countryVariant?: string;
  sequence?: number;
  isApproved?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  approvedBy?: string | null;
  __v?: string;
}

interface ListResponse {
  data: {
    docs: SubSkuFamily[];
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

export class SubSkuFamilyService {
  static createSubSkuFamily = async (data: FormData): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/subSkuFamily/create`;

    try {
      const res = await api.post(url, data);
      toastHelper.showTost(res.data.message || 'Sub SKU Family created successfully!', 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create Sub SKU Family';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static updateSubSkuFamily = async (id: string, data: FormData): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/subSkuFamily/update`;

    try {
      // Ensure id is only appended once
      if (!data.has('id')) {
        data.append('id', id);
      }
      
      // Log the data being sent for debugging
      console.log('Sending update data:', {
        id: data.get('id'),
        skuFamilyId: data.get('skuFamilyId'),
        simType: data.get('simType'),
        colorVariant: data.get('colorVariant'),
        networkBands: data.get('networkBands')
      });
      
      // Log the raw FormData entries
      console.log('FormData entries:');
      for (const [key, value] of data.entries()) {
        console.log(`${key}:`, value);
      }
      
      const res = await api.post(url, data);
      toastHelper.showTost(res.data.message || 'Sub SKU Family updated successfully!', 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update Sub SKU Family';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static deleteSubSkuFamily = async (id: string): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/subSkuFamily/delete`;

    try {
      const res = await api.post(url, { id });
      toastHelper.showTost(res.data.message || 'Sub SKU Family deleted successfully!', 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to delete Sub SKU Family';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static getSubSkuFamilyList = async (page: number, limit: number, skuFamilyId?: string, search?: string): Promise<ListResponse> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    // Use the SKU Family endpoint for embedded sub SKU families
    const url = `${baseUrl}/api/${adminRoute}/skuFamily/list-sub-sku-families`;

    const body: any = { page, limit };
    if (skuFamilyId) {
      body.skuFamilyId = skuFamilyId;
    }
    if (search) {
      body.search = search;
    }

    try {
      const res = await api.post(url, body);
      console.log("API response for getSubSkuFamilyList:", res.data); // Debug log
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch Sub SKU Families';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static updateSequence = async (id: string, sequence: number): Promise<any> => {
    const baseUrl = import.meta.env.VITE_BASE_URL;
    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
    const url = `${baseUrl}/api/${adminRoute}/subSkuFamily/update-sequence`;

    try {
      const res = await api.post(url, { id, sequence });
      toastHelper.showTost(res.data.message || 'Sequence updated successfully!', 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update sequence';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };
}
