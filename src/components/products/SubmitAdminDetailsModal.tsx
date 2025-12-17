import React, { useState } from 'react';
import { ProductService, Product } from '../../services/product/product.services';
import MarginSelectionModal, { MarginSelection } from './MarginSelectionModal';
import CostModuleSelectionModal, { SelectedCost } from './CostModuleSelectionModal';
import toastHelper from '../../utils/toastHelper';

interface SubmitAdminDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onSuccess: () => void;
}

const SubmitAdminDetailsModal: React.FC<SubmitAdminDetailsModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const [selectedMargins, setSelectedMargins] = useState<MarginSelection>({
    sellerCategory: false,
    brand: false,
    productCategory: false,
    conditionCategory: false,
    customerCategory: false,
  });
  const [selectedCostsHK, setSelectedCostsHK] = useState<SelectedCost[]>([]);
  const [selectedCostsDubai, setSelectedCostsDubai] = useState<SelectedCost[]>([]);
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [currentCostCountry, setCurrentCostCountry] = useState<'Hongkong' | 'Dubai' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const [_costsByCountry, setCostsByCountry] = useState<{ Hongkong?: any[]; Dubai?: any[] }>({});


  const handleMarginSelection = (selection: MarginSelection) => {
    setSelectedMargins(selection);
    setShowMarginModal(false);
  };

  const handleCostSelection = (country: 'Hongkong' | 'Dubai', costs: SelectedCost[]) => {
    // Convert SelectedCost[] to the format we need
    const formattedCosts = costs.map(cost => ({
      costId: cost.costId,
      name: cost.name,
      costType: cost.costType,
      costField: cost.costField,
      costUnit: cost.costUnit,
      value: cost.value,
      groupId: cost.groupId,
      isExpressDelivery: cost.isExpressDelivery,
      isSameLocationCharge: cost.isSameLocationCharge,
    }));

    if (country === 'Hongkong') {
      setSelectedCostsHK(formattedCosts);
    } else {
      setSelectedCostsDubai(formattedCosts);
    }
    setShowCostModal(false);
    setCurrentCostCountry(null);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Prepare selected costs as array of IDs
      const selectedCosts: { Hongkong?: string[]; Dubai?: string[] } = {};
      if (selectedCostsHK.length > 0) {
        selectedCosts.Hongkong = selectedCostsHK.map(c => c.costId);
      }
      if (selectedCostsDubai.length > 0) {
        selectedCosts.Dubai = selectedCostsDubai.map(c => c.costId);
      }

      await ProductService.submitAdminDetails(
        product._id!,
        selectedMargins,
        selectedCosts
      );

      toastHelper.showTost('Admin details submitted successfully! Product is now ready for verification.', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting admin details:', error);
      toastHelper.showTost(error.message || 'Failed to submit admin details', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getProductPreview = () => {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">SKU Family:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {typeof product.skuFamilyId === 'object' ? product.skuFamilyId.name : product.skuFamilyId}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Specification:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{product.specification || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Color:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{product.color || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Storage:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{product.storage || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">RAM:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{product.ram || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Stock:</span>
            <span className="ml-2 text-gray-900 dark:text-white">{product.stock || 0}</span>
          </div>
        </div>
        {product.countryDeliverables && product.countryDeliverables.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-700 dark:text-gray-300">Base Prices:</span>
            <div className="mt-2 space-y-1">
              {product.countryDeliverables.map((cd: any, idx: number) => (
                <div key={idx} className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{cd.country}:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {cd.currency} {cd.basePrice || cd.usd || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 dark:bg-blue-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-white">Add Product Details</h2>
              <p className="text-blue-100 text-sm mt-1">
                Select margins and cost modules before approval
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Product Preview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Product Preview
              </h3>
              {getProductPreview()}
            </div>

            {/* Select Margins */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Select Margins to Apply
                </h3>
                <button
                  onClick={() => setShowMarginModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Select Margins
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                {Object.entries(selectedMargins).some(([_, selected]) => selected) ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedMargins)
                      .filter(([_, selected]) => selected)
                      .map(([key, _]) => (
                        <span
                          key={key}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
                        >
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No margins selected</p>
                )}
              </div>
            </div>

            {/* Select Cost Modules for Hongkong */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Select Cost Modules for Hongkong
                </h3>
                <button
                  onClick={() => {
                    setCurrentCostCountry('Hongkong');
                    setShowCostModal(true);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Select Costs
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                {selectedCostsHK.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCostsHK.map((cost, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                      >
                        <span className="text-sm text-gray-900 dark:text-white">{cost.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {cost.costType} - {cost.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No cost modules selected</p>
                )}
              </div>
            </div>

            {/* Select Cost Modules for Dubai */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Select Cost Modules for Dubai
                </h3>
                <button
                  onClick={() => {
                    setCurrentCostCountry('Dubai');
                    setShowCostModal(true);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Select Costs
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                {selectedCostsDubai.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCostsDubai.map((cost, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                      >
                        <span className="text-sm text-gray-900 dark:text-white">{cost.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {cost.costType} - {cost.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No cost modules selected</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Margin Selection Modal */}
      {showMarginModal && (
        <MarginSelectionModal
          isOpen={showMarginModal}
          onClose={() => setShowMarginModal(false)}
          onNext={handleMarginSelection}
          products={[product]}
        />
      )}

      {/* Cost Selection Modal */}
      {showCostModal && currentCostCountry && (
        <CostModuleSelectionModal
          isOpen={showCostModal}
          onClose={() => {
            setShowCostModal(false);
            setCurrentCostCountry(null);
          }}
          onNext={(costs) => handleCostSelection(currentCostCountry, costs)}
          products={[product]}
          country={currentCostCountry}
        />
      )}
    </>
  );
};

export default SubmitAdminDetailsModal;
