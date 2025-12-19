import React, { useState, useEffect } from 'react';
import { SellerProductPermissionService, SellerProductFieldPermission } from '../../services/sellerProductPermission/sellerProductPermission.services';
import toastHelper from '../../utils/toastHelper';

interface SellerProductPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerId?: string;
  onUpdate?: () => void;
}

const SellerProductPermissionModal: React.FC<SellerProductPermissionModalProps> = ({
  isOpen,
  onClose,
  sellerId,
  onUpdate,
}) => {
  const [permissions, setPermissions] = useState<SellerProductFieldPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedSeller, _setSelectedSeller] = useState<string>(sellerId || '');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const [_sellers, setSellers] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isGlobal, _setIsGlobal] = useState(!sellerId);

  // Group fields by category
  const supplierInfoFields = permissions.filter(p => p.group === 'supplierInfo');
  const productDetailFields = permissions.filter(p => p.group === 'productDetail');
  const pricingFields = permissions.filter(p => p.group === 'pricing');
  const otherInfoFields = permissions.filter(p => p.group === 'otherInfo');

  useEffect(() => {
    if (isOpen) {
      loadPermissions();
    }
  }, [isOpen, selectedSeller]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const availableFields = SellerProductPermissionService.getAvailableFields();
      
      try {
        const savedPermissions = await SellerProductPermissionService.getSellerProductPermissions(
          selectedSeller || undefined
        );
        
        // Merge saved permissions with available fields
        const mergedPermissions = availableFields.map(field => {
          const saved = savedPermissions.permissions?.find(p => p.fieldName === field.fieldName);
          return saved || field;
        });
        setPermissions(mergedPermissions);
      } catch (error: any) {
        // If no permissions found, use default available fields
        if (error.message.includes('404') || error.message.includes('not found')) {
          setPermissions(availableFields);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error loading permissions:', error);
      toastHelper.showTost(error.message || 'Failed to load permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (fieldName: string) => {
    setPermissions(prev =>
      prev.map(p =>
        p.fieldName === fieldName
          ? { ...p, hasPermission: !p.hasPermission }
          : p
      )
    );
  };

  const handleSelectAll = (group: 'supplierInfo' | 'productDetail' | 'pricing' | 'otherInfo' | 'all') => {
    setPermissions(prev =>
      prev.map(p => {
        if (group === 'all' || p.group === group) {
          return { ...p, hasPermission: true };
        }
        return p;
      })
    );
  };

  const handleDeselectAll = (group: 'supplierInfo' | 'productDetail' | 'pricing' | 'otherInfo' | 'all') => {
    setPermissions(prev =>
      prev.map(p => {
        if (group === 'all' || p.group === group) {
          // Don't deselect required fields
          if (p.isRequired) {
            return p;
          }
          return { ...p, hasPermission: false };
        }
        return p;
      })
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate that required fields have permission
      // const requiredFieldsWithoutPermission = permissions.filter(
      //   p => p.isRequired && !p.hasPermission  
      // );
      
      // if (requiredFieldsWithoutPermission.length > 0) {
      //   toastHelper.showTost(
      //     `Required fields must have permission: ${requiredFieldsWithoutPermission.map(f => f.label).join(', ')}`,
      //     'error'
      //   );
      //   return;
      // }

      await SellerProductPermissionService.updateSellerProductPermissions(
        permissions,
        selectedSeller || undefined
      );
      
      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving permissions:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Seller Product Permissions</h2>
            <p className="text-blue-100 text-sm mt-1">
              {isGlobal ? 'Global Permissions (applies to all sellers)' : `Permissions for selected seller`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Seller Selection */}
          {/* <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Seller (leave empty for global permissions)
            </label>
            <select
              value={selectedSeller}
              onChange={(e) => {
                setSelectedSeller(e.target.value);
                setIsGlobal(!e.target.value);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={!!sellerId}
            >
              <option value="">Global (All Sellers)</option>
              {sellers.map(seller => (
                <option key={seller._id} value={seller._id}>
                  {seller.name} {seller.code ? `(${seller.code})` : ''}
                </option>
              ))}
            </select>
          </div> */}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Supplier Info Group */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Supplier Info Group
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectAll('supplierInfo')}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleDeselectAll('supplierInfo')}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {supplierInfoFields.map(field => (
                    <label
                      key={field.fieldName}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        field.hasPermission
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      } ${field.isRequired ? 'border-l-4 border-l-orange-500' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={field.hasPermission}
                        onChange={() => handlePermissionToggle(field.fieldName)}
                        // disabled={field.isRequired}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {field.label}
                        {field.isRequired && (
                          <span className="text-orange-500 ml-1">*</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Product Detail Group */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Product Detail Group
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectAll('productDetail')}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleDeselectAll('productDetail')}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {productDetailFields.map(field => (
                    <label
                      key={field.fieldName}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        field.hasPermission
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      } ${field.isRequired ? 'border-l-4 border-l-orange-500' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={field.hasPermission}
                        onChange={() => handlePermissionToggle(field.fieldName)}
                        // disabled={field.isRequired}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {field.label}
                        {field.isRequired && (
                          <span className="text-orange-500 ml-1">*</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pricing Group */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Pricing / Delivery / Payment Method Group
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectAll('pricing')}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleDeselectAll('pricing')}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {pricingFields.map(field => (
                    <label
                      key={field.fieldName}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        field.hasPermission
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      } ${field.isRequired ? 'border-l-4 border-l-orange-500' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={field.hasPermission}
                        onChange={() => handlePermissionToggle(field.fieldName)}
                        // disabled={field.isRequired}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {field.label}
                        {field.isRequired && (
                          <span className="text-orange-500 ml-1">*</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Other Information Group */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Other Information Group
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectAll('otherInfo')}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleDeselectAll('otherInfo')}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {otherInfoFields.map(field => (
                    <label
                      key={field.fieldName}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        field.hasPermission
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={field.hasPermission}
                        onChange={() => handlePermissionToggle(field.fieldName)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {field.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellerProductPermissionModal;
