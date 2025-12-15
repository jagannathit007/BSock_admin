import React, { useState } from 'react';
import VariantSelectionModal from './VariantSelectionModal';
import CascadingVariantSelector, { VariantOption } from './CascadingVariantSelector';
import ExcelLikeProductForm, { ProductRowData } from './ExcelLikeProductForm';
import { ProductService } from '../../services/product/product.services';
import toastHelper from '../../utils/toastHelper';

interface ProductListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalStep = 'variant-selection' | 'variant-config' | 'form';

const ProductListingModal: React.FC<ProductListingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<ModalStep>('variant-selection');
  const [variantType, setVariantType] = useState<'single' | 'multi' | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(false);

  const handleVariantSelection = (type: 'single' | 'multi') => {
    setVariantType(type);
    if (type === 'single') {
      setStep('form');
    } else {
      setStep('variant-config');
    }
  };

  const handleVariantsSelected = (variants: VariantOption[]) => {
    setSelectedVariants(variants);
    if (variants.length > 0) {
      setStep('form');
    }
  };

  // Helper function to validate ObjectId
  const isValidObjectId = (id: string | null | undefined): boolean => {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  const handleFormSave = async (rows: ProductRowData[]) => {
    try {
      setLoading(true);
      
      // Validate all required IDs before processing
      const validationErrors: string[] = [];
      rows.forEach((row, index) => {
        if (!row.skuFamilyId || !isValidObjectId(row.skuFamilyId)) {
          validationErrors.push(`Row ${index + 1}: Invalid or missing SKU Family ID`);
        }
        if (row.grade && !isValidObjectId(row.grade)) {
          validationErrors.push(`Row ${index + 1}: Invalid Grade ID`);
        }
        if (row.supplierId && !isValidObjectId(row.supplierId)) {
          validationErrors.push(`Row ${index + 1}: Invalid Supplier ID`);
        }
      });

      if (validationErrors.length > 0) {
        toastHelper.showTost(
          `Validation errors:\n${validationErrors.join('\n')}`,
          'error'
        );
        setLoading(false);
        return;
      }
      
      // Transform rows to backend format and create products
      const productsToCreate = rows.map(row => {
        // Build countryDeliverables array
        const countryDeliverables: any[] = [];
        
        // For Hongkong: Create USD entry
        if (row.hkUsd) {
          countryDeliverables.push({
            country: 'Hongkong',
            currency: 'USD',
            basePrice: parseFloat(String(row.hkUsd)) || 0,
            exchangeRate: parseFloat(String(row.hkXe)) || null,
            // Legacy fields
            usd: parseFloat(String(row.hkUsd)) || 0,
            xe: parseFloat(String(row.hkXe)) || 0,
            local: parseFloat(String(row.hkHkd)) || 0,
            hkd: parseFloat(String(row.hkHkd)) || 0,
          });
        }
        
        // For Dubai: Create USD entry
        if (row.dubaiUsd) {
          countryDeliverables.push({
            country: 'Dubai',
            currency: 'USD',
            basePrice: parseFloat(String(row.dubaiUsd)) || 0,
            exchangeRate: parseFloat(String(row.dubaiXe)) || null,
            // Legacy fields
            usd: parseFloat(String(row.dubaiUsd)) || 0,
            xe: parseFloat(String(row.dubaiXe)) || 0,
            local: parseFloat(String(row.dubaiAed)) || 0,
            aed: parseFloat(String(row.dubaiAed)) || 0,
          });
        }

        // Helper to convert empty strings to null
        const cleanString = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          return val;
        };

        return {
          skuFamilyId: row.skuFamilyId, // Already validated above - required field
          gradeId: (row.grade && isValidObjectId(row.grade)) ? row.grade : null,
          sellerId: (row.supplierId && isValidObjectId(row.supplierId)) ? row.supplierId : null,
          specification: cleanString(row.version) || '',
          simType: row.sim || '',
          color: row.colour || '',
          ram: cleanString(row.ram) || '',
          storage: row.storage || '',
          weight: row.weight ? parseFloat(String(row.weight)) : null,
          condition: cleanString(row.condition) || null,
          stock: parseFloat(String(row.totalQty)) || 0,
          country: (cleanString(row.country) || null) as string | null,
          moq: parseFloat(String(row.moqPerVariant)) || 1,
          purchaseType: 'full',
          isNegotiable: row.negotiableFixed === '1',
          // Check if tags contains HOT DEAL (code 1)
          isFlashDeal: row.tags && row.tags.split(',').map(t => parseInt(t.trim())).includes(1) ? 'true' : 'false',
          startTime: cleanString(row.startTime) ? new Date(row.startTime).toISOString() : '',
          expiryTime: cleanString(row.endTime) ? new Date(row.endTime).toISOString() : '',
          groupCode: variantType === 'multi' ? `GROUP-${Date.now()}` : undefined,
          sequence: row.sequence || null,
          countryDeliverables,
          // Additional fields that need to be stored - convert empty strings to null
          supplierListingNumber: cleanString(row.supplierListingNumber) || '',
          packing: cleanString(row.packing) || '',
          currentLocation: cleanString(row.currentLocation) || '',
          deliveryLocation: Array.isArray(row.deliveryLocation) 
            ? row.deliveryLocation 
            : (row.deliveryLocation && typeof row.deliveryLocation === 'string' 
                ? (() => {
                    try {
                      const parsed = JSON.parse(row.deliveryLocation);
                      return Array.isArray(parsed) ? parsed : [row.deliveryLocation];
                    } catch {
                      return [row.deliveryLocation];
                    }
                  })()
                : []),
          customMessage: cleanString(row.customMessage) || '',
          paymentTerm: Array.isArray(row.paymentTerm) ? row.paymentTerm : (row.paymentTerm ? [row.paymentTerm] : null),
          paymentMethod: Array.isArray(row.paymentMethod) ? row.paymentMethod : (row.paymentMethod ? [row.paymentMethod] : null),
          shippingTime: cleanString(row.shippingTime) || '',
          vendor: cleanString(row.vendor) || null,
          vendorListingNo: cleanString(row.vendorListingNo) || '',
          carrier: cleanString(row.carrier) || null,
          carrierListingNo: cleanString(row.carrierListingNo) || '',
          uniqueListingNo: cleanString(row.uniqueListingNo) || '',
          tags: cleanString(row.tags) || '',
          adminCustomMessage: cleanString(row.adminCustomMessage) || '',
          remark: cleanString(row.remark) || '',
          warranty: cleanString(row.warranty) || '',
          batteryHealth: cleanString(row.batteryHealth) || '',
          lockUnlock: row.lockUnlock === '1',
        };
      });

      // Create all products
      const createPromises = productsToCreate.map(product => 
        ProductService.createProduct(product)
      );

      await Promise.all(createPromises);
      
      toastHelper.showTost('Products created successfully!', 'success');
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating products:', error);
      toastHelper.showTost(error.message || 'Failed to create products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('variant-selection');
    setVariantType(null);
    setSelectedVariants([]);
    onClose();
  };

  const handleBack = () => {
    if (step === 'form') {
      if (variantType === 'multi') {
        setStep('variant-config');
      } else {
        setStep('variant-selection');
      }
    } else if (step === 'variant-config') {
      setStep('variant-selection');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Variant Selection Modal */}
      {step === 'variant-selection' && (
        <VariantSelectionModal
          isOpen={isOpen}
          onClose={handleClose}
          onSelectVariant={handleVariantSelection}
        />
      )}

      {/* Multi-Variant Configuration */}
      {step === 'variant-config' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-purple-600 dark:bg-purple-800 p-6 pb-4 border-b-2 border-purple-500 dark:border-purple-700 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 dark:bg-white/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-layer-group text-white text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Multi-Variant Configuration
                    </h2>
                    <p className="text-purple-100 text-sm mt-1">
                      Select models, storage, and colors to generate product variants
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <CascadingVariantSelector onVariantsSelected={handleVariantsSelected} />
              {selectedVariants.length > 0 && (
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-5 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-sm font-medium transition-all duration-200"
                  >
                    <i className="fas fa-arrow-left mr-2"></i>
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-semibold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                  >
                    <i className="fas fa-arrow-right"></i>
                    Continue to Form
                    <span className="ml-1 px-2.5 py-0.5 bg-white/30 rounded-full text-sm font-bold">
                      {selectedVariants.length}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Form */}
      {step === 'form' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col">
            <div className="sticky top-0 bg-blue-600 dark:bg-blue-800 p-5 border-b-2 border-blue-500 dark:border-blue-700 z-20 flex-shrink-0 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 dark:bg-white/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-table text-white text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {variantType === 'multi' ? 'Multi-Variant Product Form' : 'Single Variant Product Form'}
                    </h2>
                    <p className="text-blue-100 text-sm mt-1 flex items-center gap-2">
                      <i className="fas fa-info-circle text-xs"></i>
                      Excel-like interface • Scroll horizontally to see all columns
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
                  title="Close (Esc)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <ExcelLikeProductForm
                  variantType={variantType!}
                  variants={selectedVariants}
                  onSave={handleFormSave}
                  onCancel={handleClose}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductListingModal;

