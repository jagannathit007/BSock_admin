import api from '../api/api';
import toastHelper from '../../utils/toastHelper';

export interface ProductVersionHistoryQuery {
    productId?: string;
    page: number;
    limit: number;
    changeType?: 'create' | 'update' | 'delete' | string;
    changedByType?: 'admin' | 'system' | string;
    search?: string;
}

export interface ProductVersionGetQuery {
	productId: string;
	version: number;
}

export interface ProductVersionRestoreBody extends ProductVersionGetQuery {
	changeReason: string;
}

export interface ProductsWithCountsQuery {
	page: number;
	limit: number;
	search?: string;
}

export class VersionProductService {
	static fetchHistory = async (body: ProductVersionHistoryQuery): Promise<any> => {
		const baseUrl = import.meta.env.VITE_BASE_URL;
		const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
		const url = `${baseUrl}/api/${adminRoute}/version/product/history`;
		try {
			const res = await api.post(url, body);
			// Check if response is successful
			if (res.data?.status === 200) {
				return res.data;
			} else {
				const message = res.data?.message || 'Failed to fetch product history';
				toastHelper.showTost(message, 'error');
				throw new Error(message);
			}
		} catch (err: any) {
			const message = err.response?.data?.message || err.message || 'Failed to fetch product history';
			toastHelper.showTost(message, 'error');
			throw new Error(message);
		}
	};

	static fetchVersion = async (body: ProductVersionGetQuery): Promise<any> => {
		const baseUrl = import.meta.env.VITE_BASE_URL;
		const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
		const url = `${baseUrl}/api/${adminRoute}/version/product/get`;
		try {
			const res = await api.post(url, body);
			return res.data;
		} catch (err: any) {
			const message = err.response?.data?.message || 'Failed to fetch product version';
			toastHelper.showTost(message, 'error');
			throw new Error(message);
		}
	};

	static restoreVersion = async (body: ProductVersionRestoreBody): Promise<any> => {
		const baseUrl = import.meta.env.VITE_BASE_URL;
		const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
		const url = `${baseUrl}/api/${adminRoute}/version/product/restore`;
		try {
			const res = await api.post(url, body);
			toastHelper.showTost(res.data?.message || 'Restored product version successfully', 'success');
			return res.data;
		} catch (err: any) {
			const message = err.response?.data?.message || 'Failed to restore product version';
			toastHelper.showTost(message, 'error');
			throw new Error(message);
		}
	};

	static fetchProductsWithCounts = async (body: ProductsWithCountsQuery): Promise<any> => {
		const baseUrl = import.meta.env.VITE_BASE_URL;
		const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
		const url = `${baseUrl}/api/${adminRoute}/version/products-with-counts`;
		try {
			const res = await api.post(url, body);
			return res.data;
		} catch (err: any) {
			const message = err.response?.data?.message || 'Failed to fetch products with counts';
			toastHelper.showTost(message, 'error');
			throw new Error(message);
		}
	};
}

export default VersionProductService;


