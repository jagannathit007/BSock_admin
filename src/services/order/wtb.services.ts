import api from '../api/api';

export interface WtbAdminRow {
  id: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  status: string;
  createdAt: string;
  note?: string;
  // SKU Family details
  skuFamilyCode?: string;
  skuFamilyName?: string;
  brand?: string;
  productCategory?: string;
  conditionCategory?: string;
}

export interface WtbListResponse {
  docs: WtbAdminRow[];
  totalDocs: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const WtbAdminService = {
  list: async (page = 1, limit = 20, search?: string): Promise<WtbListResponse> => {
    const res = await api.post('/api/admin/wtb/list', {
      page,
      limit,
      search: search || undefined,
    });
    return res.data.data as WtbListResponse;
  },
};

