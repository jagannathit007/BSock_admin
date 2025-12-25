import React, { useState, useEffect } from "react";
import { SellerCategory } from "../../services/sellerCategory/sellerCategory.services";

interface FormData {
  title: string;
  description: string;
  marginType?: 'fixed' | 'percentage' | '';
  margin?: number | null;
  marginInput?: string; // Store raw input value for better decimal handling
}

interface SellerCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: FormData) => void;
  editItem?: SellerCategory;
  allowMarginEdit?: boolean;
}

const SellerCategoryModal: React.FC<SellerCategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
  allowMarginEdit = false,
}) => {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    marginType: "",
    margin: null,
    marginInput: "",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  useEffect(() => {
    if (editItem) {
      const marginValue = editItem.margin ?? null;
      setFormData({
        title: editItem.title || "",
        description: editItem.description || "",
        marginType: editItem.marginType || "",
        margin: marginValue,
        marginInput: marginValue !== null && marginValue !== undefined ? marginValue.toString() : "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        marginType: "",
        margin: null,
        marginInput: "",
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
            {editItem ? "Edit Seller Category" : "Add Seller Category"}
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
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Allow only numbers and decimal point
                    const decimalRegex = /^\d*\.?\d*$/;
                    if (inputValue === "" || decimalRegex.test(inputValue)) {
                      // Store raw input for display
                      const marginValue = inputValue === '' 
                        ? null 
                        : (inputValue === '.' || inputValue.endsWith('.') 
                          ? null 
                          : parseFloat(inputValue) || null);
                      
                      setFormData({ 
                        ...formData, 
                        margin: marginValue,
                        marginInput: inputValue
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    // Allow: backspace, delete, tab, escape, enter, decimal point, and numbers
                    if (
                      [46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
                      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                      (e.keyCode === 65 && e.ctrlKey === true) ||
                      (e.keyCode === 67 && e.ctrlKey === true) ||
                      (e.keyCode === 86 && e.ctrlKey === true) ||
                      (e.keyCode === 88 && e.ctrlKey === true) ||
                      // Allow: home, end, left, right, down, up
                      (e.keyCode >= 35 && e.keyCode <= 40) ||
                      // Allow numbers and decimal point
                      ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105))
                    ) {
                      // Check if decimal point already exists
                      if (e.keyCode === 190 || e.keyCode === 110) {
                        const currentValue = formData.marginInput || '';
                        if (currentValue.indexOf(".") !== -1) {
                          e.preventDefault();
                        }
                      }
                      return;
                    }
                    // Prevent all other keys
                    e.preventDefault();
                  }}
                  onPaste={(e) => {
                    // Validate pasted content
                    const pastedText = e.clipboardData.getData("text");
                    const decimalRegex = /^\d*\.?\d*$/;
                    if (!decimalRegex.test(pastedText)) {
                      e.preventDefault();
                    }
                  }}
                  onBlur={(e) => {
                    // On blur, ensure we have a valid number if there's input
                    const inputValue = e.target.value.trim();
                    if (inputValue && inputValue !== '.') {
                      const numValue = parseFloat(inputValue);
                      if (!isNaN(numValue)) {
                        setFormData({
                          ...formData,
                          margin: numValue,
                          marginInput: numValue.toString()
                        });
                      }
                    }
                  }}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  placeholder="Enter margin value (e.g., 100.20)"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter margin value based on selected margin type (e.g., 100.20)
                </p>
              </div>
            </>
          )}

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

export default SellerCategoryModal;

