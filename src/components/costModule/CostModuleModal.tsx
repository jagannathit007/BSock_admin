import React, { useState, useEffect } from "react";
import toastHelper from "../../utils/toastHelper";
import Select from "react-select";
import { CostModuleService } from "../../services/costModule/costModule.services";

// Define the interface for CostModule data
interface CostModule {
  _id?: string;
  name: string;
  name2?: string;
  countries: string[];
  remark: string;
  costType: "Percentage" | "Fixed";
  costField: "product" | "delivery";
  costUnit?: "pc" | "kg" | "moq" | "order amount" | "cart quantity";
  value: number;
  minValue?: number;
  maxValue?: number;
  groupId?: string;
  isExpressDelivery?: boolean;
  isSameLocationCharge?: boolean;
  isDeleted: boolean;
}

// Define the interface for form data
interface FormData {
  name: string;
  name2: string;
  countries: string[];
  remark: string;
  message: string;
  costType: "Percentage" | "Fixed";
  costField: "product" | "delivery" | "";
  costUnit: "pc" | "kg" | "moq" | "order amount" | "cart quantity" | "";
  value: string;
  minValue: string;
  maxValue: string;
  groupId: string;
  isExpressDelivery: boolean;
  isSameLocationCharge: boolean;
  isDeleted: boolean;
}

interface ValidationErrors {
  name?: string;
  name2?: string;
  countries?: string;
  remark?: string;
  message?: string;
  costType?: string;
  costField?: string;
  costUnit?: string;
  value?: string;
  minValue?: string;
  maxValue?: string;
  groupId?: string;
  isExpressDelivery?: string;
  isSameLocationCharge?: string;
  isDeleted?: string;
}

interface TouchedFields {
  name: boolean;
  name2: boolean;
  countries: boolean;
  remark: boolean;
  message: boolean;
  costType: boolean;
  costField: boolean;
  costUnit: boolean;
  value: boolean;
  minValue: boolean;
  maxValue: boolean;
  groupId: boolean;
  isExpressDelivery: boolean;
  isSameLocationCharge: boolean;
  isDeleted: boolean;
}

interface CostModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: CostModule) => void;
  editItem?: CostModule;
}

const CostModuleModal: React.FC<CostModuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    name2: "",
    countries: [],
    remark: "",
    message: "",
    costType: "Percentage",
    costField: "",
    costUnit: "",
    value: "",
    minValue: "",
    maxValue: "",
    groupId: "",
    isExpressDelivery: false,
    isSameLocationCharge: false,
    isDeleted: false,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [touched, setTouched] = useState<TouchedFields>({
    name: false,
    name2: false,
    countries: false,
    remark: false,
    message: false,
    costType: false,
    costField: false,
    costUnit: false,
    value: false,
    minValue: false,
    maxValue: false,
    groupId: false,
    isExpressDelivery: false,
    isSameLocationCharge: false,
    isDeleted: false,
  });
  const [groupIds, setGroupIds] = useState<Array<{ groupId: string; display: string; names: string[] }>>([]);
  const [showGroupIdInput, setShowGroupIdInput] = useState<boolean>(false);

  // Cost unit options based on costField
  const getCostUnitOptions = (): Array<{ value: string; label: string }> => {
    if (formData.costField === "product") {
      return [
        { value: "pc", label: "PC" },
        { value: "kg", label: "KG" },
        { value: "moq", label: "MOQ" },
      ];
    } else if (formData.costField === "delivery") {
      return [
        { value: "order amount", label: "Order Amount" },
        { value: "cart quantity", label: "Cart Quantity" },
      ];
    }
    return [];
  };

  // Fetch groupIds when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchGroupIds = async () => {
        try {
          const data = await CostModuleService.getGroupIds();
          setGroupIds(data);
        } catch (error) {
          console.error('Error fetching group IDs:', error);
        }
      };
      fetchGroupIds();
    }
  }, [isOpen]);

  // Static countries list
  const countriesList = ["Hongkong", "Dubai"];

  // Update form data when modal opens or editItem changes
  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setFormData({
          name: editItem.name || "",
          name2: editItem.name2 || "",
          countries: editItem.countries || [],
          remark: editItem.remark || "",
          message: (editItem as any).message || "",
          costType: editItem.costType,
          costField: editItem.costField || "",
          costUnit: editItem.costUnit || "",
          value: editItem.value.toString(),
          minValue: editItem.minValue?.toString() || "",
          maxValue: editItem.maxValue?.toString() || "",
          groupId: editItem.groupId || "",
          isExpressDelivery: editItem.isExpressDelivery || false,
          isSameLocationCharge: editItem.isSameLocationCharge || false,
          isDeleted: editItem.isDeleted,
        });
        // Check if groupId exists in the list
        if (editItem.groupId) {
          const exists = groupIds.some(g => g.groupId === editItem.groupId);
          setShowGroupIdInput(!exists);
        }
      } else {
        setFormData({
          name: "",
          name2: "",
          countries: [],
          remark: "",
          message: "",
          costType: "Percentage",
          costField: "",
          costUnit: "",
          value: "",
          minValue: "",
          maxValue: "",
          groupId: "",
          isExpressDelivery: false,
          isSameLocationCharge: false,
          isDeleted: false,
        });
        setShowGroupIdInput(false);
      }
    }
  }, [isOpen, editItem]);

  // Reset costUnit when costField changes
  useEffect(() => {
    if (formData.costField === "") {
      setFormData((prev) => ({ ...prev, costUnit: "" }));
    } else if (formData.costField === "product" && formData.costUnit === "order amount") {
      setFormData((prev) => ({ ...prev, costUnit: "" }));
    } else if (formData.costField === "delivery" && !["order amount", "cart quantity"].includes(formData.costUnit)) {
      setFormData((prev) => ({ ...prev, costUnit: "" }));
    }
  }, [formData.costField]);

  // Handle input changes for regular inputs and select elements
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Validate the field if it's been touched
    if (touched[name as keyof TouchedFields]) {
      const error = validateField(name as keyof FormData, value);
      setValidationErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleCountryChange = (selectedOption: any) => {
    setFormData((prev) => ({
      ...prev,
      countries: selectedOption
        ? selectedOption.map((option: any) => option.value)
        : [],
    }));
  };

  const validateField = (
    name: keyof FormData,
    value: any
  ): string | undefined => {
    switch (name) {
      case "name":
        return !value || value.trim() === "" ? "Name is required" : undefined;
      case "name2":
        return undefined; // Optional field
      case "costField":
        if (!value) return "Cost Field is required";
        if (value !== "product" && value !== "delivery") {
          return "Cost Field must be either product or delivery";
        }
        return undefined;
      case "costUnit":
        if (!value) return "Cost Unit is required";
        if (formData.costField === "product") {
          if (!["pc", "kg", "moq"].includes(value)) {
            return "Cost Unit must be pc, kg, or moq for product";
          }
        } else if (formData.costField === "delivery") {
          if (!["order amount", "cart quantity"].includes(value)) {
            return "Cost Unit must be order amount or cart quantity for delivery";
          }
        }
        return undefined;
      case "countries":
        return (!value || (Array.isArray(value) && value.length === 0))
          ? "At least one country is required"
          : undefined;
      case "remark":
        return !value || value.trim() === "" ? "Remark is required" : undefined;
      case "costType":
        return !value ? "Cost Type is required" : undefined;
      case "value":
        if (!value || value.trim() === "") return "Value is required";
        const numericValue = parseFloat(String(value));
        return isNaN(numericValue)
          ? "Value must be a valid number"
          : numericValue <= 0
          ? "Value must be greater than 0"
          : undefined;
      case "minValue":
        if (value && value.trim() !== "") {
          const numericMinValue = parseFloat(String(value));
          if (isNaN(numericMinValue)) return "Min Value must be a valid number";
          if (numericMinValue < 0)
            return "Min Value must be greater than or equal to 0";
        }
        return undefined;
      case "maxValue":
        if (value && value.trim() !== "") {
          const numericMaxValue = parseFloat(String(value));
          if (isNaN(numericMaxValue)) return "Max Value must be a valid number";
          if (numericMaxValue < 0)
            return "Max Value must be greater than or equal to 0";
        }
        return undefined;
      default:
        return undefined;
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    // Only validate required fields
    const requiredFields: (keyof FormData)[] = [
      "name",
      "countries",
      "remark",
      "costType",
      "costField",
      "costUnit",
      "value",
    ];

    requiredFields.forEach((fieldName) => {
      const error = validateField(fieldName, formData[fieldName]);
      if (error) {
        errors[fieldName] = error;
        isValid = false;
      }
    });

    // Validate min/max values
    const minError = validateField("minValue", formData.minValue);
    if (minError) {
      errors.minValue = minError;
      isValid = false;
    }

    const maxError = validateField("maxValue", formData.maxValue);
    if (maxError) {
      errors.maxValue = maxError;
      isValid = false;
    }

    // Additional validation: minValue should be less than maxValue if both are provided
    if (
      formData.minValue &&
      formData.maxValue &&
      formData.minValue.trim() !== "" &&
      formData.maxValue.trim() !== ""
    ) {
      const numericMinValue = parseFloat(String(formData.minValue));
      const numericMaxValue = parseFloat(String(formData.maxValue));
      if (
        !isNaN(numericMinValue) &&
        !isNaN(numericMaxValue) &&
        numericMinValue >= numericMaxValue
      ) {
        errors.maxValue = "Max Value must be greater than Min Value";
        isValid = false;
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const error = validateField(
      name as keyof FormData,
      formData[name as keyof FormData]
    );
    setValidationErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      name: true,
      name2: true,
      countries: true,
      remark: true,
      message: true,
      costType: true,
      costField: true,
      costUnit: true,
      value: true,
      minValue: true,
      maxValue: true,
      groupId: true,
      isExpressDelivery: true,
      isSameLocationCharge: true,
      isDeleted: true,
    });

    const isValid = validateForm();
    if (!isValid) {
      toastHelper.error("Please fill all required fields");
      return;
    }
    setIsSubmitting(true);
    const newItem: CostModule = {
      name: formData.name,
      name2: formData.name2 || undefined,
      countries: formData.countries,
      remark: formData.remark,
      ...(formData.message && { message: formData.message }),
      costType: formData.costType,
      costField: formData.costField as "product" | "delivery",
      costUnit: formData.costUnit as "pc" | "kg" | "moq" | "order amount" | "cart quantity" | undefined,
      value: parseFloat(formData.value) || 0,
      minValue: formData.minValue ? parseFloat(formData.minValue) : undefined,
      maxValue: formData.maxValue ? parseFloat(formData.maxValue) : undefined,
      groupId: formData.groupId.trim() || undefined,
      isExpressDelivery: formData.isExpressDelivery,
      isSameLocationCharge: formData.isSameLocationCharge,
      isDeleted: formData.isDeleted,
    };
    try {
      await onSave(newItem);
      toastHelper.showTost("Cost module saved successfully!", "success");
    } catch (error) {
      console.error("Error saving cost module:", error);
      toastHelper.error("Failed to save cost module");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const title = editItem ? "Edit Cost Module" : "Create Cost Module";

  // Prepare country options
  const countryOptions = countriesList.map((country) => ({
    value: country,
    label: country,
  }));

  const selectedCountries = countryOptions.filter((option) =>
    formData.countries.includes(option.value)
  );

  const customStyles = {
    control: (defaultStyles: any, state: any) => ({
      ...defaultStyles,
      display: "flex",
      alignItems: "center",
      height: "42px",
      minHeight: "42px",
      maxHeight: "42px",
      padding: "0px 12px",
      backgroundColor: state.isDisabled
        ? "#f9fafb"
        : state.isFocused
        ? "#ffffff"
        : "#f9fafb", // gray-50 background (matches bg-gray-50)
      border: state.isFocused
        ? "2px solid #3b82f6" // blue-500 on focus
        : "1px solid #e5e7eb", // gray-200 default
      borderRadius: "0.5rem", // rounded-lg
      boxShadow: state.isFocused ? "0 0 0 1px #3b82f6" : "none",
      transition: "all 0.2s ease",
      cursor: "pointer",
      "&:hover": {
        borderColor: state.isFocused ? "#3b82f6" : "#d1d5db",
      },
    }),
    placeholder: (defaultStyles: any) => ({
      ...defaultStyles,
      textAlign: "left",
      color: "#6b7280", // gray-500 placeholder
    }),
    singleValue: (defaultStyles: any) => ({
      ...defaultStyles,
      textAlign: "left",
      color: "#1f2937", // gray-800 text
      margin: "0px",
      lineHeight: "1.5",
    }),
    input: (defaultStyles: any) => ({
      ...defaultStyles,
      textAlign: "left",
      color: "#1f2937", // gray-800
      margin: "0px",
      padding: "0px",
    }),
    valueContainer: (defaultStyles: any) => ({
      ...defaultStyles,
      padding: "0px",
      height: "100%",
      display: "flex",
      alignItems: "center",
    }),
    indicatorsContainer: (defaultStyles: any) => ({
      ...defaultStyles,
      height: "100%",
      display: "flex",
      alignItems: "center",
    }),
    menu: (defaultStyles: any) => ({
      ...defaultStyles,
      borderRadius: "0.5rem",
      marginTop: "4px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      zIndex: 20,
      overflow: "hidden",
    }),
    menuList: (defaultStyles: any) => ({
      ...defaultStyles,
      maxHeight: "200px", // Set a reasonable max height
      paddingBottom: "8px", // Add padding to bottom to ensure last item is fully visible
    }),
    option: (defaultStyles: any, state: any) => ({
      ...defaultStyles,
      textAlign: "left",
      backgroundColor: state.isSelected
        ? "#3b82f6"
        : state.isFocused
        ? "#e6f0ff"
        : "white",
      color: state.isSelected ? "white" : "#1f2937",
      cursor: "pointer",
      padding: "10px 12px",
      marginBottom: "2px", // Add small margin between options
    }),
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-[800px] max-h-[80vh] transform transition-all duration-300 scale-100 flex flex-col">
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
            id="cost-module-form"
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                onBlur={handleBlur}
                className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                  touched.name && validationErrors.name
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 dark:border-gray-700"
                }`}
                placeholder="Enter cost name"
                required
                disabled={isSubmitting}
              />
              {touched.name && validationErrors.name && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.name}
                </p>
              )}
            </div>

            {/* Name2 Field */}
            <div>
              <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                Name2
              </label>
              <input
                type="text"
                name="name2"
                value={formData.name2}
                onChange={handleInputChange}
                onBlur={handleBlur}
                className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                  touched.name2 && validationErrors.name2
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 dark:border-gray-700"
                }`}
                placeholder="Enter name2 (optional)"
                disabled={isSubmitting}
              />
              {touched.name2 && validationErrors.name2 && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.name2}
                </p>
              )}
            </div>

            {/* Cost Field, Cost Type Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Cost Field <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="costField"
                    value={formData.costField}
                    onChange={(e) => {
                      const value = e.target.value as "product" | "delivery" | "";
                      setFormData((prev) => ({ ...prev, costField: value, costUnit: "" }));
                      if (touched.costField) {
                        const error = validateField("costField", value);
                        setValidationErrors((prev) => ({ ...prev, costField: error }));
                      }
                    }}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.costField && validationErrors.costField
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select Cost Field</option>
                    <option value="product">Product</option>
                    <option value="delivery">Delivery</option>
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.costField && validationErrors.costField && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.costField}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Cost Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="costType"
                    value={formData.costType}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.costType && validationErrors.costType
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed">Fixed</option>
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.costType && validationErrors.costType && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.costType}
                  </p>
                )}
              </div>
            </div>

            {/* Cost Unit Field */}
            {formData.costField && (
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Cost Unit <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="costUnit"
                    value={formData.costUnit}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.costUnit && validationErrors.costUnit
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                    disabled={isSubmitting || !formData.costField}
                  >
                    <option value="">Select Cost Unit</option>
                    {getCostUnitOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.costUnit && validationErrors.costUnit && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.costUnit}
                  </p>
                )}
              </div>
            )}

            {/* Countries Field */}
            <div>
              <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                Countries <span className="text-red-500">*</span>
              </label>
              <div className="w-full">
                <Select
                  isMulti
                  options={countryOptions}
                  value={selectedCountries}
                  onChange={handleCountryChange}
                  placeholder="Select countries"
                  isDisabled={isSubmitting}
                  styles={customStyles}
                  isClearable
                  isSearchable
                  classNamePrefix="react-select"
                />
              </div>
              {touched.countries && validationErrors.countries && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.countries}
                </p>
              )}
            </div>

            {/* Remark */}
            <div>
              <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                Remark
              </label>
              <textarea
                name="remark"
                value={formData.remark}
                onChange={handleInputChange}
                onBlur={handleBlur}
                className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                  touched.remark && validationErrors.remark
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 dark:border-gray-700"
                }`}
                placeholder="Enter Remark"
                rows={4}
                required
                disabled={isSubmitting}
              />
              {touched.remark && validationErrors.remark && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.remark}
                </p>
              )}
            </div>

            {/* Message Field */}
            <div>
              <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                Message
                <span className="text-gray-500 text-xs ml-1">(Optional)</span>
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                onBlur={handleBlur}
                className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                  touched.message && validationErrors.message
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-200 dark:border-gray-700"
                }`}
                placeholder="Enter message"
                rows={4}
                disabled={isSubmitting}
              />
              {touched.message && validationErrors.message && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.message}
                </p>
              )}
            </div>

            {/* Group ID Field */}
            <div>
              <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                Group ID
                <span className="text-gray-500 text-xs ml-1">(Optional - Costs with same Group ID will apply together)</span>
              </label>
              {!showGroupIdInput ? (
                <div className="relative">
                  <select
                    name="groupId"
                    value={formData.groupId}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setShowGroupIdInput(true);
                        setFormData(prev => ({ ...prev, groupId: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, groupId: e.target.value }));
                      }
                    }}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.groupId && validationErrors.groupId
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    disabled={isSubmitting}
                  >
                    <option value="">Select Group ID (Optional)</option>
                    <option value="__add_new__">+ Add New</option>
                    {groupIds.map((group, index) => (
                      <option key={index} value={group.groupId}>
                        {group.display}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="groupId"
                    value={formData.groupId}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`flex-1 p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                      touched.groupId && validationErrors.groupId
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    placeholder="Enter Group ID (e.g., 1, SHIPPING_GROUP)"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupIdInput(false);
                      setFormData(prev => ({ ...prev, groupId: '' }));
                    }}
                    className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-sm"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {touched.groupId && validationErrors.groupId && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.groupId}
                </p>
              )}
            </div>

            {/* Is Express Delivery and Is Same Location Charge Checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isExpressDelivery"
                    checked={formData.isExpressDelivery}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        isExpressDelivery: e.target.checked,
                      }));
                    }}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm font-medium text-gray-950 dark:text-gray-200">
                    Is Express Delivery
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-8">
                  Check this if this cost applies to express delivery orders
                </p>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isSameLocationCharge"
                    checked={formData.isSameLocationCharge}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        isSameLocationCharge: e.target.checked,
                      }));
                    }}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm font-medium text-gray-950 dark:text-gray-200">
                    Is Same Location Charge
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-8">
                  Check this if this cost applies to same location delivery
                </p>
              </div>
            </div>

            {/* Value, Min Value, Max Value */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Value
                </label>
                <input
                  type="number"
                  name="value"
                  value={formData.value}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.value && validationErrors.value
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  placeholder="Enter Value"
                  required
                  step="0.01"
                  disabled={isSubmitting}
                />
                {touched.value && validationErrors.value && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.value}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Min Value
                </label>
                <input
                  type="number"
                  name="minValue"
                  value={formData.minValue}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.minValue && validationErrors.minValue
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  placeholder="Enter Min Value"
                  step="0.01"
                  disabled={isSubmitting}
                />
                {touched.minValue && validationErrors.minValue && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.minValue}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Max Value
                </label>
                <input
                  type="number"
                  name="maxValue"
                  value={formData.maxValue}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.maxValue && validationErrors.maxValue
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  placeholder="Enter Max Value"
                  step="0.01"
                  disabled={isSubmitting}
                />
                {touched.maxValue && validationErrors.maxValue && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.maxValue}
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
              form="cost-module-form"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 
           0 5.373 0 12h4zm2 5.291A7.962 
           7.962 0 014 12H0c0 3.042 1.135 
           5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : editItem ? (
                "Update Cost Module"
              ) : (
                "Create Cost Module"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostModuleModal;

