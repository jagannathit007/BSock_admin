import React, { useState, useEffect } from 'react';
import { CostModuleService } from '../../services/costModule/costModule.services';
import toastHelper from '../../utils/toastHelper';

export interface SelectedCost {
  costId: string;
  name: string;
  costType: 'Percentage' | 'Fixed';
  costField: 'product' | 'delivery';
  costUnit?: 'pc' | 'kg' | 'moq' | 'order amount' | 'cart quantity';
  value: number;
  groupId?: string;
  isExpressDelivery?: boolean;
  isSameLocationCharge?: boolean;
}

interface CostModuleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNext: (selectedCosts: SelectedCost[]) => void;
  products: any[];
  country: 'Hongkong' | 'Dubai';
}

const CostModuleSelectionModal: React.FC<CostModuleSelectionModalProps> = ({
  isOpen,
  onClose,
  onNext,
  products,
  country,
}) => {
  const [costs, setCosts] = useState<any[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [groupedCosts, setGroupedCosts] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (isOpen) {
      fetchCosts();
    }
  }, [isOpen, country]);

  // ✅ FIX #2: Reset selections when modal opens or country changes (prevents cross-location contamination)
  useEffect(() => {
    if (isOpen) {
      setSelectedCosts(new Set());
    }
  }, [isOpen, country]);

  useEffect(() => {
    // Group costs by groupId
    const grouped: Record<string, any[]> = {};
    costs.forEach(cost => {
      if (cost.groupId) {
        if (!grouped[cost.groupId]) {
          grouped[cost.groupId] = [];
        }
        grouped[cost.groupId].push(cost);
      } else {
        // Costs without groupId are standalone
        if (!grouped['_standalone']) {
          grouped['_standalone'] = [];
        }
        grouped['_standalone'].push(cost);
      }
    });
    setGroupedCosts(grouped);
  }, [costs]);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const response = await CostModuleService.getCostsByCountry();
      if (response.data) {
        // Filter costs for the selected country
        const countryCosts = response.data[country] || [];
        // Filter out deleted costs
        const activeCosts = countryCosts.filter((cost: any) => !cost.isDeleted);
        setCosts(activeCosts);
      }
    } catch (error: any) {
      toastHelper.showTost('Failed to fetch cost modules', 'error');
      console.error('Error fetching costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCostToggle = (costId: string, cost: any) => {
    // ✅ FIX #3: PURE FUNCTION - Calculate group membership from source array, not derived state
    const newSelected = new Set(selectedCosts);
    
    // ✅ CRITICAL FIX: Express delivery and same location costs should ALWAYS be individually selectable
    // They should NOT be auto-selected when a group is selected
    if (cost.isExpressDelivery || cost.isSameLocationCharge) {
      // ✅ INDIVIDUAL SELECTION: Express delivery and same location costs are always individually selectable
      if (newSelected.has(costId)) {
        newSelected.delete(costId);
      } else {
        // ✅ EXPRESS DELIVERY: Only one can be selected
        if (cost.isExpressDelivery) {
          // Remove all other express delivery costs
          costs.forEach(c => {
            if (c.isExpressDelivery && c._id !== costId) {
              newSelected.delete(c._id);
            }
          });
        }
        newSelected.add(costId);
      }
    } else if (cost.groupId) {
      // ✅ GROUP SELECTION: For non-express/same-location costs in a group
      // ✅ DETERMINISTIC: Find group members from costs array (source of truth, not groupedCosts state)
      // Exclude express delivery and same location costs from group auto-selection
      const groupMembers = costs.filter(c => 
        c.groupId === cost.groupId && 
        !c.isExpressDelivery && 
        !c.isSameLocationCharge
      );
      
      // ✅ CHECK: Are all non-express group members currently selected?
      const allGroupSelected = groupMembers.every(c => newSelected.has(c._id));
      
      if (allGroupSelected) {
        // ✅ DESELECT ALL: Remove all non-express group members
        groupMembers.forEach(c => newSelected.delete(c._id));
      } else {
        // ✅ SELECT ALL: Add all non-express group members
        groupMembers.forEach(c => newSelected.add(c._id));
      }
    } else {
      // ✅ INDIVIDUAL COST: Toggle single cost (no group, not express/same location)
      if (newSelected.has(costId)) {
        newSelected.delete(costId);
      } else {
        newSelected.add(costId);
      }
    }
    
    setSelectedCosts(newSelected);
  };

  const handleNext = () => {
    const selectedCostData: SelectedCost[] = costs
      .filter(cost => selectedCosts.has(cost._id))
      .map(cost => ({
        costId: cost._id,
        name: cost.name,
        costType: cost.costType,
        costField: cost.costField,
        costUnit: cost.costUnit,
        value: cost.value,
        groupId: cost.groupId,
        isExpressDelivery: cost.isExpressDelivery,
        isSameLocationCharge: cost.isSameLocationCharge,
      }));
    
    onNext(selectedCostData);
  };

  const isCostApplicable = (cost: any) => {
    // Check if cost is applicable based on product locations
    // Map country to code: "Hongkong" -> "HK", "Dubai" -> "D"
    const countryCode = country === 'Hongkong' ? 'HK' : 'D';
    
    // Helper function to normalize deliveryLocation to array
    const normalizeDeliveryLocation = (deliveryLocation: any): string[] => {
      if (Array.isArray(deliveryLocation)) {
        return deliveryLocation;
      }
      if (typeof deliveryLocation === 'string') {
        // Try to parse as JSON if it's a JSON string
        try {
          const parsed = JSON.parse(deliveryLocation);
          return Array.isArray(parsed) ? parsed : [deliveryLocation];
        } catch {
          // If not JSON, treat as single value
          return [deliveryLocation];
        }
      }
      return [];
    };
    
    if (cost.isExpressDelivery) {
      // Express delivery: show when currentLocation and deliveryLocation are NOT the same
      // i.e., currentLocation != countryCode OR countryCode is NOT in deliveryLocation
      return products.some(p => {
        if (!p.currentLocation) return false;
        
        const deliveryLocations = normalizeDeliveryLocation(p.deliveryLocation);
        
        // Express delivery applies when:
        // 1. currentLocation does NOT match the country code, OR
        // 2. currentLocation matches country code BUT country code is NOT in deliveryLocation
        const isSameLocation = p.currentLocation === countryCode && 
          deliveryLocations.includes(countryCode);
        
        return !isSameLocation;
      });
    }
    if (cost.isSameLocationCharge) {
      // Same location charge: show when currentLocation matches country AND country is in deliveryLocation
      return products.some(p => {
        if (!p.currentLocation) return false;
        
        const deliveryLocations = normalizeDeliveryLocation(p.deliveryLocation);
        
        // Same location applies when:
        // currentLocation matches the country code AND country code IS in deliveryLocation array
        return p.currentLocation === countryCode && 
          deliveryLocations.includes(countryCode);
      });
    }
    return true; // Other costs are always applicable
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Select Cost Modules for {country}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading costs...</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {Object.entries(groupedCosts).map(([groupId, groupCosts]) => (
                <div key={groupId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {groupId !== '_standalone' && (
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                      Group: {groupId}
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        (Selecting one will select all in group, except Express Delivery and Same Location costs)
                      </span>
                    </h3>
                  )}
                  <div className="space-y-2">
                    {groupCosts
                      .filter(cost => isCostApplicable(cost))
                      .map(cost => {
                        const isSelected = selectedCosts.has(cost._id);
                        const isDisabled = cost.isExpressDelivery && 
                          Array.from(selectedCosts).some(id => {
                            const selectedCost = costs.find(c => c._id === id);
                            return selectedCost?.isExpressDelivery && selectedCost._id !== cost._id;
                          });

                        return (
                          <div
                            key={cost._id}
                            className={`p-3 border rounded-lg ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700'
                            } ${isDisabled ? 'opacity-50' : ''}`}
                          >
                            <label className="flex items-start cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCostToggle(cost._id, cost)}
                                disabled={isDisabled}
                                className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <div className="ml-3 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-gray-800 dark:text-white">
                                    {cost.name}
                                  </span>
                                  <div className="flex gap-2">
                                    {cost.isExpressDelivery && (
                                      <span className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded">
                                        Express Delivery
                                      </span>
                                    )}
                                    {cost.isSameLocationCharge && (
                                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                                        Same Location
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="font-medium">Type:</span> {cost.costType}
                                    </div>
                                    <div>
                                      <span className="font-medium">Field:</span> {cost.costField}
                                    </div>
                                    {cost.costUnit && (
                                      <div>
                                        <span className="font-medium">Unit:</span> {cost.costUnit}
                                      </div>
                                    )}
                                    <div>
                                      <span className="font-medium">Value:</span> {cost.value}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </label>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
              
              {Object.keys(groupedCosts).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No cost modules available for {country}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostModuleSelectionModal;

