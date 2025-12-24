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
  initialCosts?: SelectedCost[];
}

const CostModuleSelectionModal: React.FC<CostModuleSelectionModalProps> = ({
  isOpen,
  onClose,
  onNext,
  products,
  country,
  initialCosts,
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

  // Pre-populate with initial costs if provided, otherwise reset
  useEffect(() => {
    if (isOpen) {
      if (initialCosts && initialCosts.length > 0) {
        // Pre-populate with initial cost IDs
        const initialCostIds = new Set(initialCosts.map(c => c.costId));
        setSelectedCosts(initialCostIds);
      } else {
        setSelectedCosts(new Set());
      }
    }
  }, [isOpen, country, initialCosts]);

  // Helper function to check if same location applies for the current country
  const isSameLocation = () => {
    const countryCode = country === 'Hongkong' ? 'HK' : 'D';
    
    const normalizeDeliveryLocation = (deliveryLocation: any): string[] => {
      if (Array.isArray(deliveryLocation)) {
        return deliveryLocation;
      }
      if (typeof deliveryLocation === 'string') {
        try {
          const parsed = JSON.parse(deliveryLocation);
          return Array.isArray(parsed) ? parsed : [deliveryLocation];
        } catch {
          return [deliveryLocation];
        }
      }
      return [];
    };
    
    // Check if any product has same location (currentLocation matches country AND country is in deliveryLocation)
    return products.some(p => {
      if (!p.currentLocation) return false;
      const deliveryLocations = normalizeDeliveryLocation(p.deliveryLocation);
      return p.currentLocation === countryCode && deliveryLocations.includes(countryCode);
    });
  };

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
    
    const sameLocationApplies = isSameLocation();
    
    // Find groups that have any cost with isSameLocationCharge: true
    const groupsWithSameLocation = new Set<string>();
    // Find groups that have any cost with isExpressDelivery: true
    const groupsWithExpressDelivery = new Set<string>();
    
    Object.entries(grouped).forEach(([groupId, groupCosts]) => {
      if (groupId !== '_standalone') {
        const hasSameLocationCharge = groupCosts.some(cost => cost.isSameLocationCharge === true);
        const hasExpressDelivery = groupCosts.some(cost => cost.isExpressDelivery === true);
        
        if (hasSameLocationCharge) {
          groupsWithSameLocation.add(groupId);
        }
        if (hasExpressDelivery) {
          groupsWithExpressDelivery.add(groupId);
        }
      }
    });
    
    // Filter costs based on same location logic
    const filteredGrouped: Record<string, any[]> = {};
    Object.entries(grouped).forEach(([groupId, groupCosts]) => {
      if (sameLocationApplies) {
        // If same location applies:
        // 1. If group has same location charge, hide entire group
        // 2. If group has express delivery, hide entire group
        // 3. For standalone costs (no group), hide express delivery costs
        if (groupId === '_standalone') {
          // For standalone costs, hide express delivery costs
          filteredGrouped[groupId] = groupCosts.filter(cost => !cost.isExpressDelivery);
        } else if (groupsWithSameLocation.has(groupId) || groupsWithExpressDelivery.has(groupId)) {
          // Hide entire group if it has same location charge OR express delivery
          // Don't add to filteredGrouped
        } else {
          // Group doesn't have same location or express delivery, show all costs
          filteredGrouped[groupId] = groupCosts;
        }
      } else {
        // If same location doesn't apply, show all costs
        filteredGrouped[groupId] = groupCosts;
      }
    });
    
    setGroupedCosts(filteredGrouped);
  }, [costs, country, products]);

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
    const newSelected = new Set(selectedCosts);
    
    // If cost belongs to a group, handle group selection
    if (cost.groupId) {
      // Find ALL costs in the same group (including express delivery and same location)
      const groupMembers = costs.filter(c => c.groupId === cost.groupId);
      
      // Check if all group members are currently selected
      const allGroupSelected = groupMembers.every(c => newSelected.has(c._id));
      
      if (allGroupSelected) {
        // DESELECT ALL: Remove all costs in this group
        groupMembers.forEach(c => newSelected.delete(c._id));
      } else {
        // SELECT ALL: Add all costs in this group
        groupMembers.forEach(c => {
          // For express delivery costs, ensure only one express delivery is selected at a time
          if (c.isExpressDelivery) {
            // Remove all other express delivery costs (even from other groups)
            costs.forEach(otherCost => {
              if (otherCost.isExpressDelivery && otherCost._id !== c._id) {
                newSelected.delete(otherCost._id);
              }
            });
          }
          newSelected.add(c._id);
        });
      }
    } else {
      // INDIVIDUAL COST: Toggle single cost (no group)
      if (newSelected.has(costId)) {
        newSelected.delete(costId);
      } else {
        // For express delivery costs, ensure only one express delivery is selected at a time
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
    <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-[60]">
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
                        
                        // Check if any standalone (non-group) express delivery is selected
                        const hasStandaloneExpressDelivery = Array.from(selectedCosts).some(id => {
                          const selectedCost = costs.find(c => c._id === id);
                          return selectedCost?.isExpressDelivery && !selectedCost?.groupId;
                        });
                        
                        // Disable if:
                        // 1. This is an express delivery and another express delivery is selected
                        // 2. OR if this cost is in a group AND a standalone express delivery is selected
                        const isDisabled = 
                          (cost.isExpressDelivery && 
                            Array.from(selectedCosts).some(id => {
                              const selectedCost = costs.find(c => c._id === id);
                              return selectedCost?.isExpressDelivery && selectedCost._id !== cost._id;
                            })) ||
                          (hasStandaloneExpressDelivery && cost.groupId && groupId !== '_standalone');

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

