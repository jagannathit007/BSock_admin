import React, { useState, useEffect } from "react";
import { ConditionCategory } from "../../services/conditionCategory/conditionCategory.services";

interface FormData {
  id?: string;
  code?: string;
  title: string;
  description: string;
  marginType?: 'fixed' | 'percentage' | '';
  margin?: number | null;
}

interface ConditionCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: FormData) => void;
  editItem?: ConditionCategory;
  allowMarginEdit?: boolean;
}

const ConditionCategoryModal: React.FC<ConditionCategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
  allowMarginEdit = false,
}) => {
  const [formData, setFormData] = useState<FormData>({
    id: "",
    code: "",
    title: "",
    description: "",
    marginType: "",
    margin: null,
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  useEffect(() => {
    if (editItem) {
      setFormData({
        code: editItem.code || "",
        title: editItem.title || "",
        description: editItem.description || "",
        marginType: (editItem as any).marginType || "",
        margin: (editItem as any).margin ?? null,
      });
    } else {
      setFormData({
        code: "",
        title: "",
        description: "",
        marginType: "",
        margin: null,
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
            {editItem ? "Edit Condition" : "Add Condition"}
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
              Code
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="Enter condition code"
            />
          </div>

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
              placeholder="Enter condition title"
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
              placeholder="Enter condition description"
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
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.margin ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, margin: value === '' ? null : parseFloat(value) || 0 });
                  }}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  placeholder="Enter margin value (optional)"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter margin value based on selected margin type
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

export default ConditionCategoryModal;

