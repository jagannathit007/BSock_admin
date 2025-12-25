import React, { useState, useEffect } from "react";
import { CustomerCategory } from "../../services/customerCategory/customerCategory.services";

interface FormData {
  title: string;
  description: string;
  marginType?: 'fixed' | 'percentage' | '';
  margin?: number | null;
  maxBidPercentage?: number | null;
  minBidPercentage?: number | null;
  bidWalletAllowancePer?: number | null;
  readyStockAllowancePer?: number | null;
  // Store raw input values for better decimal handling
  marginInput?: string;
  maxBidPercentageInput?: string;
  minBidPercentageInput?: string;
  bidWalletAllowancePerInput?: string;
  readyStockAllowancePerInput?: string;
}

interface CustomerCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: FormData) => void;
  editItem?: CustomerCategory;
  allowMarginEdit?: boolean; // controls visibility/editing of margin fields
}

const CustomerCategoryModal: React.FC<CustomerCategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
  allowMarginEdit = true,
}) => {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    marginType: "",
    margin: null,
    maxBidPercentage: null,
    minBidPercentage: null,
    bidWalletAllowancePer: null,
    readyStockAllowancePer: null,
    marginInput: "",
    maxBidPercentageInput: "",
    minBidPercentageInput: "",
    bidWalletAllowancePerInput: "",
    readyStockAllowancePerInput: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  useEffect(() => {
    if (editItem) {
      setFormData({
        title: editItem.title || "",
        description: editItem.description || "",
        marginType: editItem.marginType || "",
        margin: editItem.margin ?? null,
        maxBidPercentage: editItem.maxBidPercentage ?? null,
        minBidPercentage: editItem.minBidPercentage ?? null,
        bidWalletAllowancePer: editItem.bidWalletAllowancePer ?? null,
        readyStockAllowancePer: editItem.readyStockAllowancePer ?? null,
        marginInput: editItem.margin !== null && editItem.margin !== undefined ? editItem.margin.toString() : "",
        maxBidPercentageInput: editItem.maxBidPercentage !== null && editItem.maxBidPercentage !== undefined ? editItem.maxBidPercentage.toString() : "",
        minBidPercentageInput: editItem.minBidPercentage !== null && editItem.minBidPercentage !== undefined ? editItem.minBidPercentage.toString() : "",
        bidWalletAllowancePerInput: editItem.bidWalletAllowancePer !== null && editItem.bidWalletAllowancePer !== undefined ? editItem.bidWalletAllowancePer.toString() : "",
        readyStockAllowancePerInput: editItem.readyStockAllowancePer !== null && editItem.readyStockAllowancePer !== undefined ? editItem.readyStockAllowancePer.toString() : "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        marginType: "",
        margin: null,
        maxBidPercentage: null,
        minBidPercentage: null,
        bidWalletAllowancePer: null,
        readyStockAllowancePer: null,
        marginInput: "",
        maxBidPercentageInput: "",
        minBidPercentageInput: "",
        bidWalletAllowancePerInput: "",
        readyStockAllowancePerInput: "",
      });
    }
    setErrors({});
  }, [editItem, isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};
    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper function to handle decimal number input
  const handleDecimalInput = (
    fieldName: 'margin' | 'minBidPercentage' | 'maxBidPercentage' | 'bidWalletAllowancePer' | 'readyStockAllowancePer',
    inputValue: string
  ) => {
    const decimalRegex = /^\d*\.?\d*$/;
    if (inputValue === "" || decimalRegex.test(inputValue)) {
      const numValue = inputValue === '' 
        ? null 
        : (inputValue === '.' || inputValue.endsWith('.') 
          ? null 
          : parseFloat(inputValue) || null);
      
      const inputFieldName = `${fieldName}Input` as keyof FormData;
      setFormData(prev => ({
        ...prev,
        [fieldName]: numValue,
        [inputFieldName]: inputValue
      }));
    }
  };

  // Helper function for onKeyDown validation
  const handleDecimalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentValue: string) => {
    if (
      [46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
      (e.keyCode === 65 && e.ctrlKey === true) ||
      (e.keyCode === 67 && e.ctrlKey === true) ||
      (e.keyCode === 86 && e.ctrlKey === true) ||
      (e.keyCode === 88 && e.ctrlKey === true) ||
      (e.keyCode >= 35 && e.keyCode <= 40) ||
      ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105))
    ) {
      if (e.keyCode === 190 || e.keyCode === 110) {
        if (currentValue.indexOf(".") !== -1) {
          e.preventDefault();
        }
      }
      return;
    }
    e.preventDefault();
  };

  // Helper function for onBlur normalization
  const handleDecimalBlur = (
    inputValue: string,
    fieldName: 'margin' | 'minBidPercentage' | 'maxBidPercentage' | 'bidWalletAllowancePer' | 'readyStockAllowancePer'
  ) => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && trimmedValue !== '.') {
      const numValue = parseFloat(trimmedValue);
      if (!isNaN(numValue)) {
        const inputFieldName = `${fieldName}Input` as keyof FormData;
        setFormData(prev => ({
          ...prev,
          [fieldName]: numValue,
          [inputFieldName]: numValue.toString()
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] sm:max-h-[95vh] overflow-y-auto mx-2 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
            {editItem ? "Edit Customer Category" : "Add Customer Category"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 sm:p-2"
            aria-label="Close modal"
          >
            <i className="fas fa-times text-lg sm:text-xl md:text-2xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                errors.title ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter category title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-y"
              placeholder="Enter category description"
            />
          </div>

          {allowMarginEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Margin Type
                </label>
                <select
                  value={formData.marginType || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, marginType: e.target.value as 'fixed' | 'percentage' | '' })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Select margin type (optional)</option>
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Margin
                </label>
                <input
                  type="text"
                  value={formData.marginInput || ''}
                  onChange={(e) => handleDecimalInput('margin', e.target.value)}
                  onKeyDown={(e) => handleDecimalKeyDown(e, formData.marginInput || '')}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData("text");
                    const decimalRegex = /^\d*\.?\d*$/;
                    if (!decimalRegex.test(pastedText)) {
                      e.preventDefault();
                    }
                  }}
                  onBlur={(e) => handleDecimalBlur(e.target.value, 'margin')}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  placeholder="Enter margin value (e.g., 100.20)"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter margin value based on selected margin type (e.g., 100.20)
                </p>
              </div>
            </>
          )}


          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Bid Percentage (%)
            </label>
            <input
              type="text"
              value={formData.minBidPercentageInput || ''}
              onChange={(e) => handleDecimalInput('minBidPercentage', e.target.value)}
              onKeyDown={(e) => handleDecimalKeyDown(e, formData.minBidPercentageInput || '')}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData("text");
                const decimalRegex = /^\d*\.?\d*$/;
                if (!decimalRegex.test(pastedText)) {
                  e.preventDefault();
                }
              }}
              onBlur={(e) => handleDecimalBlur(e.target.value, 'minBidPercentage')}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="Enter min bid percentage (e.g., 5.50)"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Minimum bid increment percentage for this category (e.g., 5.50)
            </p>
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Bid Percentage (%)
            </label>
            <input
              type="text"
              value={formData.maxBidPercentageInput || ''}
              onChange={(e) => handleDecimalInput('maxBidPercentage', e.target.value)}
              onKeyDown={(e) => handleDecimalKeyDown(e, formData.maxBidPercentageInput || '')}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData("text");
                const decimalRegex = /^\d*\.?\d*$/;
                if (!decimalRegex.test(pastedText)) {
                  e.preventDefault();
                }
              }}
              onBlur={(e) => handleDecimalBlur(e.target.value, 'maxBidPercentage')}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="Enter max bid percentage (e.g., 10.75)"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Maximum bid percentage allowed for this category (e.g., 10.75)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bid Wallet Allowance (%)
            </label>
            <input
              type="text"
              value={formData.bidWalletAllowancePerInput || ''}
              onChange={(e) => handleDecimalInput('bidWalletAllowancePer', e.target.value)}
              onKeyDown={(e) => handleDecimalKeyDown(e, formData.bidWalletAllowancePerInput || '')}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData("text");
                const decimalRegex = /^\d*\.?\d*$/;
                if (!decimalRegex.test(pastedText)) {
                  e.preventDefault();
                }
              }}
              onBlur={(e) => handleDecimalBlur(e.target.value, 'bidWalletAllowancePer')}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="Enter bid wallet allowance percentage (e.g., 25.50)"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Percentage of bid amount required in wallet (e.g., 25.50)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ready Stock Allowance (%)
            </label>
            <input
              type="text"
              value={formData.readyStockAllowancePerInput || ''}
              onChange={(e) => handleDecimalInput('readyStockAllowancePer', e.target.value)}
              onKeyDown={(e) => handleDecimalKeyDown(e, formData.readyStockAllowancePerInput || '')}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData("text");
                const decimalRegex = /^\d*\.?\d*$/;
                if (!decimalRegex.test(pastedText)) {
                  e.preventDefault();
                }
              }}
              onBlur={(e) => handleDecimalBlur(e.target.value, 'readyStockAllowancePer')}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="Enter ready stock allowance percentage (e.g., 15.25)"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Ready stock allowance percentage for this category (e.g., 15.25)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm sm:text-base bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors font-medium"
            >
              {editItem ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerCategoryModal;

