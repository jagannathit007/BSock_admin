/**
 * LocalStorage constants for BSock Admin
 * Using admin-specific prefixes to avoid conflicts with other projects on the same domain
 */
export const LOCAL_STORAGE_KEYS = {
  // Authentication
  TOKEN: 'bsock_admin_token',
  USER: 'bsock_admin_user',
  USER_ID: 'bsock_admin_userId',
  ADMIN_ID: 'bsock_admin_adminId',
  
  // Theme
  THEME: 'bsock_admin_theme',
  VARIENTPRODUCT:'variant-product-form-data',
  // Business Requests
  BR_STATUS_OVERRIDES: 'bsock_admin_br_status_overrides',
} as const;

/**
 * Helper functions for localStorage operations with admin-specific keys
 */
export const localStorageHelpers = {
  getItem: (key: keyof typeof LOCAL_STORAGE_KEYS) => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS[key]);
  },
  
  setItem: (key: keyof typeof LOCAL_STORAGE_KEYS, value: string) => {
    localStorage.setItem(LOCAL_STORAGE_KEYS[key], value);
  },
  
  removeItem: (key: keyof typeof LOCAL_STORAGE_KEYS) => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS[key]);
  },
  
  // Helper to clear all admin-related localStorage
  clearAll: () => {
    Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
};
