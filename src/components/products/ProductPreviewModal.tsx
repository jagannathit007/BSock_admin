import React, { useState, useMemo } from 'react';
import { ProductCalculationResult } from '../../utils/priceCalculation';

interface ProductPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  calculationResults: ProductCalculationResult[];
  loading?: boolean;
}

const ProductPreviewModal: React.FC<ProductPreviewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  calculationResults,
  loading = false,
}) => {
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  // ✅ FIX #7: MEMOIZE - Build per-currency deliverables function (doesn't change)
  const expandDeliverables = useMemo(() => {
    return (deliverables: any[]) => {
      const expanded: any[] = [];
      deliverables.forEach((cd) => {
        const rate =
          cd.exchangeRate ??
          cd.xe ??
          (cd.hkd && cd.basePrice ? cd.hkd / cd.basePrice : undefined) ??
          (cd.aed && cd.basePrice ? cd.aed / cd.basePrice : undefined) ??
          1;

        // Base currency (as-is from API)
        expanded.push({
          ...cd,
          currency: cd.currency || 'USD',
        });

        // HKD view when available
        if (cd.hkd !== undefined && cd.hkd !== null) {
          const localRate = rate || 1;
          expanded.push({
            ...cd,
            currency: 'HKD',
            basePrice: (cd.basePrice || 0) * localRate,
            calculatedPrice: (cd.calculatedPrice || 0) * localRate,
            margins: (cd.margins || []).map((m: any) => ({
              ...m,
              calculatedAmount: (m.calculatedAmount || 0) * localRate,
            })),
            costs: (cd.costs || []).map((c: any) => ({
              ...c,
              calculatedAmount: (c.calculatedAmount || 0) * localRate,
            })),
          });
        }

        // AED view when available
        if (cd.aed !== undefined && cd.aed !== null) {
          const localRate = rate || 1;
          expanded.push({
            ...cd,
            currency: 'AED',
            basePrice: (cd.basePrice || 0) * localRate,
            calculatedPrice: (cd.calculatedPrice || 0) * localRate,
            margins: (cd.margins || []).map((m: any) => ({
              ...m,
              calculatedAmount: (m.calculatedAmount || 0) * localRate,
            })),
            costs: (cd.costs || []).map((c: any) => ({
              ...c,
              calculatedAmount: (c.calculatedAmount || 0) * localRate,
            })),
          });
        }
      });
      return expanded;
    };
  }, []); // ✅ MEMOIZED: Function doesn't change

  // ✅ FIX #7: MEMOIZE - Calculation results expansion (only recalculates if inputs change)
  const expandedResults = useMemo(() => {
    return calculationResults.map(result => ({
      ...result,
      countryDeliverables: expandDeliverables(result.countryDeliverables),
    }));
  }, [calculationResults, expandDeliverables]); // ✅ ONLY RECALCULATE IF INPUTS CHANGE

  if (!isOpen) return null;

  const toggleProduct = (index: number) => {
    setExpandedProduct(expandedProduct === index ? null : index);
  };

  return (
    <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Product Preview
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Click on any product to view detailed margin and cost breakdown
          </div>

          <div className="space-y-4 mb-6">
            {expandedResults.map((result, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => toggleProduct(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        Product {index + 1}
                      </h3>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <div>SKU: {result.product.skuFamilyId || 'N/A'}</div>
                        <div>Storage: {result.product.storage || 'N/A'}</div>
                        <div>Color: {result.product.colour || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      {result.countryDeliverables.map((deliverable, idx) => {
                        // Calculate preview price (excluding express delivery and same location costs)
                        const previewCosts = deliverable.costs.filter((c: any) => 
                          !c.isExpressDelivery && !c.isSameLocationCharge
                        );
                        const previewPrice = deliverable.basePrice + 
                          deliverable.margins.reduce((sum: number, m: any) => sum + (m.calculatedAmount || 0), 0) +
                          previewCosts.reduce((sum: number, c: any) => sum + (c.calculatedAmount || 0), 0);
                        
                        return (
                          <div key={idx} className="mb-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {deliverable.country} ({deliverable.currency || 'USD'})
                            </div>
                            <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                              ${previewPrice.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Base: ${deliverable.basePrice.toFixed(2)}
                              {deliverable.costs.filter((c: any) => c.isExpressDelivery || c.isSameLocationCharge).length > 0 && (
                                <span className="block text-gray-400">+ delivery costs</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="ml-4">
                      <i
                        className={`fas fa-chevron-${expandedProduct === index ? 'up' : 'down'} text-gray-400`}
                      ></i>
                    </div>
                  </div>
                </div>

                {expandedProduct === index && (
                  <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    {result.countryDeliverables.map((deliverable, idx) => (
                      <div key={idx} className="mb-4 last:mb-0">
                        <h4 className="font-semibold text-gray-800 dark:text-white mb-3">
                          {deliverable.country} Details {deliverable.currency ? `(${deliverable.currency})` : ''}
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="mb-2">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Base Price:
                              </span>
                              <span className="ml-2 text-gray-800 dark:text-white">
                                ${deliverable.basePrice.toFixed(2)}
                              </span>
                            </div>
                              {deliverable.currency && deliverable.currency !== 'USD' && (
                                <div className="mb-2">
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Currency:
                                  </span>
                                  <span className="ml-2 text-gray-800 dark:text-white">
                                    {deliverable.currency}
                                  </span>
                                </div>
                              )}
                              {/* Show explicit local-currency prices if provided by backend */}
                              {deliverable.hkd !== undefined && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  HKD Price: {deliverable.hkd.toFixed ? deliverable.hkd.toFixed(2) : deliverable.hkd}
                                </div>
                              )}
                              {deliverable.aed !== undefined && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  AED Price: {deliverable.aed.toFixed ? deliverable.aed.toFixed(2) : deliverable.aed}
                                </div>
                              )}
                              {deliverable.local !== undefined && deliverable.local !== null && (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  Local Price ({deliverable.currency || 'Local'}): {deliverable.local}
                                </div>
                              )}
                            
                            {deliverable.margins.length > 0 && (
                              <div className="mb-3">
                                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                  Margins:
                                </div>
                                <div className="space-y-1">
                                  {deliverable.margins.map((margin: any, mIdx: number) => (
                                    <div
                                      key={mIdx}
                                      className="text-sm bg-blue-50 dark:bg-blue-900/20 p-2 rounded"
                                    >
                                      <div className="flex justify-between">
                                        <span className="text-gray-700 dark:text-gray-300">
                                          {margin.name} ({margin.marginType === 'percentage' ? `${margin.marginValue}%` : `$${margin.marginValue}`})
                                        </span>
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                                          +${margin.calculatedAmount.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {deliverable.costs.length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                  Costs:
                                </div>
                                <div className="space-y-1">
                                  {deliverable.costs
                                    // Filter out express delivery and same location costs from preview
                                    .filter((cost: any) => 
                                      !cost.isExpressDelivery && !cost.isSameLocationCharge
                                    )
                                    .map((cost: any, cIdx: number) => (
                                      <div
                                        key={cIdx}
                                        className="text-sm bg-green-50 dark:bg-green-900/20 p-2 rounded"
                                      >
                                        <div className="flex justify-between">
                                          <span className="text-gray-700 dark:text-gray-300">
                                            {cost.name} ({cost.costType === 'Percentage' ? `${cost.value}%` : `$${cost.value}`})
                                          </span>
                                          <span className="font-semibold text-green-600 dark:text-green-400">
                                            +${(cost.calculatedAmount || 0).toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  {/* Show count of hidden costs if any */}
                                  {deliverable.costs.filter((cost: any) => 
                                    cost.isExpressDelivery || cost.isSameLocationCharge
                                  ).length > 0 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
                                      Note: {deliverable.costs.filter((cost: any) => 
                                        cost.isExpressDelivery || cost.isSameLocationCharge
                                      ).length} delivery cost(s) will be applied at order time
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="mb-2 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Preview Price
                                {deliverable.costs.filter((c: any) => c.isExpressDelivery || c.isSameLocationCharge).length > 0 && (
                                  <span className="text-xs text-gray-400 ml-2">(excludes delivery costs)</span>
                                )}
                              </div>
                              {(() => {
                                // Calculate preview price excluding express delivery and same location costs
                                const previewCosts = deliverable.costs.filter((c: any) => 
                                  !c.isExpressDelivery && !c.isSameLocationCharge
                                );
                                const previewPrice = deliverable.basePrice + 
                                  deliverable.margins.reduce((sum: number, m: any) => sum + (m.calculatedAmount || 0), 0) +
                                  previewCosts.reduce((sum: number, c: any) => sum + (c.calculatedAmount || 0), 0);
                                
                                return (
                                  <>
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                                      ${previewPrice.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                      Base: ${deliverable.basePrice.toFixed(2)} + 
                                      Margins: ${deliverable.margins.reduce((sum: number, m: any) => sum + (m.calculatedAmount || 0), 0).toFixed(2)} + 
                                      Costs: ${previewCosts.reduce((sum: number, c: any) => sum + (c.calculatedAmount || 0), 0).toFixed(2)}
                                      {deliverable.costs.filter((c: any) => c.isExpressDelivery || c.isSameLocationCharge).length > 0 && (
                                        <span className="text-gray-400"> (+ {deliverable.costs.filter((c: any) => c.isExpressDelivery || c.isSameLocationCharge).length} delivery cost(s) at order time)</span>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </span>
              ) : (
                'Submit Products'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPreviewModal;
