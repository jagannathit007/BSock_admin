import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import { VariantOption } from './CascadingVariantSelector';
import { GradeService } from '../../services/grade/grade.services';
import { SellerService } from '../../services/seller/sellerService';
import { ProductService, Product } from '../../services/product/product.services';
import { ConstantsService, Constants } from '../../services/constants/constants.services';
import { SkuFamilyService } from '../../services/skuFamily/skuFamily.services';
import toastHelper from '../../utils/toastHelper';
import MarginSelectionModal, { MarginSelection } from './MarginSelectionModal';
import CostModuleSelectionModal, { SelectedCost } from './CostModuleSelectionModal';
import ProductPreviewModal from './ProductPreviewModal';
import { ProductCalculationResult } from '../../utils/priceCalculation';

export interface ProductRowData {
  // Product Detail Group
  subModelName: string;
  storage: string;
  colour: string;
  country: string;
  sim: string;
  version: string;
  grade: string;
  status: string;
  condition: string;
  lockUnlock: string;
  warranty: string;
  batteryHealth: string;
  
  // Pricing / Delivery / Payment Method Group
  packing: string;
  currentLocation: string; // Store code: "HK" or "D"
  hkUsd: number | string;
  hkXe: number | string;
  hkHkd: number | string;
  dubaiUsd: number | string;
  dubaiXe: number | string;
  dubaiAed: number | string;
  deliveryLocation: string[]; // Array of codes: ["HK", "D"]
  customMessage: string;
  totalQty: number | string;
  moqPerVariant: number | string;
  weight: number | string;
  purchaseType: string; // 'full' | 'partial'
  // Payment Term - array of strings
  paymentTerm: string[];
  // Payment Method - array of strings
  paymentMethod: string[];
  
  // Other Information Group
  negotiableFixed: string;
  tags: string; // Comma-separated string of tag codes
  flashDeal: string;
  shippingTime: string;
  deliveryTime: string;
  vendor: string;
  vendorListingNo: string;
  carrier: string;
  carrierListingNo: string;
  uniqueListingNo: string;
  adminCustomMessage: string;
  startTime: string;
  endTime: string;
  remark: string;
  
  // Additional fields
  supplierId: string;
  supplierListingNumber: string;
  customerListingNumber: string;
  skuFamilyId: string;
  ram?: string;
  sequence?: number;
  images?: string[];
  // Dynamic custom fields - key-value pairs
  [key: string]: any;
}

interface ExcelLikeProductFormProps {
  variantType: 'single' | 'multi';
  variants?: VariantOption[];
  onSave: (rows: ProductRowData[], totalMoq?: number | string) => void;
  onCancel: () => void;
  editProducts?: Product[]; // Products to edit
}

const ExcelLikeProductForm: React.FC<ExcelLikeProductFormProps> = ({
  variantType,
  variants = [],
  onSave,
  onCancel,
  editProducts = [],
}) => {
  const [rows, setRows] = useState<ProductRowData[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [skuFamilies, setSkuFamilies] = useState<any[]>([]);
  const [constants, setConstants] = useState<Constants | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalMoq, setTotalMoq] = useState<number | string>(''); 
  const tableRef = useRef<HTMLDivElement>(null);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: string } | null>(null);
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  // State for row-specific SKU Family search
  const [rowSkuFamilySearch, setRowSkuFamilySearch] = useState<{ rowIndex: number; query: string; showResults: boolean } | null>(null);
  const [rowSkuFamilySearchResults, setRowSkuFamilySearchResults] = useState<any[]>([]);
  const [openSupplierDropdown, setOpenSupplierDropdown] = useState<{ row: number; isOpen: boolean } | null>(null);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<{ row: number; query: string } | null>(null);
  const [currentCustomerListingNumber, setCurrentCustomerListingNumber] = useState<number | null>(null);
  const [supplierListingNumbers, setSupplierListingNumbers] = useState<Record<string, { listingNumber: number; supplierCode: string }>>({});
  const [currentUniqueListingNumber, setCurrentUniqueListingNumber] = useState<number | null>(null);
  const [shippingTimeMode, setShippingTimeMode] = useState<Record<number, 'today' | 'tomorrow' | 'calendar' | ''>>({});
  const totalMoqCellRef = useRef<HTMLDivElement | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);
  const totalMoqPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const [totalMoqHeight, setTotalMoqHeight] = useState<number>(0);
  const [totalMoqLeft, setTotalMoqLeft] = useState<number>(0);

  // Modal states
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [currentCostCountry, setCurrentCostCountry] = useState<'Hongkong' | 'Dubai' | null>(null);
  const [marginSelection, setMarginSelection] = useState<MarginSelection | null>(null);
  const [selectedCosts, setSelectedCosts] = useState<{ Hongkong: SelectedCost[]; Dubai: SelectedCost[] }>({
    Hongkong: [],
    Dubai: [],
  });
  const [calculationResults, setCalculationResults] = useState<ProductCalculationResult[]>([]);
  const [pendingRows, setPendingRows] = useState<ProductRowData[]>([]);
  const [pendingTotalMoq, setPendingTotalMoq] = useState<number | string | undefined>(undefined);

  // Dynamic custom columns state
  const [customColumns, setCustomColumns] = useState<Array<{ key: string; label: string; width: number }>>([]);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // LocalStorage key for saving form data
  const STORAGE_KEY = 'variant-product-form-data';

  // Load data from localStorage on mount OR initialize from editProducts
  useEffect(() => {
    // Priority 1: Initialize from editProducts if available (editing mode)
    if (editProducts && editProducts.length > 0) {
      console.log('ExcelLikeProductForm: Initializing rows from editProducts:', editProducts.length, 'products');
      console.log('ExcelLikeProductForm: editProducts data:', JSON.stringify(editProducts, null, 2));
      const transformedRows: ProductRowData[] = editProducts.map((product) => {
        const skuFamily = typeof product.skuFamilyId === 'object' ? product.skuFamilyId : null;
        const grade = (product as any).gradeId ? (typeof (product as any).gradeId === 'object' ? (product as any).gradeId._id : (product as any).gradeId) : '';
        const seller = (product as any).sellerId ? (typeof (product as any).sellerId === 'object' ? (product as any).sellerId._id : (product as any).sellerId) : '';
        
        // Get country deliverables
        const hkDeliverable = Array.isArray(product.countryDeliverables) 
          ? product.countryDeliverables.find((cd: any) => cd.country === 'Hongkong')
          : null;
        const dubaiDeliverable = Array.isArray(product.countryDeliverables)
          ? product.countryDeliverables.find((cd: any) => cd.country === 'Dubai')
          : null;
        
        // Get custom fields
        const customFields = (product as any).customFields || {};
        const customFieldsObj: Record<string, string> = {};
        if (customFields instanceof Map) {
          customFields.forEach((value, key) => {
            customFieldsObj[key] = value;
          });
        } else if (typeof customFields === 'object') {
          Object.assign(customFieldsObj, customFields);
        }
        
        // Find matching subSkuFamily to get subModelName
        // The specification field contains the subModelName value (e.g., "Pro Max")
        let subModelName = '';
        if (skuFamily && (skuFamily as any).subSkuFamilies && Array.isArray((skuFamily as any).subSkuFamilies)) {
          // Try to match by specification (which should match subName)
          const specification = product.specification || '';
          if (specification) {
            const matchingSubSku = (skuFamily as any).subSkuFamilies.find((sub: any) => 
              sub.subName === specification
            );
            if (matchingSubSku && matchingSubSku.subName) {
              subModelName = matchingSubSku.subName;
            } else {
              // If no exact match, use specification directly as it represents the subModelName
              subModelName = specification;
            }
          }
        } else if (product.specification) {
          // Fallback: use specification directly (it contains the subModelName)
          subModelName = product.specification;
        }
        
        return {
          subModelName: subModelName,
          storage: product.storage || '',
          colour: product.color || '',
          country: product.country || '',
          sim: product.simType || '',
          version: product.specification || '',
          grade: grade,
          status: (product as any).status || '',
          condition: product.condition || '',
          lockUnlock: (product as any).lockUnlock ? '1' : '0',
          warranty: (product as any).warranty || '',
          batteryHealth: (product as any).batteryHealth || '',
          packing: (product as any).packing || '',
          currentLocation: (product as any).currentLocation || '',
          hkUsd: hkDeliverable?.usd || 0,
          hkXe: hkDeliverable?.xe || 0,
          hkHkd: hkDeliverable?.local || hkDeliverable?.hkd || 0,
          dubaiUsd: dubaiDeliverable?.usd || 0,
          dubaiXe: dubaiDeliverable?.xe || 0,
          dubaiAed: dubaiDeliverable?.local || dubaiDeliverable?.aed || 0,
          deliveryLocation: Array.isArray((product as any).deliveryLocation) 
            ? (product as any).deliveryLocation 
            : [],
          customMessage: (product as any).customMessage || '',
          totalQty: product.stock || 0,
          moqPerVariant: product.moq || 0,
          weight: (product as any).weight || '',
          purchaseType: (product as any).purchaseType || 'partial',
          paymentTerm: Array.isArray((product as any).paymentTerm) 
            ? (product as any).paymentTerm 
            : [],
          paymentMethod: Array.isArray((product as any).paymentMethod)
            ? (product as any).paymentMethod
            : [],
          negotiableFixed: product.isNegotiable ? '1' : '0',
          tags: (product as any).tags || '',
          flashDeal: (product as any).isFlashDeal === 'true' || (product as any).isFlashDeal === true ? '1' : '0',
          shippingTime: (product as any).shippingTime || '',
          deliveryTime: (product as any).deliveryTime || '',
          vendor: (product as any).vendor || '',
          vendorListingNo: (product as any).vendorListingNo || '',
          carrier: (product as any).carrier || '',
          carrierListingNo: (product as any).carrierListingNo || '',
          uniqueListingNo: (product as any).uniqueListingNo || '',
          adminCustomMessage: (product as any).adminCustomMessage || '',
          startTime: (product as any).startTime || '',
          endTime: product.expiryTime || '',
          remark: (product as any).remark || '',
          supplierId: seller,
          supplierListingNumber: (product as any).supplierListingNumber || '',
          customerListingNumber: (product as any).customerListingNumber || '',
          skuFamilyId: typeof product.skuFamilyId === 'object' ? product.skuFamilyId._id : product.skuFamilyId,
          ram: product.ram || '',
          sequence: (product as any).sequence || undefined,
          images: (skuFamily as any)?.images || [],
          ...customFieldsObj,
        };
      });
      console.log('Transformed rows:', transformedRows);
      setRows(transformedRows);
      
      // Extract custom columns from custom fields if any
      if (transformedRows.length > 0) {
        const allCustomKeys = new Set<string>();
        transformedRows.forEach(row => {
          Object.keys(row).forEach(key => {
            if (key.startsWith('custom_')) {
              allCustomKeys.add(key);
            }
          });
        });
        if (allCustomKeys.size > 0) {
          const customCols = Array.from(allCustomKeys).map(key => ({
            key,
            label: key.replace('custom_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            width: 150,
          }));
          setCustomColumns(customCols);
        }
      }
      return;
    }
    
    // Priority 2: Load from localStorage if available (for draft/new products)
    // Skip localStorage if we're editing (editProducts will be loaded)
    if (editProducts && editProducts.length > 0) {
      return; // Don't load from localStorage when editing
    }
    
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Only restore if variantType matches
        if (parsed.variantType === variantType && parsed.rows && parsed.rows.length > 0) {
          // Restore custom columns first if they exist
          if (parsed.customColumns && Array.isArray(parsed.customColumns) && parsed.customColumns.length > 0) {
            setCustomColumns(parsed.customColumns);
            // Ensure all rows have custom column fields initialized
            const rowsWithCustomFields = parsed.rows.map((row: ProductRowData) => {
              const rowWithFields = { ...row };
              parsed.customColumns.forEach((col: { key: string; label: string; width: number }) => {
                if (!(col.key in rowWithFields)) {
                  rowWithFields[col.key] = '';
                }
              });
              return rowWithFields;
            });
            setRows(rowsWithCustomFields);
          } else {
            setRows(parsed.rows);
          }
          // Restore totalMoq if it exists and variantType is multi
          if (variantType === 'multi' && parsed.totalMoq !== undefined) {
            setTotalMoq(parsed.totalMoq);
          }
          return;
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    
    // Priority 3: Initialize rows based on variant type if no saved data and not editing
    // Only initialize if variantType is set and we're not editing
    if (variantType && (!editProducts || editProducts.length === 0) && rows.length === 0) {
      if (variantType === 'multi') {
        if (variants.length > 0) {
          const newRows: ProductRowData[] = variants.map((variant, index) => createEmptyRow(index, variant));
          setRows(newRows);
        } else {
          // If no variants provided, create one empty row
          setRows([createEmptyRow(0)]);
        }
      } else if (variantType === 'single') {
        setRows([createEmptyRow(0)]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantType, variants, editProducts]);

  // Sync shipping time mode with values
  useEffect(() => {
    const newModes: Record<number, 'today' | 'tomorrow' | 'calendar' | ''> = {};
    let hasChanges = false;
    
    rows.forEach((row, index) => {
      const shippingTimeValue = row.shippingTime;
      if (!shippingTimeValue) {
        if (shippingTimeMode[index]) {
          newModes[index] = '';
          hasChanges = true;
        }
        return;
      }
      
      try {
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        const getToday = (): Date => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return today;
        };
        
        const getTomorrow = (): Date => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          return tomorrow;
        };
        
        const dateValue = new Date(shippingTimeValue);
        dateValue.setHours(0, 0, 0, 0);
        
        const todayStr = formatDate(getToday());
        const tomorrowStr = formatDate(getTomorrow());
        const valueStr = formatDate(dateValue);
        
        let detectedMode: 'today' | 'tomorrow' | 'calendar' | '' = '';
        if (valueStr === todayStr) {
          detectedMode = 'today';
        } else if (valueStr === tomorrowStr) {
          detectedMode = 'tomorrow';
        } else {
          detectedMode = 'calendar';
        }
        
        if (shippingTimeMode[index] !== detectedMode) {
          newModes[index] = detectedMode;
          hasChanges = true;
        }
      } catch (e) {
        // Invalid date, clear mode
        if (shippingTimeMode[index]) {
          newModes[index] = '';
          hasChanges = true;
        }
      }
    });
    
    if (hasChanges) {
      setShippingTimeMode((prev) => {
        const updated = { ...prev };
        Object.keys(newModes).forEach((key) => {
          const idx = Number(key);
          const mode = newModes[idx];
          if (mode === '' || mode === 'today' || mode === 'tomorrow' || mode === 'calendar') {
            updated[idx] = mode;
          }
        });
        return updated;
      });
    }
  }, [rows.map(r => r.shippingTime).join(',')]);

  useEffect(() => {
    if (variantType === 'multi' && rows.length > 0) {
      const updatePosition = () => {
        if (rowsContainerRef.current) {
          // Get the actual height of the rows container
          const containerHeight = rowsContainerRef.current.scrollHeight;
          setTotalMoqHeight(containerHeight);
        } else {
          // Fallback: calculate approximate height (40px per row + borders)
          const approximateHeight = rows.length * 40;
          setTotalMoqHeight(approximateHeight);
        }
        
        // Measure the actual left position from the placeholder
        if (totalMoqPlaceholderRef.current && rowsContainerRef.current) {
          const placeholderRect = totalMoqPlaceholderRef.current.getBoundingClientRect();
          const containerRect = rowsContainerRef.current.getBoundingClientRect();
          const leftPosition = placeholderRect.left - containerRect.left;
          setTotalMoqLeft(leftPosition);
        }
      };
      
      // Use ResizeObserver for accurate tracking
      if (rowsContainerRef.current) {
        const resizeObserver = new ResizeObserver(() => {
          updatePosition();
        });
        resizeObserver.observe(rowsContainerRef.current);
        
        // Initial update
        updatePosition();
        
        // Also update after a short delay to ensure DOM is ready
        const timeoutId = setTimeout(updatePosition, 100);
        const timeoutId2 = setTimeout(updatePosition, 300);
        
        return () => {
          resizeObserver.disconnect();
          clearTimeout(timeoutId);
          clearTimeout(timeoutId2);
        };
      } else {
        // Fallback calculation
        const approximateHeight = rows.length * 40;
        setTotalMoqHeight(approximateHeight);
      }
    } else {
      setTotalMoqHeight(0);
      setTotalMoqLeft(0);
    }
  }, [rows.length, variantType, rows]);

  // Save data to localStorage whenever rows, totalMoq, or customColumns change
  useEffect(() => {
    if (rows.length > 0 || customColumns.length > 0) {
      try {
        const dataToSave = {
          variantType,
          rows,
          totalMoq: variantType === 'multi' ? totalMoq : undefined,
          customColumns: customColumns.length > 0 ? customColumns : undefined,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
    }
  }, [rows, variantType, totalMoq, customColumns]);

  const createEmptyRow = (index: number, variant?: VariantOption): ProductRowData => ({
    subModelName: variant?.subModelName || '',
    storage: variant?.storage || '',
    colour: variant?.color || '',
    country: '',
    sim: '',
    version: '',
    grade: '',
    status: '', // Will be set from constants
    condition: '',
    lockUnlock: '',
    warranty: '',
    batteryHealth: '',
    packing: '',
    currentLocation: '',
    hkUsd: '',
    hkXe: '',
    hkHkd: '',
    dubaiUsd: '',
    dubaiXe: '',
    dubaiAed: '',
    deliveryLocation: [],
    customMessage: '',
    totalQty: '',
    moqPerVariant: '',
    weight: '',
    purchaseType: 'partial',
    paymentTerm: [],
    paymentMethod: [],
    negotiableFixed: '0',
    tags: '',
    flashDeal: '',
    shippingTime: '',
    deliveryTime: '',
    vendor: '',
    vendorListingNo: '',
    carrier: '',
    carrierListingNo: '',
    uniqueListingNo: '',
    adminCustomMessage: '',
    startTime: '',
    endTime: '',
    remark: '',
    supplierId: '',
    supplierListingNumber: '',
    customerListingNumber: '',
    skuFamilyId: variant?.skuFamilyId || '',
    ram: variant?.ram,
    sequence: index + 1,
    // Initialize custom fields
    ...customColumns.reduce((acc, col) => {
      acc[col.key] = '';
      return acc;
    }, {} as Record<string, string>),
  });

  // Fetch dropdown data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const gradeResponse = await GradeService.getGradeList(1, 1000);
        setGrades(gradeResponse.data.docs || []);
        const sellersList = await SellerService.getAllSellers();
        setSellers(sellersList || []);
        const skuFamiliesList = await ProductService.getSkuFamilyListByName();
        setSkuFamilies(skuFamiliesList || []);
        const constantsData = await ConstantsService.getConstants();
        setConstants(constantsData);
        
        // Fetch next customer listing number
        try {
          const customerListingData = await ProductService.getNextCustomerListingNumber();
          setCurrentCustomerListingNumber(customerListingData.listingNumber);
        } catch (error) {
          console.error('Error fetching customer listing number:', error);
          // Default to 1 if fetch fails
          setCurrentCustomerListingNumber(1);
        }
        
        // Fetch next unique listing number (8-digit)
        try {
          const uniqueListingData = await ProductService.getNextUniqueListingNumber();
          setCurrentUniqueListingNumber(parseInt(uniqueListingData.uniqueListingNumber, 10));
        } catch (error) {
          console.error('Error fetching unique listing number:', error);
          // Default to 10000000 if fetch fails
          setCurrentUniqueListingNumber(10000000);
        }
        
        // Fetch costs by country (stored for potential future use)
        // const costResponse = await CostModuleService.getCostsByCountry();
        // if (costResponse.status === 200 && costResponse.data) {
        //   // Costs can be used for product cost calculations if needed
        // }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Flatten SKU Families with subSkuFamilies for search
  const getFlattenedSkuFamilyOptions = () => {
    const options: any[] = [];
    skuFamilies.forEach((skuFamily) => {
      // Add SKU Family itself (if it has no subSkuFamilies or we want to show it)
      if (!skuFamily.subSkuFamilies || skuFamily.subSkuFamilies.length === 0) {
        options.push({
          skuFamilyId: skuFamily._id,
          skuFamilyName: skuFamily.name,
          subModelName: skuFamily.name,
          storage: '',
          storageId: null,
          colour: '',
          colorId: null,
          ram: '',
          ramId: null,
          displayText: `${skuFamily.name}${skuFamily.brand ? ` - ${skuFamily.brand.title}` : ''}`,
        });
      } else {
        // Add each subSkuFamily as a separate option
        skuFamily.subSkuFamilies.forEach((subSku: any) => {
          options.push({
            skuFamilyId: skuFamily._id,
            skuFamilyName: skuFamily.name,
            subModelName: subSku.subName || skuFamily.name,
            storage: subSku.storageId?.title || '',
            storageId: subSku.storageId?._id || null,
            colour: subSku.colorId?.title || '',
            colorId: subSku.colorId?._id || null,
            ram: subSku.ramId?.title || '',
            ramId: subSku.ramId?._id || null,
            displayText: `${skuFamily.name}${subSku.subName ? ` - ${subSku.subName}` : ''}${subSku.storageId?.title ? ` - ${subSku.storageId.title}` : ''}${subSku.colorId?.title ? ` - ${subSku.colorId.title}` : ''}${subSku.ramId?.title ? ` - ${subSku.ramId.title}` : ''}`,
          });
        });
      }
    });
    return options;
  };

  // Search functionality for top search - removed as it's not used (commented out in UI)

  // Search functionality for row-specific SKU Family search
  useEffect(() => {
    if (!rowSkuFamilySearch) {
      setRowSkuFamilySearchResults([]);
      return;
    }

    const allOptions = getFlattenedSkuFamilyOptions();
    
    // If query is empty, show all options; otherwise filter
    if (!rowSkuFamilySearch.query.trim()) {
      setRowSkuFamilySearchResults(allOptions);
      setRowSkuFamilySearch(prev => prev ? { ...prev, showResults: allOptions.length > 0 } : null);
    } else {
      const query = rowSkuFamilySearch.query.toLowerCase().trim();
      const filtered = allOptions.filter((option) => {
        const searchText = `${option.skuFamilyName} ${option.subModelName} ${option.storage} ${option.colour} ${option.ram}`.toLowerCase();
        return searchText.includes(query);
      });

      setRowSkuFamilySearchResults(filtered);
      setRowSkuFamilySearch(prev => prev ? { ...prev, showResults: filtered.length > 0 } : null);
    }
  }, [rowSkuFamilySearch?.query, skuFamilies]);

  // Handle selection from search results (top search)

  // Handle selection from row-specific SKU Family search
  const handleRowSkuFamilySearchSelect = (option: any, rowIndex: number) => {
    updateRow(rowIndex, 'skuFamilyId', option.skuFamilyId);
    updateRow(rowIndex, 'subModelName', option.subModelName);
    updateRow(rowIndex, 'storage', option.storage);
    updateRow(rowIndex, 'colour', option.colour);
    if (option.ram) {
      updateRow(rowIndex, 'ram', option.ram);
    }
    setRowSkuFamilySearch(null);
    setRowSkuFamilySearchResults([]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N to add row
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addRow();
      }
      // Delete key to remove row if focused
      if (e.key === 'Delete' && focusedCell) {
        const cell = cellRefs.current[`${focusedCell.row}-${focusedCell.col}`];
        if (cell && 'value' in cell) {
          updateRow(focusedCell.row, focusedCell.col as keyof ProductRowData, '');
        }
      }
      // Escape key to close supplier dropdown
      if (e.key === 'Escape' && openSupplierDropdown?.isOpen) {
        setOpenSupplierDropdown(null);
        setSupplierSearchQuery(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, rows.length, openSupplierDropdown]);

  // Close supplier dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openSupplierDropdown?.isOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest('.supplier-dropdown-container')) {
          setOpenSupplierDropdown(null);
          setSupplierSearchQuery(null);
        }
      }
    };

    if (openSupplierDropdown?.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openSupplierDropdown]);

  // Auto-calculate delivery location and currency conversions
  useEffect(() => {
    setRows(prevRows => prevRows.map(row => {
      const updatedRow = { ...row };
      
      // Auto-calculate delivery location based on pricing
      const locations: string[] = [];
      // If HK pricing exists, add HK to delivery locations
      if (row.hkUsd || row.hkHkd) {
        locations.push('HK');
      }
      // If Dubai pricing exists, add D to delivery locations
      if (row.dubaiUsd || row.dubaiAed) {
        locations.push('D');
      }
      updatedRow.deliveryLocation = locations;
      
      return updatedRow;
    }));
  }, [rows.map(r => `${r.currentLocation}-${r.hkUsd}-${r.hkHkd}-${r.dubaiUsd}-${r.dubaiAed}`).join(',')]);

  // Auto-generate customer listing numbers when rows change
  useEffect(() => {
    if (currentCustomerListingNumber !== null && rows.length > 0) {
      setRows(prevRows => prevRows.map((row, index) => {
        const updatedRow = { ...row };
        const productNumber = index + 1;
        const customerListingNo = `L${currentCustomerListingNumber}-${productNumber}`;
        if (!updatedRow.customerListingNumber || updatedRow.customerListingNumber !== customerListingNo) {
          updatedRow.customerListingNumber = customerListingNo;
        }
        return updatedRow;
      }));
    }
  }, [rows.length, currentCustomerListingNumber]);

  // Auto-generate unique listing numbers when rows change
  useEffect(() => {
    if (currentUniqueListingNumber !== null && rows.length > 0) {
      setRows(prevRows => prevRows.map((row, index) => {
        const updatedRow = { ...row };
        const uniqueListingNo = String(currentUniqueListingNumber + index).padStart(8, '0');
        if (!updatedRow.uniqueListingNo || updatedRow.uniqueListingNo !== uniqueListingNo) {
          updatedRow.uniqueListingNo = uniqueListingNo;
        }
        return updatedRow;
      }));
    }
  }, [rows.length, currentUniqueListingNumber]);

  // Auto-generate supplier listing numbers when rows or suppliers change
  useEffect(() => {
    if (Object.keys(supplierListingNumbers).length === 0) return;
    
    setRows(prevRows => {
      let hasChanges = false;
      const updatedRows = prevRows.map((row, index) => {
        if (!row.supplierId) {
          return row;
        }
        
        const listingInfo = supplierListingNumbers[row.supplierId];
        if (!listingInfo) {
          return row;
        }
        
        const selectedSeller = sellers.find(s => s._id === row.supplierId);
        if (!selectedSeller || !selectedSeller.code) {
          return row;
        }
        
        const listingPrefix = variantType === 'multi' 
          ? `L${listingInfo.listingNumber}M1` 
          : `L${listingInfo.listingNumber}`;
        
        // Count how many rows with this supplier come before this row
        const productNum = prevRows.filter((r, i) => i <= index && r.supplierId === row.supplierId).length;
        const expectedListingNo = `${listingInfo.supplierCode}-${listingPrefix}-${productNum}`;
        
        if (row.supplierListingNumber !== expectedListingNo) {
          hasChanges = true;
          return { ...row, supplierListingNumber: expectedListingNo };
        }
        
        return row;
      });
      
      return hasChanges ? updatedRows : prevRows;
    });
  }, [rows.map(r => r.supplierId).join(','), rows.length, Object.keys(supplierListingNumbers).join(','), variantType, sellers]);

  const updateRow = (index: number, field: keyof ProductRowData, value: any) => {
    setRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index] = { ...newRows[index], [field]: value };
      
      // Auto-generate supplier listing number when supplier is selected
      if (field === 'supplierId' && value) {
        const selectedSeller = sellers.find(s => s._id === value);
        if (selectedSeller && selectedSeller.code) {
          // Check if we already have a listing number for this supplier in current form
          if (!supplierListingNumbers[value]) {
            // Fetch next supplier listing number asynchronously
            ProductService.getNextSupplierListingNumber(value, variantType === 'multi')
              .then(data => {
                setSupplierListingNumbers(prev => ({
                  ...prev,
                  [value]: { listingNumber: data.listingNumber, supplierCode: data.supplierCode }
                }));
              })
              .catch(error => {
                console.error('Error generating supplier listing number:', error);
              });
          }
        }
      }
      
      // Clear supplier listing number if supplier is removed
      if (field === 'supplierId' && !value) {
        newRows[index].supplierListingNumber = '';
      }
      
      // Auto-calculate currency conversions for HK
      if (field === 'hkUsd' || field === 'hkXe' || field === 'hkHkd') {
        const usd = parseFloat(String(newRows[index].hkUsd)) || 0;
        const xe = parseFloat(String(newRows[index].hkXe)) || 0;
        const hkd = parseFloat(String(newRows[index].hkHkd)) || 0;
        
        // Count how many values are present (greater than 0)
        const valuesCount = [usd, xe, hkd].filter(v => v > 0).length;
        
        // Only calculate if at least 2 values exist
        if (valuesCount >= 2) {
          // Calculate the missing value when any two values exist
          // Priority: don't overwrite the field being edited
          if (field !== 'hkHkd' && usd > 0 && xe > 0) {
            // If USD and XE exist, calculate HKD (multiply USD * XE)
            newRows[index].hkHkd = (usd * xe).toFixed(2);
          } else if (field !== 'hkUsd' && hkd > 0 && xe > 0) {
            // If HKD and XE exist, calculate USD (divide HKD / XE)
            newRows[index].hkUsd = (hkd / xe).toFixed(2);
          } else if (field !== 'hkXe' && usd > 0 && hkd > 0) {
            // If USD and HKD exist, calculate XE (divide HKD / USD)
            newRows[index].hkXe = (hkd / usd).toFixed(4);
          }
        }
      }
      
      // Auto-calculate currency conversions for Dubai
      if (field === 'dubaiUsd' || field === 'dubaiXe' || field === 'dubaiAed') {
        const usd = parseFloat(String(newRows[index].dubaiUsd)) || 0;
        const xe = parseFloat(String(newRows[index].dubaiXe)) || 0;
        const aed = parseFloat(String(newRows[index].dubaiAed)) || 0;
        
        // Count how many values are present (greater than 0)
        const valuesCount = [usd, xe, aed].filter(v => v > 0).length;
        
        // Only calculate if at least 2 values exist
        if (valuesCount >= 2) {
          // Calculate the missing value when any two values exist
          // Priority: don't overwrite the field being edited
          if (field !== 'dubaiAed' && usd > 0 && xe > 0) {
            // If USD and XE exist, calculate AED (multiply USD * XE)
            newRows[index].dubaiAed = (usd * xe).toFixed(2);
          } else if (field !== 'dubaiUsd' && aed > 0 && xe > 0) {
            // If AED and XE exist, calculate USD (divide AED / XE)
            newRows[index].dubaiUsd = (aed / xe).toFixed(2);
          } else if (field !== 'dubaiXe' && usd > 0 && aed > 0) {
            // If USD and AED exist, calculate XE (divide AED / USD)
            newRows[index].dubaiXe = (aed / usd).toFixed(4);
          }
        }
      }
      
      return newRows;
    });
  };

  const addRow = () => {
    setRows(prevRows => [...prevRows, createEmptyRow(prevRows.length)]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      setRows(prevRows => prevRows.filter((_, i) => i !== index));
    }
  };

  const duplicateRow = (index: number) => {
    setRows(prevRows => {
      const newRow = { ...prevRows[index], sequence: prevRows.length + 1 };
      // Clear unique fields
      newRow.uniqueListingNo = '';
      newRow.supplierListingNumber = '';
      newRow.tags = '';
      return [...prevRows, newRow];
    });
  };

  const fillDown = (rowIndex: number, columnKey: string) => {
    if (rowIndex === rows.length - 1) return;
    const value = rows[rowIndex][columnKey as keyof ProductRowData];
    updateRow(rowIndex + 1, columnKey as keyof ProductRowData, value);
  };

  const fillAllBelow = (rowIndex: number, columnKey: string) => {
    const value = rows[rowIndex][columnKey as keyof ProductRowData];
    setRows(prevRows => prevRows.map((row, idx) => 
      idx > rowIndex ? { ...row, [columnKey]: value } : row
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Set current time for start time if not entered
    const currentTime = new Date().toISOString();
    const updatedRows = rows.map(row => ({
      ...row,
      startTime: row.startTime || currentTime
    }));
    setRows(updatedRows);
    
    // Validate required fields
    const errors: string[] = [];
      updatedRows.forEach((row, index) => {
        if (!row.skuFamilyId) errors.push(`Row ${index + 1}: SKU Family is required`);
        if (!row.subModelName) errors.push(`Row ${index + 1}: SubModelName is required`);
        if (!row.storage) errors.push(`Row ${index + 1}: Storage is required`);
        if (!row.colour) errors.push(`Row ${index + 1}: Colour is required`);
        if (!row.country) errors.push(`Row ${index + 1}: Country is required`);
        if (!row.sim) errors.push(`Row ${index + 1}: SIM is required`);
        if (!row.grade) errors.push(`Row ${index + 1}: GRADE is required`);
        if (!row.status) errors.push(`Row ${index + 1}: STATUS is required`);
        if (!row.lockUnlock) errors.push(`Row ${index + 1}: LOCK/UNLOCK is required`);
        if (!row.packing) errors.push(`Row ${index + 1}: PACKING is required`);
        if (!row.currentLocation) errors.push(`Row ${index + 1}: CURRENT LOCATION is required`);
        if (!row.totalQty) errors.push(`Row ${index + 1}: TOTAL QTY is required`);
        if (!row.moqPerVariant) errors.push(`Row ${index + 1}: MOQ/VARIANT is required`);
        if (!row.supplierId) errors.push(`Row ${index + 1}: SUPPLIER ID is required`);
        if (!row.supplierListingNumber) errors.push(`Row ${index + 1}: SUPPLIER LISTING NO is required`);
        if (!row.paymentTerm || (Array.isArray(row.paymentTerm) && row.paymentTerm.length === 0)) {
          errors.push(`Row ${index + 1}: PAYMENT TERM is required`);
        }
        if (!row.paymentMethod || (Array.isArray(row.paymentMethod) && row.paymentMethod.length === 0)) {
          errors.push(`Row ${index + 1}: PAYMENT METHOD is required`);
        }
        if (!row.endTime) errors.push(`Row ${index + 1}: END TIME is required`);
      });

    if (errors.length > 0) {
      // Use a better error display
      const errorMessage = `Please fix the following ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n\n... and ${errors.length - 10} more errors` : ''}`;
      if (window.confirm(errorMessage + '\n\nDo you want to continue anyway?')) {
        // User wants to continue despite errors
      } else {
        return;
      }
    }

    const rowsWithListingNos = updatedRows.map((row, index) => {
      // Ensure unique listing number is set (8-digit)
      let uniqueListingNo = row.uniqueListingNo;
      if (!uniqueListingNo && currentUniqueListingNumber !== null) {
        uniqueListingNo = String(currentUniqueListingNumber + index).padStart(8, '0');
      } else if (!uniqueListingNo) {
        // Fallback: generate 8-digit number starting from 10000000
        uniqueListingNo = String(10000000 + index).padStart(8, '0');
      }
      return {
        ...row,
        uniqueListingNo: uniqueListingNo,
      };
    });
    
    if (variantType === 'multi' && !totalMoq) {
      toastHelper.showTost('MOQ PER CART is required for multi-variant products', 'error');
      return;
    }
    
    // If editing, bypass margin/cost flow and directly save
    if (editProducts && editProducts.length > 0) {
      // Direct save for edit mode - preserve existing margins and costs
      onSave(rowsWithListingNos, variantType === 'multi' ? totalMoq : undefined);
      return;
    }
    
    // Store rows and open margin modal (only for create mode)
    setPendingRows(rowsWithListingNos);
    setPendingTotalMoq(variantType === 'multi' ? totalMoq : undefined);
    setShowMarginModal(true);
  };

  // Handle margin selection
  const handleMarginNext = (selection: MarginSelection) => {
    setMarginSelection(selection);
    setShowMarginModal(false);
    
    // Check which countries have products
    const hasHKProducts = pendingRows.some(r => r.hkUsd || r.hkHkd);
    const hasDubai = pendingRows.some(r => r.dubaiUsd || r.dubaiAed);
    
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

  // Handle cost selection
  const handleCostNext = (costs: SelectedCost[]) => {
    if (currentCostCountry) {
      setSelectedCosts(prev => ({
        ...prev,
        [currentCostCountry]: costs,
      }));
    }
    
    setShowCostModal(false);
    
    // Check if we need to open cost modal for other country
    const hasDubai = pendingRows.some(r => r.dubaiUsd || r.dubaiAed);
    
    if (currentCostCountry === 'Hongkong' && hasDubai) {
      setCurrentCostCountry('Dubai');
      setShowCostModal(true);
    } else {
      // All countries processed, proceed to calculation
      proceedToCalculation();
    }
  };

  // Calculate prices and show preview
  const proceedToCalculation = async () => {
    try {
      setLoading(true);
      
      // Fetch SKU Family data to get brand and product category codes
      const skuFamilyMap = new Map();
      
      // Fetch all SKU families and create a map by _id
      try {
        const skuFamilyResponse = await SkuFamilyService.getSkuFamilyList(1, 10000);
        if (skuFamilyResponse?.data?.docs) {
          skuFamilyResponse.data.docs.forEach((skuFamily: any) => {
            skuFamilyMap.set(skuFamily._id, skuFamily);
          });
        }
      } catch (error) {
        console.error('Failed to fetch SKU Families:', error);
      }
      
      // Fetch seller data to get seller codes
      const sellerMap = new Map();
      
      // Fetch all sellers and create a map by _id
      try {
        const sellerResponse = await SellerService.getSellerList({ page: 1, limit: 10000 });
        if (sellerResponse?.docs) {
          sellerResponse.docs.forEach((seller: any) => {
            sellerMap.set(seller._id, seller);
          });
        }
      } catch (error) {
        console.error('Failed to fetch sellers:', error);
      }
      
      // Prepare products for calculation
      const productsForCalculation = await Promise.all(pendingRows.map(async (row) => {
        const countryDeliverables: any[] = [];
        
        // For Hongkong: Create USD entry
        if (row.hkUsd) {
          countryDeliverables.push({
            country: 'Hongkong',
            currency: 'USD',
            basePrice: parseFloat(String(row.hkUsd)) || 0,
            exchangeRate: parseFloat(String(row.hkXe)) || null,
            // Legacy fields
            usd: parseFloat(String(row.hkUsd)) || 0,
            xe: parseFloat(String(row.hkXe)) || 0,
            local: parseFloat(String(row.hkHkd)) || 0,
            hkd: parseFloat(String(row.hkHkd)) || 0,
          });
        }
        
        // For Dubai: Create USD entry
        if (row.dubaiUsd) {
          countryDeliverables.push({
            country: 'Dubai',
            currency: 'USD',
            basePrice: parseFloat(String(row.dubaiUsd)) || 0,
            exchangeRate: parseFloat(String(row.dubaiXe)) || null,
            // Legacy fields
            usd: parseFloat(String(row.dubaiUsd)) || 0,
            xe: parseFloat(String(row.dubaiXe)) || 0,
            local: parseFloat(String(row.dubaiAed)) || 0,
            aed: parseFloat(String(row.dubaiAed)) || 0,
          });
        }

        const skuFamily = skuFamilyMap.get(row.skuFamilyId);
        const seller = sellerMap.get(row.supplierId);

        // Extract brand code - should be populated from list endpoint
        let brandCode = '';
        if (skuFamily?.brand) {
          if (skuFamily.brand && typeof skuFamily.brand === 'object' && skuFamily.brand.code) {
            brandCode = skuFamily.brand.code;
          }
        }

        // Extract product category code - should be populated from list endpoint
        let productCategoryCode = '';
        if (skuFamily?.productcategoriesId) {
          if (skuFamily.productcategoriesId && typeof skuFamily.productcategoriesId === 'object' && skuFamily.productcategoriesId.code) {
            productCategoryCode = skuFamily.productcategoriesId.code;
          }
        }

        return {
          ...row,
          countryDeliverables,
          sellerCode: seller?.code || '',
          brandCode: brandCode,
          productCategoryCode: productCategoryCode,
          conditionCode: row.condition || '',
          moq: parseFloat(String(row.moqPerVariant)) || 1,
          weight: parseFloat(String(row.weight)) || 0,
        };
      }));

      // Prepare selected costs by country
      const selectedCostsByCountry: Record<string, string[]> = {
        Hongkong: selectedCosts.Hongkong.map(c => c.costId),
        Dubai: selectedCosts.Dubai.map(c => c.costId),
      };

      // Call calculation API
      if (!marginSelection) {
        toastHelper.showTost('Margin selection is required', 'error');
        setLoading(false);
        return;
      }
      // Convert MarginSelection to Record<string, boolean>
      const marginSelectionRecord: Record<string, boolean> = {
        brand: marginSelection.brand,
        productCategory: marginSelection.productCategory,
        conditionCategory: marginSelection.conditionCategory,
        sellerCategory: marginSelection.sellerCategory,
        customerCategory: marginSelection.customerCategory,
      };
      const response = await ProductService.calculateProductPrices(
        productsForCalculation,
        marginSelectionRecord,
        selectedCostsByCountry
      );

      if (response.data && response.data.products) {
        // Map response to ProductCalculationResult format
        const results: ProductCalculationResult[] = response.data.products.map((product: any, index: number) => ({
          product: pendingRows[index],
          countryDeliverables: product.countryDeliverables.map((cd: any) => ({
            country: cd.country,
            basePrice: cd.basePrice,
            calculatedPrice: cd.calculatedPrice,
            margins: cd.margins || [],
            costs: cd.costs || [],
            exchangeRate: cd.xe,
            // Preserve local currency calculations for preview rendering
            hkd: cd.hkd,
            aed: cd.aed,
          })),
        }));
        
        setCalculationResults(results);
        setShowPreviewModal(true);
      }
    } catch (error: any) {
      toastHelper.showTost(error.message || 'Failed to calculate prices', 'error');
      console.error('Calculation error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle final submit
  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      
      // Transform calculation results back to product format with calculated prices
      // IMPORTANT: Each calculation result represents ONE product row, and we create ONE product per row
      // with ALL countryDeliverables combined (USD + local currency for each country)
      const productsToCreate = calculationResults.map((result) => {
        const row = result.product;
        
        // Build countryDeliverables with calculated prices
        // Each country can have USD and local currency (HKD for Hongkong, AED for Dubai)
        // Helper to convert empty strings to null
        const cleanString = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          return val;
        };
        
        const countryDeliverables: any[] = [];
        
        // Track which countries we've processed to avoid duplicates
        const processedCountries = new Set<string>();
        
        result.countryDeliverables.forEach(cd => {
          const countryKey = `${cd.country}_USD`;
          
          // Only process each country once
          if (processedCountries.has(countryKey)) {
            return;
          }
          processedCountries.add(countryKey);
          
          // Add USD entry (always required)
          const usdBasePrice = cd.basePrice || 0;
          const usdCalculatedPrice = cd.calculatedPrice || 0;
          
          countryDeliverables.push({
            country: cd.country,
            currency: 'USD',
            basePrice: usdBasePrice,
            calculatedPrice: usdCalculatedPrice,
            exchangeRate: null,
            margins: cd.margins || [],
            costs: cd.costs || [],
            charges: [],
            // Legacy fields
            usd: usdCalculatedPrice,
            xe: cd.exchangeRate || null,
            price: usdBasePrice,
          });
          
          // Add local currency entry if exchange rate exists
          if (cd.exchangeRate && cd.country === 'Hongkong') {
            const exchangeRate = cd.exchangeRate;
            const hkdBasePrice = (cd.basePrice || 0) * exchangeRate;
            const hkdCalculatedPrice = (cd.calculatedPrice || 0) * exchangeRate;
            countryDeliverables.push({
              country: 'Hongkong',
              currency: 'HKD',
              basePrice: hkdBasePrice,
              calculatedPrice: hkdCalculatedPrice,
              exchangeRate: exchangeRate, // XE rate from product
              margins: (cd.margins || []).map(m => ({
                ...m,
                calculatedAmount: (m.calculatedAmount || 0) * exchangeRate,
              })),
              costs: (cd.costs || []).map(c => ({
                ...c,
                calculatedAmount: (c.calculatedAmount || 0) * exchangeRate,
              })),
              charges: [],
              // Legacy fields
              hkd: hkdCalculatedPrice,
              local: hkdCalculatedPrice,
            });
          } else if (cd.exchangeRate && cd.country === 'Dubai') {
            const exchangeRate = cd.exchangeRate;
            const aedBasePrice = (cd.basePrice || 0) * exchangeRate;
            const aedCalculatedPrice = (cd.calculatedPrice || 0) * exchangeRate;
            countryDeliverables.push({
              country: 'Dubai',
              currency: 'AED',
              basePrice: aedBasePrice,
              calculatedPrice: aedCalculatedPrice,
              exchangeRate: exchangeRate, // System currency conversion rate
              margins: (cd.margins || []).map(m => ({
                ...m,
                calculatedAmount: (m.calculatedAmount || 0) * exchangeRate,
              })),
              costs: (cd.costs || []).map(c => ({
                ...c,
                calculatedAmount: (c.calculatedAmount || 0) * exchangeRate,
              })),
              charges: [],
              // Legacy fields
              aed: aedCalculatedPrice,
              local: aedCalculatedPrice,
            });
          }
        });
        
        // Remove duplicates based on country + currency combination
        const uniqueCountryDeliverables = countryDeliverables.filter((cd, index, self) =>
          index === self.findIndex((t) => t.country === cd.country && t.currency === cd.currency)
        );

        return {
          skuFamilyId: row.skuFamilyId,
          gradeId: (row.grade && /^[0-9a-fA-F]{24}$/.test(row.grade)) ? row.grade : null,
          sellerId: (row.supplierId && /^[0-9a-fA-F]{24}$/.test(row.supplierId)) ? row.supplierId : null,
          specification: cleanString(row.subModelName) || cleanString(row.version) || cleanString((row as any).specification) || '',
          simType: row.sim || '',
          color: row.colour || '',
          ram: cleanString(row.ram) || '',
          storage: row.storage || '',
          weight: row.weight ? parseFloat(String(row.weight)) : null,
          condition: cleanString(row.condition) || null,
          stock: parseFloat(String(row.totalQty)) || 0,
          country: (cleanString(row.country) || null) as string | null,
          moq: parseFloat(String(row.moqPerVariant)) || 1,
          purchaseType: (row.purchaseType === 'full' || row.purchaseType === 'partial') ? row.purchaseType : 'partial',
          isNegotiable: row.negotiableFixed === '1',
          isFlashDeal: row.flashDeal && (row.flashDeal === '1' || row.flashDeal === 'true' || row.flashDeal.toLowerCase() === 'yes') ? 'true' : 'false',
          startTime: cleanString(row.startTime) ? new Date(row.startTime).toISOString() : '',
          expiryTime: cleanString(row.endTime) ? new Date(row.endTime).toISOString() : '',
          groupCode: variantType === 'multi' ? `GROUP-${Date.now()}` : undefined,
          sequence: row.sequence || null,
          countryDeliverables: uniqueCountryDeliverables,
          supplierListingNumber: cleanString(row.supplierListingNumber) || '',
          customerListingNumber: cleanString(row.customerListingNumber) || '',
          packing: cleanString(row.packing) || '',
          currentLocation: cleanString(row.currentLocation) || '',
          deliveryLocation: Array.isArray(row.deliveryLocation) 
            ? row.deliveryLocation 
            : (row.deliveryLocation && typeof row.deliveryLocation === 'string' 
                ? (() => {
                    try {
                      const parsed = JSON.parse(row.deliveryLocation);
                      return Array.isArray(parsed) ? parsed : [row.deliveryLocation];
                    } catch {
                      return [row.deliveryLocation];
                    }
                  })()
                : []),
          customMessage: cleanString(row.customMessage) || '',
          totalMoq: variantType === 'multi' && pendingTotalMoq ? parseFloat(String(pendingTotalMoq)) : null,
          // Collect custom fields
          customFields: (() => {
            const customFieldsMap: Record<string, string> = {};
            customColumns.forEach(customCol => {
              const value = row[customCol.key as keyof ProductRowData];
              if (value && typeof value === 'string' && value.trim()) {
                customFieldsMap[customCol.key] = value.trim();
              }
            });
            return Object.keys(customFieldsMap).length > 0 ? customFieldsMap : undefined;
          })(),
          paymentTerm: (() => {
            if (!row.paymentTerm) return [];
            if (Array.isArray(row.paymentTerm)) return row.paymentTerm;
            if (typeof row.paymentTerm === 'string') {
              return row.paymentTerm.trim() ? [row.paymentTerm.trim()] : [];
            }
            return [];
          })(),
          paymentMethod: (() => {
            if (!row.paymentMethod) return [];
            if (Array.isArray(row.paymentMethod)) return row.paymentMethod;
            if (typeof row.paymentMethod === 'string') {
              return row.paymentMethod.trim() ? [row.paymentMethod.trim()] : [];
            }
            return [];
          })(),
          shippingTime: cleanString(row.shippingTime) || '',
          deliveryTime: cleanString(row.deliveryTime) || '',
          vendor: cleanString(row.vendor) || null,
          vendorListingNo: cleanString(row.vendorListingNo) || '',
          carrier: cleanString(row.carrier) || null,
          carrierListingNo: cleanString(row.carrierListingNo) || '',
          uniqueListingNo: cleanString(row.uniqueListingNo) || '',
          tags: cleanString(row.tags) || '',
          adminCustomMessage: cleanString(row.adminCustomMessage) || '',
          remark: cleanString(row.remark) || '',
          warranty: cleanString(row.warranty) || '',
          batteryHealth: cleanString(row.batteryHealth) || '',
          lockUnlock: row.lockUnlock === '1',
        };
      });

      // Create all products
      const createPromises = productsToCreate.map(product => 
        ProductService.createProduct(product)
      );

      await Promise.all(createPromises);
      
      // Clear localStorage on successful save
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }
      
      toastHelper.showTost('Products created successfully!', 'success');
      setShowPreviewModal(false);
      // Products are already created in handleFinalSubmit
      // Don't call onSave here as it would trigger handleFormSave in ProductVariantForm
      // which would create duplicate products
      // Navigate to products list after a short delay
      setTimeout(() => {
        window.location.href = '/adminapp/#/products';
      }, 1000);
    } catch (error: any) {
      console.error('Error creating products:', error);
      toastHelper.showTost(error.message || 'Failed to create products', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Column definitions
  const columns = [
    { key: 'supplierId', label: 'SUPPLIER ID*', width: 130, group: 'Supplier Info' },
    { key: 'supplierListingNumber', label: 'SUPPLIER LISTING NO*', width: 180, group: 'Supplier Info' },
    { key: 'customerListingNumber', label: 'CUSTOMER LISTING NO*', width: 180, group: 'Supplier Info' },
    { key: 'skuFamilyId', label: 'SKU Family*', width: 200, group: 'Product Detail' },
    { key: 'subModelName', label: 'SubModelName*', width: 150, group: 'Product Detail' },
    { key: 'storage', label: 'Storage*', width: 100, group: 'Product Detail' },
    { key: 'colour', label: 'Colour*', width: 100, group: 'Product Detail' },
    { key: 'country', label: 'Country*', width: 120, group: 'Product Detail' },
    { key: 'sim', label: 'SIM*', width: 120, group: 'Product Detail' },
    { key: 'version', label: 'VERSION', width: 120, group: 'Product Detail' },
    { key: 'grade', label: 'GRADE*', width: 120, group: 'Product Detail' },
    { key: 'status', label: 'STATUS*', width: 100, group: 'Product Detail' },
    { key: 'condition', label: 'CONDITION', width: 120, group: 'Product Detail' },
    { key: 'lockUnlock', label: 'LOCK/UNLOCK*', width: 120, group: 'Product Detail' },
    { key: 'warranty', label: 'WARRANTY', width: 120, group: 'Product Detail' },
    { key: 'batteryHealth', label: 'BATTERY HEALTH', width: 130, group: 'Product Detail' },
    { key: 'packing', label: 'PACKING*', width: 120, group: 'Pricing/Delivery' },
    { key: 'currentLocation', label: 'CURRENT LOCATION*', width: 150, group: 'Pricing/Delivery' },
    { key: 'hkUsd', label: 'USD', width: 100, group: 'HK DELIVERY', subgroup: 'HK' },
    { key: 'hkXe', label: 'XE', width: 100, group: 'HK DELIVERY', subgroup: 'HK' },
    { key: 'hkHkd', label: 'HKD', width: 100, group: 'HK DELIVERY', subgroup: 'HK' },
    { key: 'dubaiUsd', label: 'USD', width: 110, group: 'DUBAI DELIVERY', subgroup: 'DUBAI' },
    { key: 'dubaiXe', label: 'XE', width: 110, group: 'DUBAI DELIVERY', subgroup: 'DUBAI' },
    { key: 'dubaiAed', label: 'AED', width: 110, group: 'DUBAI DELIVERY', subgroup: 'DUBAI' },
    { key: 'deliveryLocation', label: 'DELIVERY LOCATION', width: 150, group: 'Pricing/Delivery' },
    { key: 'customMessage', label: 'CUSTOM MESSAGE', width: 150, group: 'Pricing/Delivery' },
    { key: 'totalQty', label: 'TOTAL QTY*', width: 100, group: 'Pricing/Delivery' },
    { key: 'moqPerVariant', label: 'MOQ/VARIANT*', width: 120, group: 'Pricing/Delivery' },
    { key: 'weight', label: 'WEIGHT', width: 100, group: 'Pricing/Delivery' },
    { key: 'purchaseType', label: 'PURCHASE TYPE*', width: 130, group: 'Pricing/Delivery' },
    ...(variantType === 'multi' ? [{ key: 'totalMoq', label: 'MOQ PER CART*', width: 150, group: 'Pricing/Delivery' }] : []),
    { key: 'paymentTerm', label: 'PAYMENT TERM*', width: 200, group: 'Payment' },
    { key: 'paymentMethod', label: 'PAYMENT METHOD*', width: 200, group: 'Payment' },
    { key: 'negotiableFixed', label: 'NEGOTIABLE/FIXED', width: 150, group: 'Other Info' },
    { key: 'flashDeal', label: 'FLASH DEAL', width: 130, group: 'Other Info' },
    { key: 'shippingTime', label: 'SHIPPING TIME', width: 130, group: 'Other Info' },
    { key: 'deliveryTime', label: 'DELIVERY TIME', width: 130, group: 'Other Info' },
    { key: 'vendor', label: 'VENDOR', width: 100, group: 'Other Info' },
    { key: 'vendorListingNo', label: 'VENDOR LISTING NO', width: 150, group: 'Other Info' },
    { key: 'carrier', label: 'CARRIER', width: 100, group: 'Other Info' },
    { key: 'carrierListingNo', label: 'CARRIER LISTING NO', width: 150, group: 'Other Info' },
    { key: 'uniqueListingNo', label: 'UNIQUE LISTING NO', width: 150, group: 'Other Info' },
    { key: 'tags', label: 'TAGS', width: 150, group: 'Other Info' },
    { key: 'adminCustomMessage', label: 'ADMIN CUSTOM MESSAGE', width: 180, group: 'Other Info' },
    { key: 'startTime', label: 'START TIME', width: 150, group: 'Other Info' },
    { key: 'endTime', label: 'END TIME *', width: 150, group: 'Other Info' },
    { key: 'remark', label: 'REMARK', width: 150, group: 'Other Info' },
    ...customColumns, // Add dynamic custom columns
  ];

  // Get country options from constants (show name, store code)
  const countryOptions = constants?.spec?.COUNTRY || [];
  
  // Get sim options based on selected country (will be filtered per row)
  const getSimOptionsForCountry = (countryCode: string) => {
    if (!constants?.spec?.COUNTRY) return [];
    const country = constants.spec.COUNTRY.find(c => c.code === countryCode);
    return country?.SIM || [];
  };
  
  // Get status options from constants (show name, store code)
  const statusOptions = constants?.status || [];
  
  const conditionOptions = ['AAA', 'A+', 'Mixed'];
  
  // Get lockStatus options from constants (show name, store code)
  const lockUnlockOptions = constants?.lockStatus || [];
  
  // Get packing options from constants (show name, store code)
  const packingOptions = constants?.packing || [];
  
  // Get currentLocation options from constants (show name, store code)
  const currentLocationOptions = constants?.currentLocation || [];
  
  // Get deliveryLocation options from constants (show name, store code)
  const deliveryLocationOptions = constants?.deliveryLocation || [];
  
  // Get paymentTerm and paymentMethod options from constants
  const paymentTermOptions = constants?.paymentTerm || [];
  const paymentMethodOptions = constants?.paymentMethod || [];
  
  // NegotiableStatus - using negotiableStatus from constants
  const negotiableFixedOptions = constants?.negotiableStatus || [];
  
  // Get vendor options from constants (show name, store code)
  const vendorOptions = constants?.vendor || [];
  
  // Get carrier options from constants (show name, store code)
  const carrierOptions = constants?.carrier || [];
  
  // Get flashDeal options from constants (show name, store code)
  const flashDealOptions = constants?.flashDeal || [];

  const renderCell = (row: ProductRowData, rowIndex: number, column: typeof columns[0]) => {
    const value = row[column.key as keyof ProductRowData];
    const cellId = `${rowIndex}-${column.key}`;

    switch (column.key) {
      case 'skuFamilyId':
        const selectedSkuFamily = skuFamilies.find(sku => sku._id === value);
        const displayValue = selectedSkuFamily?.name || '';
        const isRowSearchActive = rowSkuFamilySearch?.rowIndex === rowIndex;
        const rowSearchQuery = isRowSearchActive ? rowSkuFamilySearch.query : '';
        
        return (
          <div className="min-w-[150px] relative" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <div className="relative">
              <input
                ref={(el) => { cellRefs.current[cellId] = el; }}
                type="text"
                value={isRowSearchActive ? rowSearchQuery : displayValue}
                onChange={(e) => {
                  const query = e.target.value;
                  setRowSkuFamilySearch({ rowIndex, query, showResults: true });
                }}
                onFocus={() => {
                  setFocusedCell({ row: rowIndex, col: column.key });
                  setSelectedRowIndex(rowIndex);
                  if (!isRowSearchActive) {
                    // Start with empty query to show all options or current value
                    setRowSkuFamilySearch({ rowIndex, query: '', showResults: false });
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click on results
                  setTimeout(() => {
                    if (rowSkuFamilySearch?.rowIndex === rowIndex) {
                      setRowSkuFamilySearch(null);
                    }
                  }, 200);
                }}
                placeholder="Click to search SKU Family..."
                className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
              />
              {isRowSearchActive && (
                <i className="fas fa-search absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
              )}
            </div>
            {/* Row-specific Search Results Dropdown */}
            {isRowSearchActive && rowSkuFamilySearch?.showResults && rowSkuFamilySearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 w-[270px] border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-96 overflow-y-auto z-[100]">
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    Row {rowIndex + 1} - Select SKU Family
                  </div>
                </div>
                {rowSkuFamilySearchResults.map((option, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleRowSkuFamilySearchSelect(option, rowIndex)}
                    className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                          {option.skuFamilyName}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {option.subModelName && <span className="mr-2">Model: {option.subModelName}</span>}
                          {option.storage && <span className="mr-2">Storage: {option.storage}</span>}
                          {option.colour && <span className="mr-2">Color: {option.colour}</span>}
                          {option.ram && <span>RAM: {option.ram}</span>}
                        </div>
                      </div>
                      <i className="fas fa-arrow-right text-blue-500 text-xs mt-1"></i>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isRowSearchActive && rowSearchQuery && rowSkuFamilySearch?.showResults && rowSkuFamilySearchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 z-[100]">
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No results found
                </div>
              </div>
            )}
          </div>
        );

      case 'subModelName':
      case 'storage':
      case 'colour':
        return (
          <input
            ref={(el) => { cellRefs.current[cellId] = el; }}
            type="text"
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
            required={column.key === 'subModelName' || column.key === 'storage' || column.key === 'colour'}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
            placeholder="Enter value or use search"
          />
        );

      case 'country':
        return (
          <select
            value={value as string}
            onChange={(e) => {
              updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value);
              // Clear sim when country changes
              updateRow(rowIndex, 'sim', '');
            }}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">Select Country</option>
            {countryOptions.map(opt => (
              <option key={opt.code} value={opt.code} className="bg-white dark:bg-gray-800">
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'sim':
        const selectedCountryCode = row.country || '';
        const availableSimOptions = getSimOptionsForCountry(selectedCountryCode);
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            disabled={!selectedCountryCode}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">
              {!selectedCountryCode ? 'Select Country first' : 'Select SIM'}
            </option>
            {availableSimOptions.map(opt => (
              <option key={opt} value={opt} className="bg-white dark:bg-gray-800">
                {opt}
              </option>
            ))}
          </select>
        );

      case 'grade':
        return (
          <div className="min-w-[120px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              options={grades.map(g => ({ value: g._id, label: g.title }))}
              value={grades.find(g => g._id === value) ? { value: value as string, label: grades.find(g => g._id === value)?.title } : null}
              onChange={(opt) => updateRow(rowIndex, column.key as keyof ProductRowData, opt?.value || '')}
              className="text-xs"
              classNamePrefix="select"
              isSearchable
              placeholder="Select Grade"
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
              }}
            />
          </div>
        );

      case 'status':
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">Select Status</option>
            {statusOptions.map(opt => (
              <option key={opt.code} value={opt.code} className="bg-white dark:bg-gray-800">
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'condition':
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="bg-white dark:bg-gray-800">Select Condition</option>
            {conditionOptions.map(opt => <option key={opt} value={opt} className="bg-white dark:bg-gray-800">{opt}</option>)}
          </select>
        );

      case 'lockUnlock':
      case 'negotiableFixed':
        const options = column.key === 'lockUnlock' ? lockUnlockOptions : negotiableFixedOptions;
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            required={column.key === 'lockUnlock'}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">Select</option>
            {options.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'packing':
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {packingOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'vendor':
      case 'carrier':
        const selectOptions = column.key === 'vendor' ? vendorOptions : carrierOptions;
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {selectOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'flashDeal':
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {flashDealOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'paymentTerm':
        // Handle array of strings
        const selectedTerms = Array.isArray(value) 
          ? value.filter(t => t && t.trim() !== '')
          : (typeof value === 'string' && value.trim()
              ? value.split(',').map(t => t.trim()).filter(t => t)
              : []);
        const selectedTermOptions = paymentTermOptions
          .filter(opt => selectedTerms.includes(opt.code))
          .map(opt => ({ value: opt.code, label: opt.name }));
        
        return (
          <div className="min-w-[200px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              isMulti
              options={paymentTermOptions.map(opt => ({ value: opt.code, label: opt.name }))}
              value={selectedTermOptions}
              onChange={(selected) => {
                const selectedValues = selected ? selected.map(opt => opt.value) : [];
                updateRow(rowIndex, column.key as keyof ProductRowData, selectedValues);
              }}
              className="text-xs"
              classNamePrefix="select"
              isSearchable={false}
              placeholder="Select terms..."
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  minWidth: '200px',
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px', minHeight: '32px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
                multiValue: (provided) => ({
                  ...provided,
                  backgroundColor: '#dbeafe',
                  fontSize: '11px',
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
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
              required
            />
          </div>
        );

      case 'paymentMethod':
        // Handle array of strings
        const selectedMethods = Array.isArray(value) 
          ? value.filter(m => m && m.trim() !== '')
          : (typeof value === 'string' && value.trim()
              ? value.split(',').map(m => m.trim()).filter(m => m)
              : []);
        const selectedOptions = paymentMethodOptions
          .filter(opt => selectedMethods.includes(opt.code))
          .map(opt => ({ value: opt.code, label: opt.name }));
        
        return (
          <div className="min-w-[200px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              isMulti
              options={paymentMethodOptions.map(opt => ({ value: opt.code, label: opt.name }))}
              value={selectedOptions}
              onChange={(selected) => {
                const selectedValues = selected ? selected.map(opt => opt.value) : [];
                updateRow(rowIndex, column.key as keyof ProductRowData, selectedValues);
              }}
              className="text-xs"
              classNamePrefix="select"
              isSearchable={false}
              placeholder="Select methods..."
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  minWidth: '200px',
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px', minHeight: '32px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
                multiValue: (provided) => ({
                  ...provided,
                  backgroundColor: '#dbeafe',
                  fontSize: '11px',
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
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
              required
            />
          </div>
        );

      case 'currentLocation':
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {currentLocationOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'hkUsd':
      case 'hkXe':
      case 'hkHkd':
      case 'dubaiUsd':
      case 'dubaiXe':
      case 'dubaiAed':
      case 'totalQty':
      case 'moqPerVariant':
      case 'weight':
        return (
          <input
            type="number"
            step={column.key.includes('Xe') || column.key.includes('XE') ? '0.0001' : '0.01'}
            value={value as string | number}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 text-right font-medium placeholder:text-gray-400"
            placeholder="0.00"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          />
        );

      case 'purchaseType':
        return (
          <select
            value={value as string || 'partial'}
            onChange={(e) => {
              updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value);
              // If changed to 'full', set MOQ to equal stock
              if (e.target.value === 'full') {
                updateRow(rowIndex, 'moqPerVariant', row.totalQty || 1);
              }
            }}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="partial">Partial</option>
            <option value="full">Full</option>
          </select>
        );

      case 'totalMoq':
        // Only render in first row, will span all rows
        if (rowIndex === 0 && variantType === 'multi') {
          return (
            <div className="flex flex-col items-center justify-center w-full h-full py-2">
              <input
                type="number"
                step="0.01"
                value={totalMoq}
                onChange={(e) => setTotalMoq(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border-2 border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-medium text-center"
                placeholder="0.00"
                required
                onFocus={() => {
                  setFocusedCell({ row: rowIndex, col: column.key });
                  setSelectedRowIndex(rowIndex);
                }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                All {rows.length} products
              </span>
            </div>
          );
        }
        // Don't render for other rows or single variant
        return null;

      case 'deliveryLocation':
        const deliveryValue = Array.isArray(value) ? value : (value ? [value] : []);
        const deliveryDisplayNames = deliveryValue
          .map(code => {
            const option = deliveryLocationOptions.find(opt => opt.code === code);
            return option ? option.name : code;
          })
          .filter(Boolean);
        
        return (
          <div 
            className="w-full px-2 py-1.5 min-h-[32px] flex items-center"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            {deliveryDisplayNames.length > 0 ? (
              deliveryDisplayNames.map((name, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md text-xs font-medium text-blue-800 dark:text-blue-300"
                >
                  {/* <i className="fas fa-map-marker-alt mr-1.5 text-[10px]"></i> */}
                  {name}{idx < deliveryDisplayNames.length - 1 ? ',' : ''} 
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                Auto-calculated
              </span>
            )}
          </div>
        );

      case 'startTime':
      case 'endTime':
        return (
          <DatePicker
            selected={value ? new Date(value as string) : null}
            onChange={(date) => updateRow(rowIndex, column.key as keyof ProductRowData, date ? date.toISOString() : '')}
            showTimeSelect
            timeFormat="HH:mm"
            dateFormat="yyyy-MM-dd HH:mm"
            className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
            placeholderText={column.key === 'startTime' ? "Select date & time (auto: current time)" : "Select date & time *"}
            required={column.key === 'endTime'}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
            wrapperClassName="w-full"
          />
        );

      case 'supplierId':
        const isDropdownOpen = openSupplierDropdown?.row === rowIndex && openSupplierDropdown?.isOpen;
        const currentSearchQuery = supplierSearchQuery?.row === rowIndex ? supplierSearchQuery.query : '';
        const selectedSupplier = sellers.find(s => s._id === value);
        
        // Filter sellers based on search query
        const filteredSellers = currentSearchQuery
          ? sellers.filter(s => {
              const searchLower = currentSearchQuery.toLowerCase();
              const nameMatch = s.name?.toLowerCase().includes(searchLower);
              const codeMatch = s.code?.toLowerCase().includes(searchLower);
              return nameMatch || codeMatch;
            })
          : sellers;

        return (
          <div className="relative min-w-[130px] supplier-dropdown-container">
            <div
              onClick={() => {
                setOpenSupplierDropdown({ row: rowIndex, isOpen: !isDropdownOpen });
                setSupplierSearchQuery({ row: rowIndex, query: '' });
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
              className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer flex items-center justify-between"
            >
              <span className={selectedSupplier ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
                {selectedSupplier 
                  ? `${selectedSupplier.name}${selectedSupplier.code ? ` (${selectedSupplier.code})` : ''}`
                  : 'Click to select supplier...'}
              </span>
              <i className={`fas fa-chevron-${isDropdownOpen ? 'up' : 'down'} text-gray-400 text-xs ml-2`}></i>
            </div>
            
            {/* Custom Dropdown with Search */}
            {isDropdownOpen && (
              <div className="absolute top-full w-[230px] left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-[10000] overflow-hidden">
                {/* Search Input at Top */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="relative">
                    <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input
                      type="text"
                      placeholder="Type to search supplier..."
                      value={currentSearchQuery}
                      onChange={(e) => setSupplierSearchQuery({ row: rowIndex, query: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                
                {/* Options List */}
                <div className="max-h-[300px] overflow-y-auto">
                  {filteredSellers.length > 0 ? (
                    filteredSellers.map((seller) => (
                      <div
                        key={seller._id}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateRow(rowIndex, column.key as keyof ProductRowData, seller._id);
                          setOpenSupplierDropdown({ row: rowIndex, isOpen: false });
                          setSupplierSearchQuery({ row: rowIndex, query: '' });
                        }}
                        className={`px-4 py-3 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors ${
                          value === seller._id
                            ? 'bg-blue-100 dark:bg-blue-900/30 font-semibold'
                            : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {seller.name}
                            </div>
                            {seller.code && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Code: {seller.code}
                              </div>
                            )}
                          </div>
                          {value === seller._id && (
                            <i className="fas fa-check text-blue-600 dark:text-blue-400 text-sm"></i>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      {currentSearchQuery ? `No supplier found for "${currentSearchQuery}"` : 'No suppliers available'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 'uniqueListingNo':
        return (
          <div className="relative">
            <input
              type="text"
              value={value as string}
              className="w-full px-2 py-1.5 text-xs border-0 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 italic"
              readOnly
              placeholder="Auto-generated"
            />
            <i className="fas fa-barcode absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
          </div>
        );

      case 'supplierListingNumber':
        return (
          <div className="relative">
            <input
              type="text"
              value={value as string}
              className="w-full px-2 py-1.5 text-xs border-0 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 italic"
              readOnly
              placeholder="Auto-generated"
            />
            <i className="fas fa-tag absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
          </div>
        );

      case 'customerListingNumber':
        return (
          <div className="relative">
            <input
              type="text"
              value={value as string}
              className="w-full px-2 py-1.5 text-xs border-0 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 italic"
              readOnly
              placeholder="Auto-generated"
            />
            <i className="fas fa-tag absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
          </div>
        );

      case 'tags':
        const tagOptions = constants?.tags || [];
        // Convert comma-separated string of tag codes to array for react-select
        const selectedTagCodes = (value as string) 
          ? (value as string).split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t))
          : [];
        const selectedTagOptions = tagOptions
          .filter(tag => selectedTagCodes.includes(tag.code))
          .map(tag => ({ value: String(tag.code), label: tag.tag }));
        
        return (
          <div className="min-w-[150px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              isMulti
              options={tagOptions.map(tag => ({ value: String(tag.code), label: tag.tag }))}
              value={selectedTagOptions}
              onChange={(selected) => {
                const selectedValues = selected ? selected.map(opt => opt.value).join(', ') : '';
                updateRow(rowIndex, column.key as keyof ProductRowData, selectedValues);
              }}
              className="text-xs"
              classNamePrefix="select"
              isSearchable={false}
              placeholder="Select tags..."
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px', minHeight: '32px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
                multiValue: (provided) => ({
                  ...provided,
                  backgroundColor: '#dbeafe',
                  fontSize: '11px',
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
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
            />
          </div>
        );

      case 'shippingTime':
        const shippingTimeValue = value as string;
        
        // Helper function to format date as YYYY-MM-DD
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        // Helper function to get today's date
        const getToday = (): Date => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return today;
        };
        
        // Helper function to get tomorrow's date
        const getTomorrow = (): Date => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          return tomorrow;
        };
        
        // Determine current selected date value and detect mode from value
        let selectedDate: Date | null = null;
        let detectedMode: 'today' | 'tomorrow' | 'calendar' | '' = '';
        
        if (shippingTimeValue) {
          try {
            const dateValue = new Date(shippingTimeValue);
            dateValue.setHours(0, 0, 0, 0);
            selectedDate = dateValue;
            
            // Auto-detect if it's today or tomorrow
            const todayStr = formatDate(getToday());
            const tomorrowStr = formatDate(getTomorrow());
            const valueStr = formatDate(dateValue);
            
            if (valueStr === todayStr) {
              detectedMode = 'today';
            } else if (valueStr === tomorrowStr) {
              detectedMode = 'tomorrow';
            } else {
              detectedMode = 'calendar';
            }
          } catch (e) {
            selectedDate = null;
            detectedMode = '';
          }
        }
        
        // Use stored mode if exists, otherwise use detected mode
        const storedMode = shippingTimeMode[rowIndex];
        const currentMode = storedMode || detectedMode;
        
        return (
          <div className="w-full" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            {/* Dropdown for selection */}
            <select
              value={currentMode || ''}
              onChange={(e) => {
                const selectedMode = e.target.value as 'today' | 'tomorrow' | 'calendar' | '';
                const newMode = selectedMode || '';
                
                // Update mode state
                setShippingTimeMode((prev) => {
                  const updated = { ...prev };
                  if (newMode === '' || newMode === 'today' || newMode === 'tomorrow' || newMode === 'calendar') {
                    updated[rowIndex] = newMode;
                  }
                  return updated;
                });
                
                if (selectedMode === 'today') {
                  const today = getToday();
                  const todayStr = formatDate(today);
                  updateRow(rowIndex, column.key as keyof ProductRowData, todayStr);
                } else if (selectedMode === 'tomorrow') {
                  const tomorrow = getTomorrow();
                  const tomorrowStr = formatDate(tomorrow);
                  updateRow(rowIndex, column.key as keyof ProductRowData, tomorrowStr);
                } else if (selectedMode === 'calendar') {
                  // Keep existing value or set to today if empty
                  if (!shippingTimeValue) {
                    const today = getToday();
                    const todayStr = formatDate(today);
                    updateRow(rowIndex, column.key as keyof ProductRowData, todayStr);
                  }
                } else {
                  // Clear value when "Select shipping time" is chosen
                  updateRow(rowIndex, column.key as keyof ProductRowData, '');
                }
              }}
              className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
            >
              <option value="">Select shipping time</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="calendar">Calendar</option>
            </select>
            
            {/* Show date picker only when calendar is selected */}
            {(currentMode === 'calendar' || currentMode === '') && (
              <div className="mt-1">
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => {
                    if (date) {
                      const dateStr = formatDate(date);
                      updateRow(rowIndex, column.key as keyof ProductRowData, dateStr);
                    } else {
                      updateRow(rowIndex, column.key as keyof ProductRowData, '');
                    }
                  }}
                  dateFormat="yyyy-MM-dd"
                  className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
                  placeholderText="Select date"
                  minDate={getToday()}
                  onFocus={() => {
                    setFocusedCell({ row: rowIndex, col: column.key });
                    setSelectedRowIndex(rowIndex);
                  }}
                  wrapperClassName="w-full"
                />
              </div>
            )}
          </div>
        );

      default:
        // Handle custom dynamic columns
        if (customColumns.some(cc => cc.key === column.key)) {
          return (
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
              className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
              placeholder="Enter value..."
            />
          );
        }
        // Default case for other fields
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
            required={column.key === 'supplierListingNumber'}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
            placeholder={column.key.includes('message') || column.key.includes('Message') ? 'Enter message...' : 'Enter value...'}
          />
        );
    }
  };

  // Function to handle adding a new custom column
  const handleAddCustomColumn = () => {
    if (!newColumnName.trim()) {
      toastHelper.showTost('Please enter a column name', 'error');
      return;
    }

    // Check if column name already exists
    const columnKey = `custom_${newColumnName.trim().toLowerCase().replace(/\s+/g, '_')}`;
    if (columns.some(col => col.key === columnKey)) {
      toastHelper.showTost('A column with this name already exists', 'error');
      return;
    }

    // Add new custom column
    const newColumn = {
      key: columnKey,
      label: newColumnName.trim().toUpperCase(),
      width: 150,
      group: 'Custom Fields',
    };

    setCustomColumns([...customColumns, newColumn]);

    // Initialize the field for all existing rows
    setRows(prevRows => 
      prevRows.map(row => ({
        ...row,
        [columnKey]: '',
      }))
    );

    // Reset modal
    setNewColumnName('');
    setShowAddColumnModal(false);
    toastHelper.showTost(`Column "${newColumnName.trim()}" added successfully`, 'success');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fas fa-spinner text-blue-600 dark:text-blue-400 text-lg animate-spin"></i>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">Loading form data...</p>
      </div>
    );
  }


  const totalWidth = columns.reduce((sum, col) => sum + col.width + 1, 0);

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Enhanced Toolbar */}
      <div className="bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              title="Add Row (Ctrl+N or Cmd+N)"
            >
              <i className="fas fa-plus text-sm"></i>
              <span>Add Row</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (rows.length > 0) {
                  duplicateRow(rows.length - 1);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              title="Duplicate Last Row"
            >
              <i className="fas fa-copy text-sm"></i>
              <span>Duplicate</span>
            </button>
          </div>
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
          {/* SKU Family Search Field */}
          {/* <div className="relative flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => {
                  if (searchQuery && searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click on results
                  setTimeout(() => setShowSearchResults(false), 200);
                }}
                placeholder="Search SKU Family, SubModel, Storage, Colour..."
                className="w-full px-4 py-2 pl-10 pr-4 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <i className="fas fa-times text-sm"></i>
                </button>
              )}
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {selectedRowIndex !== null 
                      ? `Will fill Row ${selectedRowIndex + 1} (click row number to change)`
                      : focusedCell?.row !== undefined
                      ? `Will fill Row ${focusedCell.row + 1} (click row number to select different row)`
                      : 'Will fill Row 1 (click row number to select different row)'}
                  </div>
                </div>
                {searchResults.map((option, idx) => {
                  const targetRow = selectedRowIndex !== null ? selectedRowIndex : (focusedCell?.row ?? 0);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSearchSelect(option, targetRow)}
                      className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                            {option.skuFamilyName}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {option.subModelName && <span className="mr-2">Model: {option.subModelName}</span>}
                            {option.storage && <span className="mr-2">Storage: {option.storage}</span>}
                            {option.colour && <span className="mr-2">Color: {option.colour}</span>}
                            {option.ram && <span>RAM: {option.ram}</span>}
                          </div>
                        </div>
                        <i className="fas fa-arrow-right text-blue-500 text-xs mt-1"></i>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {showSearchResults && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 z-50">
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No results found
                </div>
              </div>
            )}
          </div> */}
          {/* <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div> */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <i className="fas fa-table text-blue-500 text-sm"></i>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {rows.length} {rows.length === 1 ? 'Row' : 'Rows'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <i className="fas fa-columns text-purple-500 text-sm"></i>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {columns.length} Columns
              </span>
            </div>
            {variantType === 'multi' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg border border-purple-300 dark:border-purple-700 shadow-sm">
                <i className="fas fa-layer-group text-purple-600 dark:text-purple-400 text-sm"></i>
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                  Multi-Variant Mode
                </span>
              </div>
            )}
            {/* <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg border border-green-300 dark:border-green-700 shadow-sm">
              <i className="fas fa-save text-green-600 dark:text-green-400 text-sm"></i>
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                Auto-saved
              </span>
            </div> */}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all saved form data?')) {
                try {
                  localStorage.removeItem(STORAGE_KEY);
                  toastHelper.showTost('Saved form data cleared', 'success');
                } catch (error) {
                  console.error('Error clearing localStorage:', error);
                  toastHelper.showTost('Error clearing saved data', 'error');
                }
              }
            }}
            className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 border-2 border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
            title="Clear saved form data from localStorage"
          >
            <i className="fas fa-trash-alt text-sm"></i>
            <span>Clear Saved</span>
          </button> */}
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <i className="fas fa-times mr-2"></i>
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
          >
            <i className={`fas ${editProducts && editProducts.length > 0 ? 'fa-edit' : 'fa-save'} text-sm`}></i>
            <span>{editProducts && editProducts.length > 0 ? 'Update Product' : 'Save All Products'}</span>
            {!editProducts || editProducts.length === 0 ? (
              <span className="ml-1 px-2 py-0.5 bg-blue-500 rounded-full text-xs font-bold">
                {rows.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Excel-like Table with Enhanced Styling */}
      <div 
        ref={tableRef}
        className="flex-1 overflow-auto bg-white dark:bg-gray-900 relative"
        style={{ maxHeight: 'calc(100vh - 136px)' }}
      >
        {/* Scroll Shadow Indicators */}
        {/* <div className="absolute top-0 right-0 w-8 h-full bg-gray-100 dark:bg-gray-800 pointer-events-none z-10 opacity-50"></div> */}
        {/* <div className="absolute bottom-0 left-0 w-full h-8 bg-gray-100 dark:bg-gray-800 pointer-events-none z-10 opacity-50"></div> */}
        <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
          {/* Enhanced Column Headers with Groups */}
          <div className="sticky top-0 z-10 shadow-lg">
            {/* Group Headers for Price Sections */}
            <div className="flex border-b border-gray-300 dark:border-gray-600">
              <div className="min-w-12 border-r-2 border-gray-400 dark:border-gray-600 bg-gray-300 dark:bg-gray-800 sticky left-0 z-10"></div>
              {columns.map((col) => {
                const hkCols = columns.filter((c: any) => c.subgroup === 'HK');
                const dubaiCols = columns.filter((c: any) => c.subgroup === 'DUBAI');
                const paymentTermCols = columns.filter((c: any) => c.subgroup === 'PAYMENT_TERM');
                const paymentMethodCols = columns.filter((c: any) => c.subgroup === 'PAYMENT_METHOD');
                const hkWidth = hkCols.reduce((sum, c) => sum + c.width, 0);
                const dubaiWidth = dubaiCols.reduce((sum, c) => sum + c.width, 0);
                const paymentTermWidth = paymentTermCols.reduce((sum, c) => sum + c.width, 0);
                const paymentMethodWidth = paymentMethodCols.reduce((sum, c) => sum + c.width, 0);
                
                // Check if this is the first column of a group
                if (col.key === 'hkUsd') {
                  return (
                    <div
                      key={`group-hk`}
                      className="bg-blue-500 dark:bg-blue-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-blue-600 dark:border-blue-800 shadow-inner"
                      style={{ width: `${hkWidth}px`, minWidth: `${hkWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-dollar-sign text-xs"></i>
                        <span>HK DELIVERY PRICE</span>
                      </div>
                    </div>
                  );
                } else if (col.key === 'dubaiUsd') {
                  return (
                    <div
                      key={`group-dubai`}
                      className="bg-green-500 dark:bg-green-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-green-600 dark:border-green-800 shadow-inner"
                      style={{ width: `${dubaiWidth}px`, minWidth: `${dubaiWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-dollar-sign text-xs"></i>
                        <span>DUBAI DELIVERY PRICE</span>
                      </div>
                    </div>
                  );
                } else if (col.key === 'paymentTermUsd') {
                  return (
                    <div
                      key={`group-payment-term`}
                      className="bg-purple-500 dark:bg-purple-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-purple-600 dark:border-purple-800 shadow-inner"
                      style={{ width: `${paymentTermWidth}px`, minWidth: `${paymentTermWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-calendar-check text-xs"></i>
                        <span>PAYMENT TERM</span>
                      </div>
                    </div>
                  );
                } else if (col.key === 'paymentMethodUsd') {
                  return (
                    <div
                      key={`group-payment-method`}
                      className="bg-orange-500 dark:bg-orange-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-orange-600 dark:border-orange-800 shadow-inner"
                      style={{ width: `${paymentMethodWidth}px`, minWidth: `${paymentMethodWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-credit-card text-xs"></i>
                        <span>PAYMENT METHOD</span>
                      </div>
                    </div>
                  );
                } else if ((col as any).subgroup) {
                  // Skip rendering for other columns in the group (they're covered by the group header)
                  return null;
                } else {
                  // Regular column - show empty space for alignment
                  return (
                    <div
                      key={`group-empty-${col.key}`}
                      className="border-r border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-800"
                      style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                    ></div>
                  );
                }
              })}
            </div>
            {/* Column Headers with Better Styling */}
            <div className="flex border-b-2 border-gray-400 dark:border-gray-600 bg-gray-200 dark:bg-gray-800">
              <div className="min-w-12 border-r-2 border-gray-400 dark:border-gray-600 bg-gray-400 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-gray-200 sticky left-0 z-10 shadow-md">
                <i className="fas fa-hashtag mr-1"></i>
                #
              </div>
              {columns.map((col) => (
                <div
                  key={col.key}
                  className={`px-3 py-3 text-xs font-bold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 whitespace-nowrap hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors cursor-default ${
                    (col as any).group === 'Custom Fields'
                      ? 'bg-yellow-50 dark:bg-yellow-900/30'
                      : (col as any).subgroup === 'HK' 
                      ? 'bg-blue-50 dark:bg-blue-900/30' 
                      : (col as any).subgroup === 'DUBAI' 
                      ? 'bg-green-50 dark:bg-green-900/30'
                      : (col as any).subgroup === 'PAYMENT_TERM'
                      ? 'bg-purple-50 dark:bg-purple-900/30'
                      : (col as any).subgroup === 'PAYMENT_METHOD'
                      ? 'bg-orange-50 dark:bg-orange-900/30'
                      : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                  style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                  title={col.label}
                >
                  <div className="flex items-center gap-1">
                    {col.label.includes('*') && (
                      <span className="text-red-500 text-xs">*</span>
                    )}
                    <span className="truncate">{col.label.replace('*', '')}</span>
                  </div>
                </div>
              ))}
              {/* Add Column Button */}
              <div
                className="px-3 py-3 text-xs font-bold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer flex items-center justify-center"
                style={{ width: '80px', minWidth: '80px' }}
                onClick={() => setShowAddColumnModal(true)}
                title="Add Custom Column"
              >
                <i className="fas fa-plus text-green-600 dark:text-green-400 text-lg"></i>
              </div>
            </div>
          </div>

          {/* Enhanced Rows */}
          <div ref={rowsContainerRef} className="relative">
            {variantType === 'multi' && rows.length > 0 && totalMoqLeft > 0 && (() => {
              const totalMoqCol = columns.find(col => col.key === 'totalMoq');
              if (!totalMoqCol) return null;
              
              return (
                <div
                  ref={totalMoqCellRef}
                  className="px-0 py-1.5 border-r border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/30 absolute"
                  style={{ 
                    width: `${totalMoqCol.width}px`, 
                    minWidth: `${totalMoqCol.width}px`,
                    left: `${totalMoqLeft}px`,
                    top: '0',
                    height: totalMoqHeight > 0 ? `${totalMoqHeight}px` : `${rows.length * 40}px`,
                    minHeight: totalMoqHeight > 0 ? `${totalMoqHeight}px` : `${rows.length * 40}px`,
                    zIndex: 10
                  }}
                  title={`MOQ PER CART for all ${rows.length} products`}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center px-2">
                    {renderCell(rows[0], 0, totalMoqCol)}
                  </div>
                </div>
              );
            })()}
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={`flex border-b border-gray-200 dark:border-gray-700 transition-all duration-150 ${
                  rowIndex % 2 === 0 
                    ? 'bg-white dark:bg-gray-900' 
                    : 'bg-gray-50/50 dark:bg-gray-800/30'
                } ${
                  focusedCell?.row === rowIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20 shadow-inner'
                    : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                }`}
              >
                {/* Enhanced Row Number */}
                <div className="min-w-12 border-r-2 border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300 sticky left-0 z-5 shadow-sm">
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      onClick={() => setSelectedRowIndex(rowIndex)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shadow-md cursor-pointer transition-all ${
                        selectedRowIndex === rowIndex 
                          ? 'bg-green-600 dark:bg-green-700 ring-2 ring-green-400 ring-offset-2' 
                          : 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600'
                      }`}
                      title={selectedRowIndex === rowIndex ? 'Selected for search fill (click to deselect)' : 'Click to select this row for search fill'}
                    >
                      {rowIndex + 1}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => duplicateRow(rowIndex)}
                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Duplicate Row"
                      >
                        <i className="fas fa-copy text-xs"></i>
                      </button>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(rowIndex)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete Row"
                        >
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Enhanced Cells */}
                {columns.map((col) => {
                  // For totalMoq column in multi-variant mode:
                  // - Render invisible placeholder in all rows to maintain column alignment
                  // - The actual spanning cell is rendered outside the row loop
                  // - Use ref on first row's placeholder to measure position
                  if (col.key === 'totalMoq' && variantType === 'multi') {
                    return (
                      <div
                        key={`${rowIndex}-${col.key}`}
                        ref={rowIndex === 0 ? totalMoqPlaceholderRef : null}
                        className="px-0 py-1.5 border-r border-gray-200 dark:border-gray-700"
                        style={{ 
                          width: `${col.width}px`, 
                          minWidth: `${col.width}px`,
                          visibility: 'hidden',
                          pointerEvents: 'none'
                        }}
                        aria-hidden="true"
                      />
                    );
                  }
                  
                  // Regular columns (not totalMoq or totalMoq in single variant)
                  return (
                    <div
                      key={`${rowIndex}-${col.key}`}
                      className={`px-0 py-1.5 border-r border-gray-200 dark:border-gray-700 relative group transition-all duration-150 flex ${
                        focusedCell?.row === rowIndex && focusedCell?.col === col.key
                          // ? 'ring-2 ring-blue-500 ring-offset-1 z-10 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                          ? ''
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                      style={{ 
                        width: `${col.width}px`, 
                        minWidth: `${col.width}px`,
                        justifyContent:'center',
                        alignItems:'center'
                      }}
                      onDoubleClick={() => fillAllBelow(rowIndex, col.key)}
                      title="Double-click to fill all below"
                    >
                      <div className="px-2">
                        {renderCell(row, rowIndex, col)}
                      </div>
                    {rowIndex < rows.length - 1 && focusedCell?.row === rowIndex && focusedCell?.col === col.key && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillDown(rowIndex, col.key);
                        }}
                        className="absolute bottom-1 right-1 bg-blue-600 text-white text-xs px-2 py-1 rounded-lg shadow-lg hover:bg-blue-700 z-20 transform hover:scale-110 transition-all duration-200 flex items-center gap-1"
                        title="Fill Down (Ctrl+D)"
                      >
                        <i className="fas fa-arrow-down text-xs"></i>
                        <span className="text-xs font-medium">Fill</span>
                      </button>
                    )}
                    {/* Hover indicator */}
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-300 dark:group-hover:border-blue-700 rounded pointer-events-none transition-all duration-150"></div>
                  </div>
                  );
                })}
                {/* Add Column Button Cell */}
                <div
                  className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer"
                  style={{ width: '80px', minWidth: '80px' }}
                  onClick={() => setShowAddColumnModal(true)}
                  title="Add Custom Column"
                >
                  <i className="fas fa-plus text-green-600 dark:text-green-400"></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>

      {/* Modals */}
      <MarginSelectionModal
        isOpen={showMarginModal}
        onClose={() => setShowMarginModal(false)}
        onNext={handleMarginNext}
        products={pendingRows}
      />

      {currentCostCountry && (
        <CostModuleSelectionModal
          isOpen={showCostModal}
          onClose={() => {
            setShowCostModal(false);
            setCurrentCostCountry(null);
          }}
          onNext={handleCostNext}
          products={pendingRows}
          country={currentCostCountry}
        />
      )}

      <ProductPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onSubmit={handleFinalSubmit}
        calculationResults={calculationResults}
        loading={loading}
      />

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50" onClick={() => setShowAddColumnModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Custom Column</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter a name for the new column</p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Column Name
                </label>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomColumn();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Special Notes, Warranty Info"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddColumnModal(false);
                  setNewColumnName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomColumn}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExcelLikeProductForm;
