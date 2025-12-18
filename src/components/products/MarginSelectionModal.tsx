import React, { useState, useEffect } from 'react';
import toastHelper from '../../utils/toastHelper';

export interface MarginSelection {
  brand: boolean;
  productCategory: boolean;
  conditionCategory: boolean;
  sellerCategory: boolean;
  customerCategory: boolean;
}

interface MarginSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNext: (selection: MarginSelection) => void;
  products: any[];
  initialSelection?: MarginSelection;
}

const MarginSelectionModal: React.FC<MarginSelectionModalProps> = ({
  isOpen,
  onClose,
  onNext,
  products,
  initialSelection,
}) => {
  const [selection, setSelection] = useState<MarginSelection>({
    brand: false,
    productCategory: false,
    conditionCategory: false,
    sellerCategory: false,
    customerCategory: false,
  });

  useEffect(() => {
    if (isOpen) {
      // Pre-populate with initial selection if provided, otherwise reset
      if (initialSelection) {
        setSelection(initialSelection);
      } else {
        setSelection({
          brand: false,
          productCategory: false,
          conditionCategory: false,
          sellerCategory: false,
          customerCategory: false,
        });
      }
    }
  }, [isOpen, products, initialSelection]); // Include initialSelection in dependencies

  const handleToggle = (key: keyof MarginSelection) => {
    setSelection(prev => {
      // ✅ FIX #1: USE FUNCTIONAL UPDATE - Always read from 'prev', never from closure
      if (key === 'sellerCategory') {
        const newSellerCategory = !prev.sellerCategory;
        return {
          ...prev,
          sellerCategory: newSellerCategory,
          // ✅ DETERMINISTIC: If turning OFF, turn off dependents
          ...(newSellerCategory ? {} : {
            brand: false,
            productCategory: false,
            conditionCategory: false,
            // customerCategory stays independent
          }),
        };
      } else if (key === 'customerCategory') {
        // ✅ INDEPENDENT: Can toggle independently
        return {
          ...prev,
          customerCategory: !prev.customerCategory,
        };
      } else {
        // ✅ DEPENDENT: Can only toggle if sellerCategory is ON
        if (!prev.sellerCategory) {
          toastHelper.showTost('Please enable Seller Category margin first', 'warning');
          return prev; // ✅ NO CHANGE if dependency not met
        }
        return {
          ...prev,
          [key]: !prev[key],
        };
      }
    });
  };

  const handleNext = () => {
    // Allow proceeding without selecting any margins
    onNext(selection);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Select Margins to Apply
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.sellerCategory}
                  onChange={() => handleToggle('sellerCategory')}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-3 text-lg font-medium text-gray-800 dark:text-white">
                  Seller Category Margin
                </span>
              </label>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 ml-8">
                Apply margin based on seller category. If disabled, all other margins except customer category will be
                disabled.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.brand}
                  onChange={() => handleToggle('brand')}
                  disabled={!selection.sellerCategory}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className={`ml-3 text-lg font-medium ${!selection.sellerCategory ? 'text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                  Brand Margin
                </span>
              </label>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 ml-8">
                Apply margin based on product brand.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.productCategory}
                  onChange={() => handleToggle('productCategory')}
                  disabled={!selection.sellerCategory}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className={`ml-3 text-lg font-medium ${!selection.sellerCategory ? 'text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                  Product Category Margin
                </span>
              </label>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 ml-8">
                Apply margin based on product category.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.conditionCategory}
                  onChange={() => handleToggle('conditionCategory')}
                  disabled={!selection.sellerCategory}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className={`ml-3 text-lg font-medium ${!selection.sellerCategory ? 'text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                  Condition Category Margin
                </span>
              </label>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 ml-8">
                Apply margin based on condition category.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.customerCategory}
                  onChange={() => handleToggle('customerCategory')}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-3 text-lg font-medium text-gray-800 dark:text-white">
                  Customer Category Margin
                </span>
              </label>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 ml-8">
                Apply margin based on customer category. Can be enabled independently of seller margin.
              </p>
            </div>
          </div>

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

export default MarginSelectionModal;
