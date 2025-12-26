import React, { useState, useEffect } from "react";
import { CurrencyConversion } from "../../services/currencyConversion/currencyConversion.services";

interface CurrencyConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  editItem: CurrencyConversion | null;
}

const CurrencyConversionModal: React.FC<CurrencyConversionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
}) => {
  const [formData, setFormData] = useState({
    currencyCode: "",
    rate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({
    currencyCode: false,
    rate: false,
  });

  // Common currency codes
  const currencyCodes = ["INR", "USD", "AED", "HKD", "SGD"];

  useEffect(() => {
    if (editItem) {
      setFormData({
        currencyCode: editItem.currencyCode || "",
        rate: editItem.rate?.toString() || "",
      });
    } else {
      setFormData({
        currencyCode: "",
        rate: "",
      });
    }
    setErrors({});
    setTouched({
      currencyCode: false,
      rate: false,
    });
  }, [editItem, isOpen]);

  const validateField = (
    name: keyof typeof formData,
    value: string
  ): string | undefined => {
    switch (name) {
      case "currencyCode":
        return !value.trim() ? "Currency Code is required" : undefined;
      case "rate":
        if (!value.trim()) return "Rate is required";
        const rate = parseFloat(value);
        return isNaN(rate) || rate <= 0
          ? "Rate must be a positive number"
          : undefined;
      default:
        return undefined;
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const errorCurrencyCode = validateField(
      "currencyCode",
      formData.currencyCode
    );
    if (errorCurrencyCode) newErrors.currencyCode = errorCurrencyCode;

    const errorRate = validateField("rate", formData.rate);
    if (errorRate) newErrors.rate = errorRate;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      currencyCode: true,
      rate: true,
    });

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        currencyCode: formData.currencyCode.trim(),
        rate: parseFloat(formData.rate),
      };

      await onSave(submitData);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (touched[name as keyof typeof touched]) {
      const error = validateField(name as keyof typeof formData, value);
      setErrors((prev) => ({
        ...prev,
        [name]: error || "",
      }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    const error = validateField(
      name as keyof typeof formData,
      formData[name as keyof typeof formData]
    );
    setErrors((prev) => ({
      ...prev,
      [name]: error || "",
    }));
  };

  if (!isOpen) return null;

  const title = editItem
    ? "Edit Currency Conversion"
    : "Create Currency Conversion";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-[600px] max-h-[80vh] transform transition-all duration-300 scale-100 flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-transform duration-200 hover:scale-110"
              disabled={isSubmitting}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form
            id="currency-conversion-form"
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            {/* Currency Code and Rate Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Currency Code
                </label>
                <div className="relative">
                  <select
                    name="currencyCode"
                    value={formData.currencyCode}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.currencyCode && errors.currencyCode
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select Currency Code</option>
                    {currencyCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.currencyCode && errors.currencyCode && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errors.currencyCode}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Rate
                </label>
                <input
                  type="number"
                  name="rate"
                  value={formData.rate}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.rate && errors.rate
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  placeholder="Enter Rate"
                  step="0.0001"
                  required
                  disabled={isSubmitting}
                />
                {touched.rate && errors.rate && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errors.rate}
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="currency-conversion-form"
              className="min-w-[160px] px-4 py-2 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : editItem ? (
                "Update Currency Conversion"
              ) : (
                "Create Currency Conversion"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrencyConversionModal;
