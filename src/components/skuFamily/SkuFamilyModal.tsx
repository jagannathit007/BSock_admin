import React, { useState, useEffect } from "react";
import toastHelper from "../../utils/toastHelper";
import { SkuFamily } from "./types";
import { ProductCategoryService } from "../../services/productCategory/productCategory.services";
import { BrandService } from "../../services/brand/brand.services";
import { ConditionCategoryService } from "../../services/conditionCategory/conditionCategory.services";
import SubSkuFamilyModal from "./SubSkuFamilyModal";
import { SkuFamilyService } from "../../services/skuFamily/skuFamily.services";

interface ValidationErrors {
  name?: string;
  brand?: string;
  productcategoriesId?: string;
  conditionCategoryId?: string;
  sequence?: string;
}

interface TouchedFields {
  name: boolean;
  brand: boolean;
  productcategoriesId: boolean;
  conditionCategoryId: boolean;
  sequence: boolean;
}

interface SkuFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => Promise<any>;
  editItem?: SkuFamily;
}

const SkuFamilyModal: React.FC<SkuFamilyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
}) => {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    brand: "",
    productcategoriesId: "",
    conditionCategoryId: "",
    sequence: 1 as number | undefined,
  });
  const [brandText, setBrandText] = useState<string>("");
  const [productCategoryText, setProductCategoryText] = useState<string>("");
  const [conditionCategoryText, setConditionCategoryText] = useState<string>("");
  const [productCategories, setProductCategories] = useState<
    { _id?: string; title: string; code?: string }[]
  >([]);
  const [brands, setBrands] = useState<
    { _id?: string; title: string; code?: string }[]
  >([]);
  const [conditionCategories, setConditionCategories] = useState<
    { _id?: string; title: string; code?: string }[]
  >([]);
  const [productCategoryLoading, setProductCategoryLoading] = useState<boolean>(false);
  const [brandLoading, setBrandLoading] = useState<boolean>(false);
  const [conditionCategoryLoading, setConditionCategoryLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [touched, setTouched] = useState<TouchedFields>({
    name: false,
    brand: false,
    productcategoriesId: false,
    conditionCategoryId: false,
    sequence: false,
  });
  const [subSkuFamilyModalOpen, setSubSkuFamilyModalOpen] = useState<boolean>(false);
  const [createdSkuFamilyId, setCreatedSkuFamilyId] = useState<string | null>(null);

  useEffect(() => {
    const resetStates = () => {
      setApiError("");
      setValidationErrors({});
      setTouched({
        name: false,
        brand: false,
        productcategoriesId: false,
        conditionCategoryId: false,
        sequence: false,
      });
    };

    if (!isOpen) {
      setFormData({
        code: "",
        name: "",
        brand: "",
        productcategoriesId: "",
        conditionCategoryId: "",
        sequence: 1,
      });
      setBrandText("");
      setProductCategoryText("");
      setConditionCategoryText("");
      resetStates();
      return;
    }

    resetStates();

    if (editItem) {
      const productCategoryId = typeof editItem.productcategoriesId === "object"
        ? editItem.productcategoriesId?._id || ""
        : editItem.productcategoriesId || "";
      
      const brandId = typeof editItem.brand === "object"
        ? editItem.brand?._id || ""
        : editItem.brand || "";
      
      const conditionCategoryId = typeof editItem.conditionCategoryId === "object"
        ? editItem.conditionCategoryId?._id || ""
        : editItem.conditionCategoryId || "";
      
      setFormData({
        code: editItem.code || "",
        name: editItem.name || "",
        brand: brandId,
        productcategoriesId: productCategoryId,
        conditionCategoryId: conditionCategoryId,
        sequence: editItem.sequence ?? 1,
      });
      // Set text values for display
      setBrandText(typeof editItem.brand === 'object' ? editItem.brand?.title || "" : "");
      setProductCategoryText(typeof editItem.productcategoriesId === 'object' ? editItem.productcategoriesId?.title || "" : "");
      setConditionCategoryText(typeof editItem.conditionCategoryId === 'object' ? editItem.conditionCategoryId?.title || "" : "");
    } else {
      setFormData({
        code: "",
        name: "",
        brand: "",
        productcategoriesId: "",
        conditionCategoryId: "",
        sequence: 1,
      });
      setBrandText("");
      setProductCategoryText("");
      setConditionCategoryText("");
    }
  }, [isOpen, editItem]);

  // Fetch all dropdown data on mount
  useEffect(() => {
    const fetchProductCategories = async () => {
      try {
        setProductCategoryLoading(true);
        const response = await ProductCategoryService.getProductCategoryList(1, 1000);
        const categoriesList = (response.data.docs || []).filter((cat: { _id?: string; title?: string }) => cat && cat._id && cat.title && typeof cat.title === 'string');
        setProductCategories(categoriesList);
      } catch (error) {
        console.error("Failed to load Product Categories:", error);
      } finally {
        setProductCategoryLoading(false);
      }
    };

    const fetchBrands = async () => {
      try {
        setBrandLoading(true);
        const response = await BrandService.getBrandList(1, 1000);
        const brandsList = (response.data.docs || []).filter((brand: { _id?: string; title?: string }) => brand && brand._id && brand.title && typeof brand.title === 'string');
        setBrands(brandsList);
      } catch (error) {
        console.error("Failed to load Brands:", error);
      } finally {
        setBrandLoading(false);
      }
    };

    const fetchConditionCategories = async () => {
      try {
        setConditionCategoryLoading(true);
        const response = await ConditionCategoryService.getConditionCategoryList(1, 1000);
        const categoriesList = (response.data.docs || []).filter((cat: { _id?: string; title?: string }) => cat && cat._id && cat.title && typeof cat.title === 'string');
        setConditionCategories(categoriesList);
      } catch (error) {
        console.error("Failed to load Condition Categories:", error);
      } finally {
        setConditionCategoryLoading(false);
      }
    };

    fetchProductCategories();
    fetchBrands();
    fetchConditionCategories();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name as keyof TouchedFields]) {
      const error = validateField(name as keyof typeof formData, value);
      setValidationErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  // Helper function to capitalize
  const capitalize = (str: string): string => {
    if (!str) return str;
    return str.trim().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Helper function to generate code for master data
  // Pattern: PREFIX + 2 digits + 1 letter (e.g., BRD00B, CAT00A)
  const generateMasterCode = (prefix: string, existingItems: Array<{ code?: string }>): string => {
    // Filter items with codes matching the prefix pattern
    const prefixPattern = new RegExp(`^${prefix}\\d{2}[A-Z]$`);
    const matchingCodes = existingItems
      .filter(item => item.code && prefixPattern.test(item.code))
      .map(item => item.code!)
      .sort();

    if (matchingCodes.length === 0) {
      // Start with 00A
      return `${prefix}00A`;
    }

    // Get the last code
    const lastCode = matchingCodes[matchingCodes.length - 1];
    
    // Extract number and letter
    const match = lastCode.match(new RegExp(`^${prefix}(\\d{2})([A-Z])$`));
    if (!match) {
      // If pattern doesn't match, start fresh
      return `${prefix}00A`;
    }

    const number = parseInt(match[1], 10);
    const letter = match[2];

    // Increment: if letter is Z, move to next number and reset to A
    let nextNumber = number;
    let nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);

    if (nextLetter > 'Z') {
      nextNumber += 1;
      nextLetter = 'A';
    }

    // Format number with leading zeros (2 digits)
    const formattedNumber = nextNumber.toString().padStart(2, '0');
    
    return `${prefix}${formattedNumber}${nextLetter}`;
  };

  // Helper function to find or create brand
  const findOrCreateBrand = async (title: string): Promise<string> => {
    if (!title || !title.trim()) return "";
    const capitalizedTitle = capitalize(title.trim());
    
    // Check if brand exists
    const existing = brands.find(b => b.title && b.title.toLowerCase() === capitalizedTitle.toLowerCase());
    if (existing && existing._id) {
      return existing._id;
    }
    
    // Generate code for new brand
    const brandCode = generateMasterCode('BRD', brands);
    
    // Create new brand with generated code
    try {
      const response = await BrandService.createBrand({ 
        title: capitalizedTitle,
        code: brandCode
      });
      const newBrandId = response?.data?._id || response?.data?.data?._id;
      if (newBrandId) {
        // Refresh brands list
        const brandResponse = await BrandService.getBrandList(1, 1000);
        const brandsList = (brandResponse.data.docs || []).filter((brand: { _id?: string; title?: string }) => brand && brand._id && brand.title && typeof brand.title === 'string');
        setBrands(brandsList);
        return newBrandId;
      }
      throw new Error("Failed to get brand ID after creation");
    } catch (error) {
      console.error("Error creating brand:", error);
      throw error;
    }
  };

  // Helper function to find or create product category
  const findOrCreateProductCategory = async (title: string): Promise<string> => {
    if (!title || !title.trim()) return "";
    const capitalizedTitle = capitalize(title.trim());
    
    // Check if category exists
    const existing = productCategories.find(c => c.title && c.title.toLowerCase() === capitalizedTitle.toLowerCase());
    if (existing && existing._id) {
      return existing._id;
    }
    
    // Generate code for new product category
    const categoryCode = generateMasterCode('CAT', productCategories);
    
    // Create new category with generated code
    try {
      const response = await ProductCategoryService.createProductCategory({ 
        title: capitalizedTitle,
        code: categoryCode
      });
      const newCategoryId = response?.data?._id || response?.data?.data?._id;
      if (newCategoryId) {
        // Refresh categories list
        const categoryResponse = await ProductCategoryService.getProductCategoryList(1, 1000);
        const categoriesList = (categoryResponse.data.docs || []).filter((cat: { _id?: string; title?: string }) => cat && cat._id && cat.title && typeof cat.title === 'string');
        setProductCategories(categoriesList);
        return newCategoryId;
      }
      throw new Error("Failed to get category ID after creation");
    } catch (error) {
      console.error("Error creating product category:", error);
      throw error;
    }
  };

  // Helper function to find or create condition category
  const findOrCreateConditionCategory = async (title: string): Promise<string> => {
    if (!title || !title.trim()) return "";
    const capitalizedTitle = capitalize(title.trim());
    
    // Check if category exists
    const existing = conditionCategories.find(c => c.title && c.title.toLowerCase() === capitalizedTitle.toLowerCase());
    if (existing && existing._id) {
      return existing._id;
    }
    
    // Generate code for new condition category
    const categoryCode = generateMasterCode('COND', conditionCategories);
    
    // Create new category with generated code
    try {
      const response = await ConditionCategoryService.createConditionCategory({ 
        title: capitalizedTitle,
        code: categoryCode
      });
      const newCategoryId = response?.data?._id || response?.data?.data?._id;
      if (newCategoryId) {
        // Refresh categories list
        const categoryResponse = await ConditionCategoryService.getConditionCategoryList(1, 1000);
        const categoriesList = (categoryResponse.data.docs || []).filter((cat: { _id?: string; title?: string }) => cat && cat._id && cat.title && typeof cat.title === 'string');
        setConditionCategories(categoriesList);
        return newCategoryId;
      }
      throw new Error("Failed to get condition category ID after creation");
    } catch (error) {
      console.error("Error creating condition category:", error);
      throw error;
    }
  };

  const validateField = (
    name: keyof typeof formData,
    value: string | number | undefined
  ): string | undefined => {
    switch (name) {
      case "name":
        return !value || (typeof value === 'string' && value.trim() === "") ? "Name is required" : undefined;
      case "brand":
        return !value || (typeof value === 'string' && value.trim() === "") ? "Brand is required" : undefined;
      default:
        return undefined;
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    const requiredFields: (keyof typeof formData)[] = [
      "name",
      "brand",
    ];

    requiredFields.forEach((fieldName) => {
      const fieldValue = formData[fieldName];
      const error = validateField(fieldName, typeof fieldValue === 'string' ? fieldValue : undefined);
      if (error && (fieldName === 'name' || fieldName === 'brand')) {
        errors[fieldName as keyof ValidationErrors] = error;
        isValid = false;
      }
    });

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

    const fieldName = name as keyof typeof formData;
    const fieldValue = formData[fieldName];
    const error = validateField(fieldName, typeof fieldValue === 'string' ? fieldValue : undefined);
    if (name === 'name' || name === 'code' || name === 'brand') {
      setValidationErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setTouched({
      name: true,
      brand: true,
      productcategoriesId: true,
      conditionCategoryId: true,
      sequence: true,
    });

    const isValid = validateForm();
    if (!isValid) {
      setApiError("Please fill all required fields");
      toastHelper.error("Please fill all required fields");
      return;
    }

    setIsLoading(true);
    setApiError("");

    try {
      // Find or create brand, product category, and condition category
      let brandId = formData.brand;
      let productCategoryId = formData.productcategoriesId;
      let conditionCategoryId = formData.conditionCategoryId;

      if (brandText && brandText.trim()) {
        brandId = await findOrCreateBrand(brandText);
      }
      if (productCategoryText && productCategoryText.trim()) {
        productCategoryId = await findOrCreateProductCategory(productCategoryText);
      }
      if (conditionCategoryText && conditionCategoryText.trim()) {
        conditionCategoryId = await findOrCreateConditionCategory(conditionCategoryText);
      }

      const formDataToSend = new FormData();
      if (editItem?._id) {
        formDataToSend.append("id", editItem._id);
        // Only send code in edit mode (to preserve existing code)
        if (formData.code) {
          formDataToSend.append("code", formData.code.trim());
        }
      }
      // Code will be auto-generated by backend for new records
      // Capitalize name before sending
      formDataToSend.append("name", capitalize(formData.name.trim()));
      if (brandId) {
        formDataToSend.append("brand", brandId);
      }
      if (productCategoryId) {
        formDataToSend.append("productcategoriesId", productCategoryId);
      }
      if (conditionCategoryId) {
        formDataToSend.append("conditionCategoryId", conditionCategoryId);
      }
      formDataToSend.append("sequence", formData.sequence?.toString() || "1");

      const response = await onSave(formDataToSend);
      
      // If this is a new SKU Family and we got the created ID, open sub SKU Family modal
      // Response structure: { data: { _id: ... } } or { data: { data: { _id: ... } } }
      const createdId = response?.data?._id || response?.data?.data?._id;
      if (!editItem && createdId) {
        setCreatedSkuFamilyId(createdId);
        setSubSkuFamilyModalOpen(true);
        // Don't close the modal yet - let user add sub SKU family
      } else {
        onClose();
      }
    } catch (error) {
      const errorMessage =
        (error as Error).message || "Failed to save SKU family";
      setApiError(errorMessage);
      toastHelper.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const title = editItem ? "Edit SKU Family" : "Create SKU Family";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] transform transition-all duration-300 scale-100 flex flex-col">
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 pb-4 border-b border-gray-200 dark:border-gray-700 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                {title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {editItem ? "Update SKU Family information" : "Fill in the details to create a new SKU Family"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-transform duration-200 hover:scale-110 p-2"
              disabled={isLoading}
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
            id="sku-family-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Basic Information Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-info-circle text-blue-600"></i>
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editItem && formData.code && (
                  <div>
                    <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                      Code
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      className="w-full p-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 text-sm cursor-not-allowed"
                      disabled
                      readOnly
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Code is auto-generated and cannot be changed
                    </p>
                  </div>
                )}
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
                    className={`w-full p-2.5 bg-white dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                      touched.name && validationErrors.name
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    placeholder="Enter Name"
                    required
                    disabled={isLoading}
                  />
                  {touched.name && validationErrors.name && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {validationErrors.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Category & Brand Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-tags text-blue-600"></i>
                Categories & Brand
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="brands-list"
                      value={brandText}
                      onChange={(e) => {
                        setBrandText(e.target.value);
                        setTouched((prev) => ({ ...prev, brand: true }));
                        // Clear brand ID when text changes
                        setFormData(prev => ({ ...prev, brand: "" }));
                      }}
                      onBlur={async () => {
                        setTouched((prev) => ({ ...prev, brand: true }));
                        if (brandText && brandText.trim()) {
                          try {
                            const brandId = await findOrCreateBrand(brandText);
                            setFormData(prev => ({ ...prev, brand: brandId }));
                            setValidationErrors((prev) => ({ ...prev, brand: undefined }));
                          } catch (error) {
                            setValidationErrors((prev) => ({ ...prev, brand: "Failed to create brand" }));
                          }
                        }
                      }}
                      className={`w-full p-2.5 bg-white dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                        touched.brand && validationErrors.brand
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                      placeholder="Type brand name (will create if new)"
                      disabled={isLoading || brandLoading}
                    />
                    <datalist id="brands-list">
                      {brands
                        .filter(brand => brand && brand.title)
                        .map((brand, index) => (
                          <option key={brand._id || index} value={brand.title} />
                        ))}
                    </datalist>
                  </div>
                  {touched.brand && validationErrors.brand && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {validationErrors.brand}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Type to search or create new brand
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Product Category
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="product-categories-list"
                      value={productCategoryText}
                      onChange={(e) => {
                        setProductCategoryText(e.target.value);
                        setTouched((prev) => ({ ...prev, productcategoriesId: true }));
                        // Clear category ID when text changes
                        setFormData(prev => ({ ...prev, productcategoriesId: "" }));
                      }}
                      onBlur={async () => {
                        setTouched((prev) => ({ ...prev, productcategoriesId: true }));
                        if (productCategoryText && productCategoryText.trim()) {
                          try {
                            const categoryId = await findOrCreateProductCategory(productCategoryText);
                            setFormData(prev => ({ ...prev, productcategoriesId: categoryId }));
                          } catch (error) {
                            console.error("Error creating product category:", error);
                          }
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                      placeholder="Type category name (will create if new)"
                      disabled={isLoading || productCategoryLoading}
                    />
                    <datalist id="product-categories-list">
                      {productCategories
                        .filter(cat => cat && cat.title)
                        .map((cat, index) => (
                          <option key={cat._id || index} value={cat.title} />
                        ))}
                    </datalist>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Type to search or create new category
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Condition Category
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="condition-categories-list"
                      value={conditionCategoryText}
                      onChange={(e) => {
                        setConditionCategoryText(e.target.value);
                        setTouched((prev) => ({ ...prev, conditionCategoryId: true }));
                        // Clear category ID when text changes
                        setFormData(prev => ({ ...prev, conditionCategoryId: "" }));
                      }}
                      onBlur={async () => {
                        setTouched((prev) => ({ ...prev, conditionCategoryId: true }));
                        if (conditionCategoryText && conditionCategoryText.trim()) {
                          try {
                            const categoryId = await findOrCreateConditionCategory(conditionCategoryText);
                            setFormData(prev => ({ ...prev, conditionCategoryId: categoryId }));
                          } catch (error) {
                            console.error("Error creating condition category:", error);
                          }
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                      placeholder="Type category name (will create if new)"
                      disabled={isLoading || conditionCategoryLoading}
                    />
                    <datalist id="condition-categories-list">
                      {conditionCategories
                        .filter(cat => cat && cat.title)
                        .map((cat, index) => (
                          <option key={cat._id || index} value={cat.title} />
                        ))}
                    </datalist>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Type to search or create new category
                  </p>
                </div>
              </div>
            </div>

            {/* Sequence Section */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-sort-numeric-down text-blue-600"></i>
                Display Order
              </h3>
              <div className="max-w-xs">
                <input
                  type="number"
                  name="sequence"
                  value={formData.sequence || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, sequence: value === '' ? undefined : parseInt(value) || 1 });
                  }}
                  min="1"
                  className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                  placeholder="Enter sequence number"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <i className="fas fa-info-circle"></i>
                  Lower numbers appear first in lists. Leave empty for auto-assignment.
                </p>
              </div>
            </div>

            {apiError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  {apiError}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 text-sm font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sku-family-form"
              className="min-w-[160px] px-6 py-2.5 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
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
                  <span>Saving...</span>
                </>
              ) : editItem ? (
                <>
                  <i className="fas fa-save"></i>
                  <span>Update SKU Family</span>
                </>
              ) : (
                <>
                  <i className="fas fa-plus"></i>
                  <span>Create SKU Family</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {subSkuFamilyModalOpen && createdSkuFamilyId && (
        <SubSkuFamilyModal
          isOpen={subSkuFamilyModalOpen}
          onClose={() => {
            setSubSkuFamilyModalOpen(false);
            setCreatedSkuFamilyId(null);
            onClose(); // Close the main modal after sub SKU family modal closes
          }}
          onSave={async (formData: FormData) => {
            try {
              await SkuFamilyService.addSubSkuFamily(createdSkuFamilyId, formData);
              setSubSkuFamilyModalOpen(false);
              setCreatedSkuFamilyId(null);
              onClose(); // Close the main modal after successful save
            } catch (error) {
              throw error;
            }
          }}
          skuFamilyId={createdSkuFamilyId}
        />
      )}
    </div>
  );
};

export default SkuFamilyModal;
