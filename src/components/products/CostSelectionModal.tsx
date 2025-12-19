import React, { useState } from "react";

interface CostSelectionModalProps {
  isOpen: boolean;
  countries: string[];
  costsByCountry: Record<string, CostCharge[]>;
  selectedCosts: Record<string, string[]>;
  products: any[];
  onClose: () => void;
  onBack: () => void;
  onNext: (costs: Record<string, string[]>) => void;
  loading?: boolean;
}

interface CostCharge {
  _id: string;
  name: string;
  costType: "Percentage" | "Fixed";
  costField: string;
  costUnit?: string;
  value: number;
  minValue?: number | null;
  maxValue?: number | null;
  remark?: string;
  groupId?: string | null;
  isExpressDelivery?: boolean;
  isSameLocationCharge?: boolean;
}

const CostSelectionModal: React.FC<CostSelectionModalProps> = ({
  isOpen,
  countries,
  costsByCountry,
  selectedCosts,
  products,
  onClose,
  onBack,
  onNext,
  loading,
}) => {
  const [localSelected, setLocalSelected] = useState<Record<string, string[]>>(selectedCosts);

  // Helper function to check if cost is applicable based on product locations
  const isCostApplicable = (cost: CostCharge, country: string) => {
    // Map country name to code: "Hongkong" -> "HK", "Dubai" -> "D"
    const countryCode = country === 'Hongkong' ? 'HK' : 'D';
    
    // Helper function to normalize deliveryLocation to array
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
    
    if (cost.isExpressDelivery) {
      // Express delivery: show when currentLocation and deliveryLocation are NOT the same
      return products.some(p => {
        if (!p.currentLocation) return false;
        
        const deliveryLocations = normalizeDeliveryLocation(p.deliveryLocation);
        
        // Express delivery applies when locations don't match
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
        
        // Same location applies when currentLocation matches country AND country is in deliveryLocation
        return p.currentLocation === countryCode && 
          deliveryLocations.includes(countryCode);
      });
    }
    
    return true; // Other costs are always applicable
  };

  // Helper: ensure only one express cost per country and handle group selection
  const toggleCost = (country: string, cost: CostCharge) => {
    setLocalSelected((prev) => {
      const prevList = prev[country] || [];
      const countryCosts = costsByCountry[country] || [];
      const prevSet = new Set(prevList);

      // If cost belongs to a group, handle group selection
      if (cost.groupId) {
        // Find ALL costs in the same group for this country
        const groupMembers = countryCosts.filter((c) => c.groupId === cost.groupId);
        const groupIds = groupMembers.map((c) => c._id);
        
        // Check if all group members are currently selected
        const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => prevSet.has(id));
        
        let nextList: string[];
        
        if (allGroupSelected) {
          // DESELECT ALL: Remove all costs in this group
          nextList = prevList.filter((id) => !groupIds.includes(id));
        } else {
          // SELECT ALL: Add all costs in this group
          nextList = [...prevList];
          groupIds.forEach((id) => {
            if (!nextList.includes(id)) {
              nextList.push(id);
            }
          });
          
          // For express delivery costs in the group, ensure only one express delivery is selected
          groupMembers.forEach((groupCost) => {
            if (groupCost.isExpressDelivery) {
              // Remove all other express delivery costs (even from other groups)
              countryCosts.forEach((otherCost) => {
                if (otherCost.isExpressDelivery && otherCost._id !== groupCost._id) {
                  const index = nextList.indexOf(otherCost._id);
                  if (index > -1) {
                    nextList.splice(index, 1);
                  }
                }
              });
            }
          });
        }
        
        return { ...prev, [country]: nextList };
      } else {
        // INDIVIDUAL COST: Toggle single cost (no group)
        if (prevSet.has(cost._id)) {
          // DESELECT: Remove the cost
          return { ...prev, [country]: prevList.filter((id) => id !== cost._id) };
        } else {
          // SELECT: Add the cost
          let nextList = [...prevList, cost._id];
          
          // For express delivery costs, ensure only one express delivery is selected
          if (cost.isExpressDelivery) {
            nextList = nextList.filter((id) => {
              const existing = countryCosts.find((c) => c._id === id);
              return existing ? !existing.isExpressDelivery || existing._id === cost._id : true;
            });
            if (!nextList.includes(cost._id)) {
              nextList.push(cost._id);
            }
          }
          
          return { ...prev, [country]: nextList };
        }
      }
    });
  };

  const handleNext = () => {
    onNext(localSelected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Select Cost Modules</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {countries.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400">No countries found in the Excel file.</p>
          )}

           {countries.map((country) => {
             const charges = costsByCountry[country] || [];
             const selected = new Set(localSelected[country] || []);
             
             // Check if same location applies for this country
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
             
             const sameLocationApplies = products.some(p => {
               if (!p.currentLocation) return false;
               const deliveryLocations = normalizeDeliveryLocation(p.deliveryLocation);
               return p.currentLocation === countryCode && deliveryLocations.includes(countryCode);
             });
             
             // Find groups that have any cost with isSameLocationCharge: true for this country
             const groupsWithSameLocation = new Set<string>();
             // Find groups that have any cost with isExpressDelivery: true for this country
             const groupsWithExpressDelivery = new Set<string>();
             
             charges.forEach(cost => {
               if (cost.groupId) {
                 if (cost.isSameLocationCharge === true) {
                   groupsWithSameLocation.add(cost.groupId);
                 }
                 if (cost.isExpressDelivery === true) {
                   groupsWithExpressDelivery.add(cost.groupId);
                 }
               }
             });
             
             // Filter costs based on same location logic
             const filteredCharges = charges.filter(cost => {
               if (sameLocationApplies) {
                 // If same location applies:
                 // 1. If group has same location charge, hide entire group
                 if (cost.groupId && groupsWithSameLocation.has(cost.groupId)) {
                   return false;
                 }
                 // 2. If group has express delivery, hide entire group
                 if (cost.groupId && groupsWithExpressDelivery.has(cost.groupId)) {
                   return false;
                 }
                 // 3. For standalone costs (no group), hide express delivery costs
                 if (!cost.groupId && cost.isExpressDelivery === true) {
                   return false;
                 }
               }
               return true;
             });

             return (
               <div key={country} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                 <div className="flex items-center justify-between mb-3">
                   <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{country}</h3>
                   <span className="text-sm text-gray-500 dark:text-gray-400">
                     {selected.size} selected
                   </span>
                 </div>

                 {filteredCharges.length === 0 ? (
                   <p className="text-gray-500 dark:text-gray-400">No costs available for this country.</p>
                 ) : (
                   <div className="space-y-2">
                     {filteredCharges.filter(cost => isCostApplicable(cost, country)).map((cost) => {
                      const isSelected = selected.has(cost._id);
                      const isSameLocation = cost.isSameLocationCharge;
                      const isExpress = cost.isExpressDelivery;

                      // Basic hint for applicability; not blocking selection
                      const locationHint =
                        isExpress || isSameLocation
                          ? `(${isExpress ? "Express" : "Same-location"} charge)`
                          : "";

                      return (
                        <label
                          key={cost._id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                              : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCost(country, cost)}
                            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-800 dark:text-gray-200">{cost.name}</div>
                              {cost.groupId && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  Group: {cost.groupId}
                                </span>
                              )}
                              {locationHint && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200">
                                  {locationHint}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {cost.costType} {cost.value}
                              {cost.costType === "Percentage" ? "%" : ""}
                              {cost.costUnit ? ` • Unit: ${cost.costUnit}` : ""} • Field: {cost.costField}
                            </div>
                            {cost.remark && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{cost.remark}</div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2.5 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Calculating..." : "Next: Review"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CostSelectionModal;

