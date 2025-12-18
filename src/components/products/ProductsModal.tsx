import React, { useState, useEffect } from "react";
import {
  ProductService,
  Product,
} from "../../services/product/product.services";
import { GradeService } from "../../services/grade/grade.services";
import { CostModuleService } from "../../services/costModule/costModule.services";
import { SellerService } from "../../services/seller/sellerService";
import { ConstantsService, Constants } from "../../services/constants/constants.services";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from 'react-select';
import MarginSelectionModal, { MarginSelection } from './MarginSelectionModal';
import CostModuleSelectionModal, { SelectedCost } from './CostModuleSelectionModal';
import ProductPreviewModal from './ProductPreviewModal';
import { ProductCalculationResult } from '../../utils/priceCalculation';
import toastHelper from '../../utils/toastHelper';

interface CountryDeliverable {
  country: string;
  currency: 'USD' | 'HKD' | 'AED';
  basePrice: number | string;
  calculatedPrice?: number | string;
  exchangeRate?: number | string;
  paymentTerm?: string[] | null;
  paymentMethod?: string[] | null;
  // Legacy fields for backward compatibility
  usd?: number | string;
  xe?: number | string;
  local?: number | string;
  hkd?: number | string;
  aed?: number | string;
  charges: Array<{
    name: string;
    value: number | string;
  }>;
}

interface FormData {
  skuFamilyId: string;
  gradeId: string;
  sellerId: string;
  simType: string;
  color: string;
  ram: string;
  storage: string;
  weight: number | string;
  stock: number | string;
  country: string | null;
  moq: number | string;
  purchaseType: string; // 'full' | 'partial'
  isNegotiable: boolean;
  isFlashDeal: string;
  startTime: string; // ISO string (e.g., "2025-10-30T03:30:00.000Z")
  expiryTime: string; // ISO string (e.g., "2025-10-30T03:30:00.000Z")
  groupCode: string;
  countryDeliverables: CountryDeliverable[];
  paymentTerm?: string[];
  paymentMethod?: string[];
}

interface ValidationErrors {
  skuFamilyId?: string;
  gradeId?: string;
  sellerId?: string;
  simType?: string;
  color?: string;
  ram?: string;
  storage?: string;
  weight?: string;
  condition?: string;
  stock?: string;
  country?: string;
  moq?: string;
  purchaseType?: string;
  startTime?: string;
  expiryTime?: string;
  isNegotiable?: string;
  isFlashDeal?: string;
  countryDeliverables?: string;
  [key: string]: string | undefined;
}

interface TouchedFields {
  skuFamilyId: boolean;
  simType: boolean;
  color: boolean;
  ram: boolean;
  storage: boolean;
  weight: boolean;
  price: boolean;
  stock: boolean;
  country: boolean;
  moq: boolean;
  purchaseType: boolean;
  startTime: boolean;
  expiryTime: boolean;
  isNegotiable: boolean;
  isFlashDeal: boolean;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: FormData) => void;
  editItem?: Product;
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
}) => {
  const [formData, setFormData] = useState<FormData>({
    skuFamilyId: "",
    gradeId: "",
    sellerId: "",
    simType: "",
    color: "",
    ram: "",
    storage: "",
    weight: "",
    stock: 0,
    country: "",
    moq: 0,
    purchaseType: "partial",
    isNegotiable: false,
    isFlashDeal: "false",
    startTime: "",
    expiryTime: "",
    groupCode: "",
    countryDeliverables: [],
    paymentTerm: [],
    paymentMethod: [],
  });
  const [costsByCountry, setCostsByCountry] = useState<Record<string, Array<{ _id: string; name: string; costType: string; value: number }>>>({});
  const [skuFamilies, setSkuFamilies] = useState<
    { 
      _id: string; 
      name: string;
      brand?: { _id: string; title: string };
      subModel?: string;
      storageId?: { _id: string; title: string };
      ramId?: { _id: string; title: string };
      colorId?: { _id: string; title: string };
      images?: string[];
    }[]
  >([]);
  const [grades, setGrades] = useState<
    { _id?: string; title: string; brand?: string | { _id?: string; title: string; code?: string } }[]
  >([]);
  const [sellers, setSellers] = useState<
    { _id?: string; name: string; code?: string }[]
  >([]);
  const [skuLoading, setSkuLoading] = useState<boolean>(false);
  const [gradeLoading, setGradeLoading] = useState<boolean>(false);
  const [sellerLoading, setSellerLoading] = useState<boolean>(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [moqError, setMoqError] = useState<string | null>(null);
  const [constants, setConstants] = useState<Constants | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  
  // Margin/Cost/Preview flow state (for edit mode)
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [marginSelection, setMarginSelection] = useState<MarginSelection | null>(null);
  const [selectedCosts, setSelectedCosts] = useState<{ Hongkong: SelectedCost[]; Dubai: SelectedCost[] }>({
    Hongkong: [],
    Dubai: [],
  });
  const [currentCostCountry, setCurrentCostCountry] = useState<'Hongkong' | 'Dubai' | null>(null);
  const [calculationResults, setCalculationResults] = useState<ProductCalculationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  
  const [touched, setTouched] = useState<TouchedFields>({
    skuFamilyId: false,
    simType: false,
    color: false,
    ram: false,
    storage: false,
    weight: false,
    price: false,
    stock: false,
    country: false,
    moq: false,
    purchaseType: false,
    startTime: false,
    expiryTime: false,
    isNegotiable: false,
    isFlashDeal: false,
  });

  const colorOptions = ["Graphite", "Silver", "Gold", "Sierra Blue", "Mixed"];
  const countryOptions = ["Hongkong", "Dubai"];
  const simOptions = ["E-Sim", "Physical Sim"];

  // Fetch costs by country and constants when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCostsByCountry();
      fetchConstants();
    }
  }, [isOpen]);

  const fetchConstants = async () => {
    try {
      const constantsData = await ConstantsService.getConstants();
      setConstants(constantsData);
    } catch (error) {
      console.error("Failed to fetch constants:", error);
    }
  };

  const fetchCostsByCountry = async () => {
    try {
      const response = await CostModuleService.getCostsByCountry();
      if (response.status === 200 && response.data) {
        setCostsByCountry(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch costs:", error);
    }
  };
  const ramOptions = ["4GB", "6GB", "8GB", "16GB", "32GB"];
  const storageOptions = ["128GB", "256GB", "512GB", "1TB"];

  // Function to extract data from SKU Family
  const extractSkuFamilyData = (skuFamily: any) => {
    try {
      return {
        color: skuFamily.colorId?.title || '',
        storage: skuFamily.storageId?.title || '',
        ram: skuFamily.ramId?.title || '',
        subModel: skuFamily.subModel || '',
      };
    } catch (error) {
      console.error('Error extracting SKU Family data:', error);
      return null;
    }
  };

  // Handle SKU Family selection for react-select
  const handleSkuFamilyChange = (selectedOption: any) => {
    const value = selectedOption?.value || '';
    setFormData(prev => {
      const next = { ...prev, skuFamilyId: value } as FormData;
      
      // Extract data from selected SKU Family
      if (value && selectedOption?.data) {
        const skuData = extractSkuFamilyData(selectedOption.data);
        if (skuData) {
          if (skuData.color) next.color = skuData.color;
          if (skuData.storage) next.storage = skuData.storage;
          if (skuData.ram) next.ram = skuData.ram;
        }
      } else {
        // Clear fields when SKU Family is cleared
        next.color = "";
        next.storage = "";
        next.ram = "";
      }
      
      return next;
    });
    
    // Validate
    if (touched.skuFamilyId) {
      const error = validateField("skuFamilyId", value);
      setValidationErrors(prev => ({ ...prev, skuFamilyId: error }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      const fetchSkuFamilies = async () => {
        try {
          setSkuLoading(true);
          setSkuError(null);
          const list = await ProductService.getSkuFamilyListByName();
          setSkuFamilies(list);
        } catch (error: any) {
          setSkuError(error.message || "Failed to load SKU Families");
        } finally {
          setSkuLoading(false);
        }
      };

      const fetchGrades = async () => {
        try {
          setGradeLoading(true);
          const response = await GradeService.getGradeList(1, 1000);
          const gradesList = (response.data.docs || []).filter((grade: any) => grade && grade._id && grade.title && typeof grade.title === 'string');
          setGrades(gradesList);
        } catch (error: any) {
          console.error("Failed to load Grades:", error);
        } finally {
          setGradeLoading(false);
        }
      };

      const fetchSellers = async () => {
        try {
          setSellerLoading(true);
          const sellersList = await SellerService.getAllSellers();
          const filteredSellers = sellersList.filter((seller: any) => seller && seller._id && seller.name && typeof seller.name === 'string');
          setSellers(filteredSellers);
        } catch (error: any) {
          console.error("Failed to load Sellers:", error);
        } finally {
          setSellerLoading(false);
        }
      };

      fetchSkuFamilies();
      fetchGrades();
      fetchSellers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        const skuId =
          typeof editItem.skuFamilyId === "object"
            ? editItem.skuFamilyId._id || ""
            : editItem.skuFamilyId || "";
        const gradeId =
          typeof (editItem as any).gradeId === "object"
            ? (editItem as any).gradeId?._id || ""
            : (editItem as any).gradeId || "";
        const sellerId =
          typeof (editItem as any).sellerId === "object"
            ? (editItem as any).sellerId?._id || ""
            : (editItem as any).sellerId || "";
        setFormData({
          skuFamilyId: skuId,
          gradeId: gradeId,
          sellerId: sellerId,
          simType: editItem.simType,
          color: editItem.color,
          ram: editItem.ram,
          storage: editItem.storage,
          weight: (editItem as any).weight || "",
          stock: editItem.stock,
          country: editItem.country || null,
          moq: editItem.moq,
          purchaseType: (editItem as any).purchaseType || "partial",
          isNegotiable: editItem.isNegotiable,
          isFlashDeal: `${(editItem as any).isFlashDeal ?? false}`,
          startTime: (editItem as any).startTime || "",
          expiryTime: editItem.expiryTime || "",
          groupCode: (editItem as any).groupCode || "",
          countryDeliverables: ((editItem as any).countryDeliverables || []).map((cd: any) => ({
            ...cd,
            currency: cd.currency || (cd.country === 'Hongkong' ? (cd.hkd ? 'HKD' : 'USD') : (cd.aed ? 'AED' : 'USD')),
            basePrice: cd.basePrice || cd.usd || cd.hkd || cd.aed || 0,
            exchangeRate: cd.exchangeRate || cd.xe || null,
          })),
          paymentTerm: (() => {
            // Check top level first, then fall back to first countryDeliverable for backward compatibility
            if ((editItem as any).paymentTerm) {
              return Array.isArray((editItem as any).paymentTerm) 
                ? (editItem as any).paymentTerm 
                : (typeof (editItem as any).paymentTerm === 'string' ? [(editItem as any).paymentTerm] : []);
            } else if ((editItem as any).countryDeliverables && (editItem as any).countryDeliverables.length > 0 && (editItem as any).countryDeliverables[0].paymentTerm) {
              const cdPaymentTerm = (editItem as any).countryDeliverables[0].paymentTerm;
              return Array.isArray(cdPaymentTerm) ? cdPaymentTerm : (typeof cdPaymentTerm === 'string' ? [cdPaymentTerm] : []);
            }
            return [];
          })(),
          paymentMethod: (() => {
            // Check top level first, then fall back to first countryDeliverable for backward compatibility
            if ((editItem as any).paymentMethod) {
              return Array.isArray((editItem as any).paymentMethod) 
                ? (editItem as any).paymentMethod 
                : (typeof (editItem as any).paymentMethod === 'string' ? [(editItem as any).paymentMethod] : []);
            } else if ((editItem as any).countryDeliverables && (editItem as any).countryDeliverables.length > 0 && (editItem as any).countryDeliverables[0].paymentMethod) {
              const cdPaymentMethod = (editItem as any).countryDeliverables[0].paymentMethod;
              return Array.isArray(cdPaymentMethod) ? cdPaymentMethod : (typeof cdPaymentMethod === 'string' ? [cdPaymentMethod] : []);
            }
            return [];
          })(),
        });
      } else {
        setFormData({
          skuFamilyId: "",
          gradeId: "",
          sellerId: "",
          simType: "",
          color: "",
          ram: "",
          storage: "",
          weight: "",
          stock: 0,
          country: "",
          moq: 0,
    purchaseType: "partial",
    isNegotiable: false,
    isFlashDeal: "false",
    startTime: "",
    expiryTime: "",
    groupCode: "",
    countryDeliverables: [],
    paymentTerm: [],
    paymentMethod: [],
  });
      }
      setDateError(null);
    }
  }, [isOpen, editItem]);

  // Handlers for countryDeliverables
  const addCountryDeliverable = () => {
    setFormData(prev => ({
      ...prev,
      countryDeliverables: [
        ...prev.countryDeliverables,
        { country: "", currency: "USD" as const, basePrice: 0, charges: [] }
      ]
    }));
  };

  const removeCountryDeliverable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      countryDeliverables: prev.countryDeliverables.filter((_, i) => i !== index)
    }));
  };

  const updateCountryDeliverable = (index: number, field: keyof CountryDeliverable, value: any) => {
    setFormData(prev => ({
      ...prev,
      countryDeliverables: prev.countryDeliverables.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addChargeToCountry = (countryIndex: number) => {
    setFormData(prev => ({
      ...prev,
      countryDeliverables: prev.countryDeliverables.map((item, i) =>
        i === countryIndex
          ? { ...item, charges: [...item.charges, { name: "", value: 0 }] }
          : item
      )
    }));
  };

  const removeChargeFromCountry = (countryIndex: number, chargeIndex: number) => {
    setFormData(prev => ({
      ...prev,
      countryDeliverables: prev.countryDeliverables.map((item, i) =>
        i === countryIndex
          ? { ...item, charges: item.charges.filter((_, ci) => ci !== chargeIndex) }
          : item
      )
    }));
  };

  const updateCharge = (countryIndex: number, chargeIndex: number, field: 'name' | 'value', value: any) => {
    setFormData(prev => ({
      ...prev,
      countryDeliverables: prev.countryDeliverables.map((item, i) =>
        i === countryIndex
          ? {
              ...item,
              charges: item.charges.map((charge, ci) =>
                ci === chargeIndex ? { ...charge, [field]: value } : charge
              )
            }
          : item
      )
    }));
  };

  const addChargeFromCostModule = (countryIndex: number, costId: string) => {
    const country = formData.countryDeliverables[countryIndex]?.country;
    if (!country || !costsByCountry[country]) return;

    const cost = costsByCountry[country].find(c => c._id === costId);
    if (!cost) return;

    // Check if charge already exists
    const existingCharge = formData.countryDeliverables[countryIndex].charges.find(
      c => c.name === cost.name
    );
    if (existingCharge) return;

    setFormData(prev => ({
      ...prev,
      countryDeliverables: prev.countryDeliverables.map((item, i) =>
        i === countryIndex
          ? { ...item, charges: [...item.charges, { name: cost.name, value: cost.value }] }
          : item
      )
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((previous) => {
      let updatedValue: any;
      if (type === "checkbox") {
        const checked = (e.target as HTMLInputElement).checked;
        updatedValue =
          name === "isFlashDeal" ? (checked ? "true" : "false") : checked;
      } else if (type === "number") {
        updatedValue = parseFloat(value) || 0;
      } else {
        updatedValue = value;
      }

      let next = { ...previous, [name]: updatedValue } as FormData;

      if (name === "isFlashDeal" && updatedValue === "false") {
        next.expiryTime = "";
        setDateError(null);
      }

      if (name === "purchaseType" && updatedValue === "full") {
        next.moq = Number(previous.stock) || 0;
      }

      if (name === "stock" && previous.purchaseType === "full") {
        next.moq =
          typeof updatedValue === "number"
            ? updatedValue
            : parseFloat(String(updatedValue)) || 0;
      }

      const purchaseType = String(
        name === "purchaseType" ? updatedValue : previous.purchaseType
      );
      if (purchaseType === "partial") {
        setMoqError(null);
      } else {
        setMoqError(null);
      }

      return next;
    });

    if (touched[name as keyof TouchedFields]) {
      const error = validateField(name as keyof FormData, value);
      setValidationErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleStartTimeChange = (date: Date | null) => {
    if (date && !isNaN(date.getTime())) {
      setFormData((prev) => ({
        ...prev,
        startTime: date.toISOString(),
      }));
      setDateError(null);

      if (touched.startTime) {
        const error = validateField("startTime", date.toISOString());
        setValidationErrors((prev) => ({ ...prev, startTime: error }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        startTime: "",
      }));

      if (touched.startTime) {
        const error = validateField("startTime", "");
        setValidationErrors((prev) => ({ ...prev, startTime: error }));
      }
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date && date > new Date() && !isNaN(date.getTime())) {
      setFormData((prev) => ({
        ...prev,
        expiryTime: date.toISOString(),
      }));
      setDateError(null);

      if (touched.expiryTime) {
        const error = validateField("expiryTime", date.toISOString());
        setValidationErrors((prev) => ({ ...prev, expiryTime: error }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        expiryTime: "",
      }));
      setDateError("Please select a valid future date and time");

      if (touched.expiryTime) {
        const error = validateField("expiryTime", "");
        setValidationErrors((prev) => ({ ...prev, expiryTime: error }));
      }
    }
  };

  const handleNumericChange = (
    name: "stock" | "moq",
    e: React.ChangeEvent<HTMLInputElement>,
    allowDecimal: boolean
  ) => {
    let value = e.target.value;

    if (allowDecimal) {
      value = value.replace(/[^0-9.]/g, "");
      const parts = value.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("").replace(/\./g, "");
      }
    } else {
      value = value.replace(/[^0-9]/g, "");
    }

    setFormData((previous) => {
      const next: FormData = { ...previous, [name]: value } as FormData;

      if (name === "stock" && previous.purchaseType === "full") {
        const numeric = value === "" ? 0 : parseFloat(value) || 0;
        next.moq = numeric;
      }

      if (previous.purchaseType === "partial") {
        setMoqError(null);
      } else {
        setMoqError(null);
      }

      return next;
    });
  };

  const validateField = (
    name: keyof FormData,
    value: any
  ): string | undefined => {
    switch (name) {
      case "skuFamilyId":
        return !value ? "SKU Family is required" : undefined;
      case "simType":
        return !value ? "SIM Type is required" : undefined;
      case "color":
        return !value ? "Color is required" : undefined;
      case "ram":
        return !value ? "RAM is required" : undefined;
      case "storage":
        return !value ? "Storage is required" : undefined;
      case "weight":
        if (!value) return undefined; // Weight is optional
        const weightNum = parseFloat(value as string);
        if (isNaN(weightNum) || weightNum < 0) {
          return "Weight must be a valid number >= 0";
        }
        return undefined;
      case "stock":
        if (value === "" || value === null || value === undefined)
          return "Stock is required";
        const numericStock = parseFloat(String(value));
        return isNaN(numericStock)
          ? "Stock must be a valid number"
          : numericStock <= 0
          ? "Stock must be greater than 0"
          : undefined;
      case "country":
        return !value ? "Country is required" : undefined;
      case "moq":
        if (value === "" || value === null || value === undefined)
          return "MOQ is required";
        const numericMoq = parseFloat(String(value));
        return isNaN(numericMoq)
          ? "MOQ must be a valid number"
          : numericMoq <= 0
          ? "MOQ must be greater than 0"
          : undefined;
      case "purchaseType":
        return !value ? "Purchase Type is required" : undefined;
      case "expiryTime":
        return formData.isFlashDeal === "true" && !value
          ? "Expiry time is required for Flash Deals"
          : undefined;
      default:
        return undefined;
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    let isValid = true;

    const requiredFields: (keyof FormData)[] = [
      "skuFamilyId",
      "simType",
      "color",
      "ram",
      "storage",
      "stock",
      "country",
      "moq",
      "purchaseType",
    ];

    // Validate that at least one countryDeliverable has USD base price
    if (!formData.countryDeliverables || formData.countryDeliverables.length === 0) {
      errors.countryDeliverables = "At least one country deliverable is required";
      isValid = false;
    } else {
      // Check for USD base price
      const hasUsdPricing = formData.countryDeliverables.some(cd => {
        if (cd.currency === 'USD') {
          const basePrice = typeof cd.basePrice === 'string' ? parseFloat(cd.basePrice) : cd.basePrice;
          return basePrice && basePrice > 0;
        }
        // Fallback: check legacy usd field
        const usd = typeof cd.usd === 'string' ? parseFloat(cd.usd) : cd.usd;
        return usd && usd > 0;
      });
      if (!hasUsdPricing) {
        errors.countryDeliverables = "At least one country deliverable must have USD base price";
        isValid = false;
      }
      
      // Validate each deliverable has required fields
      formData.countryDeliverables.forEach((cd, index) => {
        if (!cd.country) {
          errors.countryDeliverables = `Country deliverable ${index + 1}: Country is required`;
          isValid = false;
        }
        if (!cd.currency) {
          errors.countryDeliverables = `Country deliverable ${index + 1}: Currency is required`;
          isValid = false;
        }
        const basePrice = typeof cd.basePrice === 'string' ? parseFloat(cd.basePrice) : cd.basePrice;
        if (!basePrice || basePrice <= 0) {
          errors.countryDeliverables = `Country deliverable ${index + 1}: Base price must be greater than 0`;
          isValid = false;
        }
      });
    }

    requiredFields.forEach((fieldName) => {
      const error = validateField(fieldName, formData[fieldName]);
      if (error) {
        (errors as any)[fieldName] = error;
        isValid = false;
      }
    });

    if (formData.isFlashDeal === "true") {
      const error = validateField("expiryTime", formData.expiryTime);
      if (error) {
        errors.expiryTime = error;
        isValid = false;
      }
    }

    const numericStock = parseFloat(String(formData.stock));
    const numericMoq = parseFloat(String(formData.moq));
    if (
      formData.purchaseType === "partial" &&
      !isNaN(numericStock) &&
      !isNaN(numericMoq) &&
      numericMoq >= numericStock
    ) {
      errors.moq = "MOQ must be less than Stock";
      isValid = false;
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const error = validateField(
      name as keyof FormData,
      formData[name as keyof FormData]
    );
    setValidationErrors((prev) => ({ ...prev, [name]: error }));
  };

  // Handle margin selection - opens cost modal
  const handleMarginNext = (selection: MarginSelection) => {
    setMarginSelection(selection);
    setShowMarginModal(false);
    
    if (!pendingFormData) return;
    
    // Check which countries have deliverables
    const hasHKProducts = pendingFormData.countryDeliverables.some(cd => cd.country === 'Hongkong');
    const hasDubai = pendingFormData.countryDeliverables.some(cd => cd.country === 'Dubai');
    
    // Open cost modal for first country
    if (hasHKProducts) {
      setCurrentCostCountry('Hongkong');
      setShowCostModal(true);
    } else if (hasDubai) {
      setCurrentCostCountry('Dubai');
      setShowCostModal(true);
    } else {
      // No country deliverables, proceed to calculation
      proceedToCalculation();
    }
  };

  // Handle cost selection - opens next cost modal or proceeds to calculation
  const handleCostNext = (costs: SelectedCost[]) => {
    if (!currentCostCountry || !pendingFormData) return;
    
    const country = currentCostCountry;
    
    // Update selected costs
    setSelectedCosts(prev => ({
      ...prev,
      [country]: costs,
    }));
    
    setShowCostModal(false);
    
    // Check if we need to open cost modal for other country
    const hasDubai = pendingFormData.countryDeliverables.some(cd => cd.country === 'Dubai');
    
    if (country === 'Hongkong' && hasDubai) {
      // Open Dubai modal
      setCurrentCostCountry('Dubai');
      setShowCostModal(true);
    } else {
      // All countries processed - proceed to calculation
      proceedToCalculation();
    }
  };

  // Calculate prices and show preview
  const proceedToCalculation = async () => {
    if (!pendingFormData || !marginSelection || !editItem) return;
    
    try {
      setIsCalculating(true);
      
      // Fetch SKU Family to get brandCode and productCategoryCode
      const skuFamilyId = typeof pendingFormData.skuFamilyId === 'object' 
        ? (pendingFormData.skuFamilyId as any)._id 
        : pendingFormData.skuFamilyId;
      
      const skuFamily = skuFamilies.find(sf => sf._id === skuFamilyId);
      
      // Get seller code
      const sellerId = pendingFormData.sellerId;
      const seller = sellers.find(s => s._id === sellerId);
      
      // Prepare product data for calculation with all required codes
      const productForCalculation: any = {
        ...pendingFormData,
        _id: editItem._id,
        skuFamilyId: skuFamilyId,
        brandCode: (skuFamily?.brand as any)?.code || '',
        productCategoryCode: ((skuFamily as any)?.productcategoriesId as any)?.code || '',
        conditionCode: ((skuFamily as any)?.conditionCategoryId as any)?.code || '',
        sellerCode: seller?.code || '',
        countryDeliverables: (pendingFormData.countryDeliverables || []).map((cd: any) => ({
          country: cd.country,
          currency: cd.currency || 'USD',
          basePrice: typeof cd.basePrice === 'string' ? parseFloat(cd.basePrice) : (cd.basePrice || 0),
          usd: cd.usd || (cd.currency === 'USD' ? (typeof cd.basePrice === 'string' ? parseFloat(cd.basePrice) : cd.basePrice) : null),
          hkd: cd.hkd || (cd.currency === 'HKD' ? (typeof cd.basePrice === 'string' ? parseFloat(cd.basePrice) : cd.basePrice) : null),
          aed: cd.aed || (cd.currency === 'AED' ? (typeof cd.basePrice === 'string' ? parseFloat(cd.basePrice) : cd.basePrice) : null),
          xe: cd.exchangeRate || cd.xe || null,
        })),
      };
      
      // Prepare selected costs as array of IDs for each country
      const selectedCostsHK = selectedCosts.Hongkong.map(c => c.costId);
      const selectedCostsDubai = selectedCosts.Dubai.map(c => c.costId);
      
      // Call calculation API
      const response = await ProductService.calculateProductPrices(
        [productForCalculation],
        marginSelection,
        {
          Hongkong: selectedCostsHK,
          Dubai: selectedCostsDubai,
        }
      );
      
      if (response.status === 200 && response.data) {
        // Transform response to ProductCalculationResult format
        const results: ProductCalculationResult[] = response.data.map((product: any) => ({
          product: product,
          countryDeliverables: product.countryDeliverables || [],
        }));
        
        setCalculationResults(results);
        setShowPreviewModal(true);
      } else {
        toastHelper.showTost('Failed to calculate prices', 'error');
      }
    } catch (error: any) {
      console.error('Calculation error:', error);
      toastHelper.showTost(error.response?.data?.message || 'Failed to calculate prices', 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle preview submit - final submission
  const handlePreviewSubmit = async () => {
    if (!pendingFormData || !editItem || calculationResults.length === 0) return;
    
    try {
      setIsCalculating(true);
      
      // Get calculated product from results
      const calculatedProduct = calculationResults[0].product;
      
      // Merge calculated data with pending form data
      // Keep all original form fields but update countryDeliverables with calculated prices
      const finalFormData = {
        ...pendingFormData,
        countryDeliverables: calculatedProduct.countryDeliverables || pendingFormData.countryDeliverables,
      };
      
      // Submit the update
      onSave(finalFormData);
      
      // Close modals and reset state
      setShowPreviewModal(false);
      setPendingFormData(null);
      setMarginSelection(null);
      setSelectedCosts({ Hongkong: [], Dubai: [] });
      setCalculationResults([]);
      setCurrentCostCountry(null);
    } catch (error: any) {
      console.error('Submit error:', error);
      toastHelper.showTost(error.response?.data?.message || 'Failed to update product', 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setTouched({
      skuFamilyId: true,
      simType: true,
      color: true,
      ram: true,
      storage: true,
      price: true,
      stock: true,
      country: true,
      moq: true,
      purchaseType: true,
      startTime: true,
      expiryTime: true,
      isNegotiable: true,
      isFlashDeal: true,
      weight: true,
    });

    const isValid = validateForm();
    console.log("Form validation result:", isValid);
    console.log("Current validation errors:", validationErrors);
    console.log("Form data:", formData);

    if (!isValid) {
      console.log("Form validation failed, not submitting");
      return;
    }

    console.log("Form is valid, submitting...");
    
    // Transform countryDeliverables to ensure all required fields are present
    const transformedFormData = {
      ...formData,
      countryDeliverables: (formData.countryDeliverables || []).map((cd: any) => {
        // Ensure currency is set
        let currency = cd.currency;
        if (!currency) {
          if (cd.country === 'Hongkong') {
            currency = cd.hkd ? 'HKD' : 'USD';
          } else if (cd.country === 'Dubai') {
            currency = cd.aed ? 'AED' : 'USD';
          } else {
            currency = 'USD';
          }
        }
        
        // Ensure basePrice is set (can be 0)
        let basePrice = cd.basePrice;
        if (basePrice === undefined || basePrice === null) {
          if (currency === 'USD') {
            basePrice = cd.usd !== undefined && cd.usd !== null ? cd.usd : 0;
          } else if (currency === 'HKD') {
            basePrice = cd.hkd !== undefined && cd.hkd !== null ? cd.hkd : 0;
          } else if (currency === 'AED') {
            basePrice = cd.aed !== undefined && cd.aed !== null ? cd.aed : 0;
          } else {
            basePrice = 0;
          }
        }
        
        // Convert basePrice to number
        const numericBasePrice = typeof basePrice === 'string' ? parseFloat(basePrice) : (basePrice || 0);
        
        // Create a clean countryDeliverable object without paymentTerm and paymentMethod
        const cleanCd: any = {
          country: cd.country,
          currency: currency,
          basePrice: isNaN(numericBasePrice) ? 0 : numericBasePrice,
          calculatedPrice: cd.calculatedPrice ? (typeof cd.calculatedPrice === 'string' ? parseFloat(cd.calculatedPrice) : cd.calculatedPrice) : null,
          exchangeRate: cd.exchangeRate || cd.xe || null,
          margins: Array.isArray(cd.margins) ? cd.margins : [],
          costs: Array.isArray(cd.costs) ? cd.costs : [],
          charges: Array.isArray(cd.charges) ? cd.charges : [],
        };
        // Explicitly exclude paymentTerm and paymentMethod
        return cleanCd;
      }).filter((cd: any) => cd.country && cd.currency && (cd.basePrice !== undefined && cd.basePrice !== null)), // Filter out invalid entries
      
      // Extract paymentTerm and paymentMethod from formData (top level or from first countryDeliverable for backward compatibility)
      paymentTerm: (() => {
        if (formData.paymentTerm) {
          return Array.isArray(formData.paymentTerm) 
            ? formData.paymentTerm 
            : (formData.paymentTerm ? [formData.paymentTerm] : []);
        } else if (formData.countryDeliverables && formData.countryDeliverables.length > 0 && formData.countryDeliverables[0].paymentTerm) {
          const cdPaymentTerm = formData.countryDeliverables[0].paymentTerm;
          return Array.isArray(cdPaymentTerm) ? cdPaymentTerm : (cdPaymentTerm ? [cdPaymentTerm] : []);
        }
        return [];
      })(),
      paymentMethod: (() => {
        if (formData.paymentMethod) {
          return Array.isArray(formData.paymentMethod) 
            ? formData.paymentMethod 
            : (formData.paymentMethod ? [formData.paymentMethod] : []);
        } else if (formData.countryDeliverables && formData.countryDeliverables.length > 0 && formData.countryDeliverables[0].paymentMethod) {
          const cdPaymentMethod = formData.countryDeliverables[0].paymentMethod;
          return Array.isArray(cdPaymentMethod) ? cdPaymentMethod : (cdPaymentMethod ? [cdPaymentMethod] : []);
        }
        return [];
      })(),
    };
    
    console.log("Transformed form data:", transformedFormData);
    
    // If editing, trigger margin/cost/preview flow
    if (editItem) {
      // Save form data for later submission
      setPendingFormData(transformedFormData);
      
      // Extract existing margins from product's countryDeliverables
      const existingMargins: MarginSelection = {
        brand: false,
        productCategory: false,
        conditionCategory: false,
        sellerCategory: false,
        customerCategory: false,
      };
      
      // Check if any country deliverable has margins
      if (transformedFormData.countryDeliverables && transformedFormData.countryDeliverables.length > 0) {
        const firstDeliverable = transformedFormData.countryDeliverables[0];
        if (firstDeliverable.margins && Array.isArray(firstDeliverable.margins) && firstDeliverable.margins.length > 0) {
          firstDeliverable.margins.forEach((margin: any) => {
            if (margin.type === 'brand') existingMargins.brand = true;
            if (margin.type === 'productCategory') existingMargins.productCategory = true;
            if (margin.type === 'conditionCategory') existingMargins.conditionCategory = true;
            if (margin.type === 'sellerCategory') existingMargins.sellerCategory = true;
            if (margin.type === 'customerCategory') existingMargins.customerCategory = true;
          });
        }
      }
      
      // Extract existing costs from product's countryDeliverables
      const existingCostsHK: SelectedCost[] = [];
      const existingCostsDubai: SelectedCost[] = [];
      
      transformedFormData.countryDeliverables.forEach((cd: any) => {
        if (cd.costs && Array.isArray(cd.costs) && cd.costs.length > 0) {
          const costArray = cd.country === 'Hongkong' ? existingCostsHK : existingCostsDubai;
          cd.costs.forEach((cost: any) => {
            costArray.push({
              costId: cost.costId || cost._id || '',
              name: cost.name || '',
              costType: cost.costType || 'Fixed',
              costField: cost.costField || 'product',
              costUnit: cost.costUnit,
              value: cost.value || 0,
              groupId: cost.groupId,
              isExpressDelivery: cost.isExpressDelivery,
              isSameLocationCharge: cost.isSameLocationCharge,
            });
          });
        }
      });
      
      // Pre-populate with existing values
      setMarginSelection(existingMargins);
      setSelectedCosts({
        Hongkong: existingCostsHK,
        Dubai: existingCostsDubai,
      });
      setCalculationResults([]);
      
      // Open margin modal
      setShowMarginModal(true);
    } else {
      // Create mode: proceed with direct save
      onSave(transformedFormData);
    }
  };

  if (!isOpen) return null;

  const title = editItem ? "Edit Product" : "Create Product";
  const lockDerivedFields = Boolean(formData.skuFamilyId);

  const skuFamilyOptions = skuFamilies.map(sku => ({ 
    value: sku._id, 
    label: sku.name,
    data: sku // Include full SKU family data for extraction
  }));

  const selectedSkuFamily = skuFamilyOptions.find(option => option.value === formData.skuFamilyId);

  // Custom styles for react-select to match existing design
  const customSelectStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isDisabled ? '#f9fafb' : '#f9fafb',
      borderColor: touched.skuFamilyId && validationErrors.skuFamilyId 
        ? '#ef4444' 
        : state.isFocused 
        ? '#3b82f6' 
        : '#e5e7eb',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      minHeight: '42px',
      borderRadius: '0.5rem',
      '&:hover': {
        borderColor: state.isFocused ? '#3b82f6' : '#d1d5db'
      }
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      zIndex: 9999
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? '#3b82f6' 
        : state.isFocused 
        ? '#f3f4f6' 
        : 'white',
      color: state.isSelected ? 'white' : '#111827',
      '&:hover': {
        backgroundColor: '#f3f4f6'
      }
    }),
    singleValue: (provided: any) => ({
      ...provided,
      color: '#111827'
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: '#6b7280'
    }),
    indicatorSeparator: () => ({
      display: 'none'
    }),
    dropdownIndicator: (provided: any) => ({
      ...provided,
      color: '#6b7280',
      '&:hover': {
        color: '#374151'
      }
    }),
    // Dark mode styles
    dark: {
      control: {
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        color: 'white'
      },
      menu: {
        backgroundColor: '#1f2937'
      },
      option: {
        backgroundColor: '#1f2937',
        color: 'white',
        '&:hover': {
          backgroundColor: '#374151'
        }
      },
      singleValue: {
        color: 'white'
      },
      placeholder: {
        color: '#9ca3af'
      }
    }
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
          <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
            {/* SKU Family ID and RAM Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  SKU Family ID
                </label>
                <Select
                  options={skuFamilyOptions}
                  value={selectedSkuFamily}
                  onChange={handleSkuFamilyChange}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, skuFamilyId: true }));
                    const error = validateField("skuFamilyId", formData.skuFamilyId);
                    setValidationErrors((prev) => ({ ...prev, skuFamilyId: error }));
                  }}
                  isDisabled={skuLoading || skuError !== null}
                  placeholder={skuLoading ? "Loading SKU Families..." : skuError ? "Error loading SKU Families" : "Select SKU Family"}
                  isSearchable={true}
                  isLoading={skuLoading}
                  styles={customSelectStyles}
                  className="basic-select"
                  classNamePrefix="select"
                />
                {touched.skuFamilyId && validationErrors.skuFamilyId && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.skuFamilyId}
                  </p>
                )}
                {skuError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {skuError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  RAM
                </label>
                <div className="relative">
                  <select
                    name="ram"
                    value={formData.ram}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.ram && validationErrors.ram
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                  >
                    <option value="" disabled>
                      Select RAM
                    </option>
                    {ramOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.ram && validationErrors.ram && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.ram}
                  </p>
                )}
              </div>
            </div>

            {/* Grade and Seller Code Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Grade
                </label>
                <Select
                  options={grades
                    .filter(grade => grade && grade._id && grade.title && typeof grade.title === 'string')
                    .map(grade => {
                      const title = grade.title;
                      const brandTitle = (typeof grade.brand === 'object' && grade.brand && grade.brand.title && typeof grade.brand.title === 'string') 
                        ? ` (${grade.brand.title})` 
                        : '';
                      return { 
                        value: grade._id || '', 
                        label: title + brandTitle
                      };
                    })}
                  value={(() => {
                    if (!formData.gradeId) return null;
                    const found = grades.find(grade => grade && grade._id === formData.gradeId);
                    if (!found || !found._id || !found.title || typeof found.title !== 'string') return null;
                    const title = found.title;
                    const brandTitle = (typeof found.brand === 'object' && found.brand && found.brand.title && typeof found.brand.title === 'string') 
                      ? ` (${found.brand.title})` 
                      : '';
                    return { 
                      value: found._id, 
                      label: title + brandTitle
                    };
                  })()}
                  onChange={(selectedOption: any) => {
                    const value = selectedOption?.value || '';
                    setFormData(prev => ({ ...prev, gradeId: value }));
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, gradeId: true }));
                  }}
                  isDisabled={gradeLoading}
                  placeholder={gradeLoading ? "Loading..." : "Select Grade"}
                  isSearchable={true}
                  isLoading={gradeLoading}
                  styles={customSelectStyles}
                  className="basic-select"
                  classNamePrefix="select"
                  isClearable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Seller Code
                </label>
                <Select
                  options={sellers
                    .filter(seller => seller && seller._id && seller.name && typeof seller.name === 'string')
                    .map(seller => {
                      const label = seller.code 
                        ? `${seller.name} (${seller.code})` 
                        : seller.name;
                      return { 
                        value: seller._id || '', 
                        label: label
                      };
                    })}
                  value={(() => {
                    if (!formData.sellerId) return null;
                    const found = sellers.find(seller => seller && seller._id === formData.sellerId);
                    if (!found || !found._id || !found.name || typeof found.name !== 'string') return null;
                    const label = found.code 
                      ? `${found.name} (${found.code})` 
                      : found.name;
                    return { 
                      value: found._id, 
                      label: label
                    };
                  })()}
                  onChange={(selectedOption: any) => {
                    const value = selectedOption?.value || '';
                    setFormData(prev => ({ ...prev, sellerId: value }));
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, sellerId: true }));
                  }}
                  isDisabled={sellerLoading}
                  placeholder={sellerLoading ? "Loading..." : "Select Seller Code"}
                  isSearchable={true}
                  isLoading={sellerLoading}
                  styles={customSelectStyles}
                  className="basic-select"
                  classNamePrefix="select"
                  isClearable
                />
              </div>
            </div>

            {/* SIM Type, Color, and Country Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  SIM Type
                </label>
                <div className="relative">
                  <select
                    name="simType"
                    value={formData.simType}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    disabled={lockDerivedFields}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.simType && validationErrors.simType
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                  >
                    <option value="" disabled>
                      Select SIM Type
                    </option>
                    {simOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.simType && validationErrors.simType && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.simType}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Color
                </label>
                <div className="relative">
                  <select
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    disabled={lockDerivedFields}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.color && validationErrors.color
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                  >
                    <option value="" disabled>
                      Select Color
                    </option>
                    {colorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.color && validationErrors.color && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.color}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Country
                </label>
                <div className="relative">
                  <select
                    name="country"
                    value={formData.country || ''}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    disabled={lockDerivedFields}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.country && validationErrors.country
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                  >
                    <option value="" disabled>
                      Select Country
                    </option>
                    {countryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.country && validationErrors.country && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.country}
                  </p>
                )}

              </div>
            </div>

            {/* Storage, Weight, and Condition Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Storage
                </label>
                <div className="relative">
                  <select
                    name="storage"
                    value={formData.storage}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.storage && validationErrors.storage
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                  >
                    <option value="" disabled>
                      Select Storage
                    </option>
                    {storageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.storage && validationErrors.storage && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.storage}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={`w-full px-3 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.weight && validationErrors.weight
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {touched.weight && validationErrors.weight && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.weight}
                  </p>
                )}
              </div>
            </div>

            {/* Stock, MOQ, and Purchase Type Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Stock
                </label>
                <input
                  type="text"
                  name="stock"
                  value={formData.stock}
                  onChange={(e) => handleNumericChange("stock", e, false)}
                  onBlur={handleBlur}
                  inputMode="numeric"
                  className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.stock && validationErrors.stock
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  placeholder="Enter Stock"
                  required
                />
                {touched.stock && validationErrors.stock && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.stock}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  MOQ
                </label>
                <input
                  type="text"
                  name="moq"
                  value={formData.moq}
                  onChange={(e) => handleNumericChange("moq", e, false)}
                  onBlur={handleBlur}
                  inputMode="numeric"
                  className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.moq && validationErrors.moq
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  placeholder="Enter Minimum Order Quantity"
                  required
                  disabled={formData.purchaseType === "full"}
                />
                {touched.moq && validationErrors.moq && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.moq}
                  </p>
                )}
                {moqError && formData.purchaseType === "partial" && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {moqError}
                  </p>
                )}
                {formData.purchaseType === "full" && (
                  <p className="mt-1 text-xs text-gray-500">
                    MOQ equals Stock for Full purchase type.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Purchase Type
                </label>
                <div className="relative">
                  <select
                    name="purchaseType"
                    value={formData.purchaseType}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm appearance-none cursor-pointer ${
                      touched.purchaseType && validationErrors.purchaseType
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    required
                  >
                    <option value="partial">Partial</option>
                    <option value="full">Full</option>
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                </div>
                {touched.purchaseType && validationErrors.purchaseType && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.purchaseType}
                  </p>
                )}
              </div>
            </div>

            {/* Start Time, Expiry Time, Is Negotiable, and Is Flash Deal Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                  Start Time
                </label>
                <DatePicker
                  selected={
                    formData.startTime ? new Date(formData.startTime) : null
                  }
                  onChange={handleStartTimeChange}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, startTime: true }));
                    const error = validateField(
                      "startTime",
                      formData.startTime
                    );
                    setValidationErrors((prev) => ({
                      ...prev,
                      startTime: error,
                    }));
                  }}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd HH:mm"
                  placeholderText="Select start date and time (optional)"
                  className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                    touched.startTime && validationErrors.startTime
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {touched.startTime && validationErrors.startTime && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {validationErrors.startTime}
                  </p>
                )}
              </div>

              {formData.isFlashDeal === "true" && (
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Expiry Time
                  </label>
                  <DatePicker
                    selected={
                      formData.expiryTime ? new Date(formData.expiryTime) : null
                    }
                    onChange={handleDateChange}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, expiryTime: true }));
                      const error = validateField(
                        "expiryTime",
                        formData.expiryTime
                      );
                      setValidationErrors((prev) => ({
                        ...prev,
                        expiryTime: error,
                      }));
                    }}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    placeholderText="Select date and time"
                    className={`w-full p-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm ${
                      touched.expiryTime && validationErrors.expiryTime
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    minDate={new Date()}
                    required={formData.isFlashDeal === "true"}
                  />
                  {touched.expiryTime && validationErrors.expiryTime && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {validationErrors.expiryTime}
                    </p>
                  )}
                  {dateError && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {dateError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Is Negotiable and Is Flash Deal Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center mt-6">
                <input
                  type="checkbox"
                  name="isNegotiable"
                  checked={formData.isNegotiable}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition duration-200"
                />
                <label className="ml-2 text-sm font-medium text-gray-950 dark:text-gray-200">
                  Is Negotiable
                </label>
              </div>

              <div className="flex items-center mt-6">
                <input
                  type="checkbox"
                  name="isFlashDeal"
                  checked={formData.isFlashDeal === "true"}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition duration-200"
                />
                <label className="ml-2 text-sm font-medium text-gray-950 dark:text-gray-200">
                  Is Flash Deal
                </label>
              </div>
            </div>

            {/* Group Code Field */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                Group Code <span className="text-gray-500 text-xs">(Optional - for multi-variant products)</span>
              </label>
              <input
                type="text"
                name="groupCode"
                value={formData.groupCode}
                onChange={handleInputChange}
                placeholder="Enter group code (e.g., GROUP001)"
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
              />
            </div>

            {/* Country Deliverables Section */}
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-semibold text-gray-950 dark:text-gray-200">
                  Country Deliverables <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={addCountryDeliverable}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 text-sm flex items-center gap-2"
                >
                  <i className="fas fa-plus text-xs"></i>
                  Add Country
                </button>
              </div>

              {formData.countryDeliverables.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No country deliverables added. Click "Add Country" to add country-wise pricing and charges.
                </p>
              ) : (
                <div className="space-y-4">
                  {formData.countryDeliverables.map((deliverable, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          Country Deliverable #{index + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeCountryDeliverable(index)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        >
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                            Country <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={deliverable.country}
                            onChange={(e) => {
                              const country = e.target.value;
                              // Auto-set currency based on country
                              let currency: 'USD' | 'HKD' | 'AED' = 'USD';
                              if (country === 'Hongkong') {
                                currency = deliverable.currency === 'HKD' ? 'HKD' : 'USD';
                              } else if (country === 'Dubai') {
                                currency = deliverable.currency === 'AED' ? 'AED' : 'USD';
                              }
                              updateCountryDeliverable(index, 'country', country);
                              updateCountryDeliverable(index, 'currency', currency);
                            }}
                            className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                          >
                            <option value="">Select Country</option>
                            {countryOptions.map(country => (
                              <option key={country} value={country}>{country}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                            Currency <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={deliverable.currency || 'USD'}
                            onChange={(e) => updateCountryDeliverable(index, 'currency', e.target.value)}
                            className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                            disabled={!deliverable.country}
                          >
                            {deliverable.country === 'Hongkong' && (
                              <>
                                <option value="USD">USD</option>
                                <option value="HKD">HKD</option>
                              </>
                            )}
                            {deliverable.country === 'Dubai' && (
                              <>
                                <option value="USD">USD</option>
                                <option value="AED">AED</option>
                              </>
                            )}
                            {!deliverable.country && (
                              <option value="USD">USD</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                            Base Price <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={deliverable.basePrice || deliverable.usd || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              updateCountryDeliverable(index, 'basePrice', value);
                              // Also update legacy usd field for backward compatibility
                              if (deliverable.currency === 'USD') {
                                updateCountryDeliverable(index, 'usd', value);
                              }
                            }}
                            placeholder="Enter base price"
                            className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                            step="0.01"
                            min="0"
                            required
                          />
                        </div>
                      </div>

                      {/* Charges Section */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-sm font-medium text-gray-950 dark:text-gray-200">
                            Charges
                          </label>
                          <div className="flex gap-2">
                            {/* Add charge from cost module */}
                            {deliverable.country && costsByCountry[deliverable.country] && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    addChargeFromCostModule(index, e.target.value);
                                    e.target.value = "";
                                  }
                                }}
                                className="text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200"
                              >
                                <option value="">Add from Cost Module</option>
                                {costsByCountry[deliverable.country].map(cost => (
                                  <option key={cost._id} value={cost._id}>
                                    {cost.name} ({cost.costType}: {cost.value}{cost.costType === 'Percentage' ? '%' : ''})
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => addChargeToCountry(index)}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition duration-200"
                            >
                              <i className="fas fa-plus mr-1"></i>
                              Add Charge
                            </button>
                          </div>
                        </div>

                        {deliverable.charges.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                            No charges added. Click "Add Charge" or select from cost module.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {deliverable.charges.map((charge, chargeIndex) => (
                              <div
                                key={chargeIndex}
                                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                              >
                                <input
                                  type="text"
                                  value={charge.name}
                                  onChange={(e) => updateCharge(index, chargeIndex, 'name', e.target.value)}
                                  placeholder="Charge name"
                                  className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                                />
                                <input
                                  type="number"
                                  value={charge.value}
                                  onChange={(e) => updateCharge(index, chargeIndex, 'value', parseFloat(e.target.value) || 0)}
                                  placeholder="Value"
                                  className="w-24 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                                  step="0.01"
                                  min="0"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeChargeFromCountry(index, chargeIndex)}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                >
                                  <i className="fas fa-trash text-sm"></i>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {validationErrors.countryDeliverables && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.countryDeliverables}
                </p>
              )}

              {/* Payment Terms and Method Section - Top Level */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Payment Term
                  </label>
                  <div className="min-w-[200px]">
                    <Select
                      isMulti
                      options={(constants?.paymentTerm || []).map(opt => ({ value: opt.code, label: opt.name }))}
                      value={
                        formData.paymentTerm && Array.isArray(formData.paymentTerm)
                          ? formData.paymentTerm
                              .map(code => {
                                const opt = constants?.paymentTerm?.find(p => p.code === code);
                                return opt ? { value: opt.code, label: opt.name } : null;
                              })
                              .filter(Boolean) as { value: string; label: string }[]
                          : formData.paymentTerm
                          ? (() => {
                              const paymentTermValue = formData.paymentTerm as unknown;
                              if (typeof paymentTermValue === 'string') {
                                return paymentTermValue.split(',').map((t: string) => t.trim()).filter((t: string) => t)
                                  .map((code: string) => {
                                    const opt = constants?.paymentTerm?.find(p => p.code === code);
                                    return opt ? { value: opt.code, label: opt.name } : null;
                                  })
                                  .filter(Boolean) as { value: string; label: string }[];
                              }
                              return [];
                            })()
                          : []
                      }
                      onChange={(selected) => {
                        const selectedValues = selected ? selected.map(opt => opt.value) : [];
                        setFormData(prev => ({ ...prev, paymentTerm: selectedValues }));
                      }}
                      className="text-sm"
                      classNamePrefix="select"
                      isSearchable={false}
                      placeholder="Select payment terms..."
                      styles={{
                        control: (provided) => ({
                          ...provided,
                          minHeight: '40px',
                          minWidth: '200px',
                          fontSize: '14px',
                          backgroundColor: 'rgb(249 250 251)',
                        }),
                        menu: (provided) => ({ ...provided, zIndex: 9999 }),
                        multiValue: (provided) => ({
                          ...provided,
                          backgroundColor: '#dbeafe',
                        }),
                        multiValueLabel: (provided) => ({
                          ...provided,
                          color: '#1e40af',
                          fontWeight: '500',
                        }),
                        multiValueRemove: (provided) => ({
                          ...provided,
                          color: '#1e40af',
                          ':hover': {
                            backgroundColor: '#93c5fd',
                            color: '#fff',
                          },
                        }),
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-950 dark:text-gray-200 mb-2">
                    Payment Method
                  </label>
                  <div className="min-w-[200px]">
                    <Select
                      isMulti
                      options={(constants?.paymentMethod || []).map(opt => ({ value: opt.code, label: opt.name }))}
                      value={
                        formData.paymentMethod && Array.isArray(formData.paymentMethod)
                          ? formData.paymentMethod
                              .map(code => {
                                const opt = constants?.paymentMethod?.find(p => p.code === code);
                                return opt ? { value: opt.code, label: opt.name } : null;
                              })
                              .filter(Boolean) as { value: string; label: string }[]
                          : formData.paymentMethod
                          ? (() => {
                              const paymentMethodValue = formData.paymentMethod as unknown;
                              if (typeof paymentMethodValue === 'string') {
                                return paymentMethodValue.split(',').map((m: string) => m.trim()).filter((m: string) => m)
                                  .map((code: string) => {
                                    const opt = constants?.paymentMethod?.find(p => p.code === code);
                                    return opt ? { value: opt.code, label: opt.name } : null;
                                  })
                                  .filter(Boolean) as { value: string; label: string }[];
                              }
                              return [];
                            })()
                          : []
                      }
                      onChange={(selected) => {
                        const selectedValues = selected ? selected.map(opt => opt.value) : [];
                        setFormData(prev => ({ ...prev, paymentMethod: selectedValues }));
                      }}
                      className="text-sm"
                      classNamePrefix="select"
                      isSearchable={false}
                      placeholder="Select payment methods..."
                      styles={{
                        control: (provided) => ({
                          ...provided,
                          minHeight: '40px',
                          minWidth: '200px',
                          fontSize: '14px',
                          backgroundColor: 'rgb(249 250 251)',
                        }),
                        menu: (provided) => ({ ...provided, zIndex: 9999 }),
                        multiValue: (provided) => ({
                          ...provided,
                          backgroundColor: '#dbeafe',
                        }),
                        multiValueLabel: (provided) => ({
                          ...provided,
                          color: '#1e40af',
                          fontWeight: '500',
                        }),
                        multiValueRemove: (provided) => ({
                          ...provided,
                          color: '#1e40af',
                          ':hover': {
                            backgroundColor: '#93c5fd',
                            color: '#fff',
                          },
                        }),
                      }}
                    />
                  </div>
                </div>
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
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-form"
              className="min-w-[160px] px-4 py-2 bg-[#0071E0] text-white rounded-lg hover:bg-blue-600 transition duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={
                skuLoading ||
                skuError !== null
              }
            >
              {skuLoading ? (
                <svg
                  className="animate-spin h-4 w-4 text-white mr-2"
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
              ) : null}
              {editItem ? "Update Product" : "Create Product"}
            </button>
          </div>
        </div>
      </div>

      {/* Margin Selection Modal */}
      {showMarginModal && pendingFormData && (
        <MarginSelectionModal
          isOpen={showMarginModal}
          onClose={() => {
            setShowMarginModal(false);
            setPendingFormData(null);
          }}
          onNext={handleMarginNext}
          products={[pendingFormData]}
          initialSelection={marginSelection || undefined}
        />
      )}

      {/* Cost Selection Modal */}
      {showCostModal && currentCostCountry && pendingFormData && (
        <CostModuleSelectionModal
          isOpen={showCostModal}
          onClose={() => {
            setShowCostModal(false);
            setCurrentCostCountry(null);
            setPendingFormData(null);
          }}
          onNext={handleCostNext}
          products={[pendingFormData]}
          country={currentCostCountry}
          initialCosts={currentCostCountry === 'Hongkong' ? selectedCosts.Hongkong : selectedCosts.Dubai}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && calculationResults.length > 0 && (
        <ProductPreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPendingFormData(null);
            setMarginSelection(null);
            setSelectedCosts({ Hongkong: [], Dubai: [] });
            setCalculationResults([]);
          }}
          onSubmit={handlePreviewSubmit}
          calculationResults={calculationResults}
          loading={isCalculating}
        />
      )}
    </div>
  );
};

export default ProductModal;