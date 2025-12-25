import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import { VariantOption } from './CascadingVariantSelector';
import { GradeService } from '../../services/grade/grade.services';
import { SellerService } from '../../services/seller/sellerService';
import { ConstantsService, Constants } from '../../services/constants/constants.services';

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
  lockUnlock: string; // '1' for lock, '0' for unlock
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
  paymentTerm: string[]; // Array of strings
  paymentMethod: string[]; // Array of strings
  
  // Other Information Group
  negotiableFixed: string; // '1' for negotiable, '0' for fixed
  shippingTime: string;
  vendor: string;
  vendorListingNo: string;
  carrier: string;
  carrierListingNo: string;
  uniqueListingNo: string; // Auto-generated
  hotDeal: string;
  lowStock: string;
  adminCustomMessage: string;
  startTime: string;
  endTime: string;
  remark: string;
  
  // Additional fields
  supplierId: string;
  supplierListingNumber: string;
  skuFamilyId: string;
  subSkuFamilyId?: string;
  ram?: string;
  sequence?: number;
  images?: string[];
}

interface ComprehensiveProductFormProps {
  variantType: 'single' | 'multi';
  variants?: VariantOption[];
  onSave: (rows: ProductRowData[]) => void;
  onCancel: () => void;
}

const ComprehensiveProductForm: React.FC<ComprehensiveProductFormProps> = ({
  variantType,
  variants = [],
  onSave,
  onCancel,
}) => {
  const [rows, setRows] = useState<ProductRowData[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [constants, setConstants] = useState<Constants | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize rows based on variant type
  useEffect(() => {
    if (variantType === 'multi' && variants.length > 0) {
      const newRows: ProductRowData[] = variants.map((variant, index) => ({
        subModelName: variant.subModelName,
        storage: variant.storage,
        colour: variant.color,
        country: '',
        sim: '',
        version: '',
        grade: '',
        status: 'Active',
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
        paymentTerm: [],
        paymentMethod: [],
        negotiableFixed: '0',
        shippingTime: '',
        vendor: '',
        vendorListingNo: '',
        carrier: '',
        carrierListingNo: '',
        uniqueListingNo: '',
        hotDeal: '',
        lowStock: '',
        adminCustomMessage: '',
        startTime: '',
        endTime: '',
        remark: '',
        supplierId: '',
        supplierListingNumber: '',
        skuFamilyId: variant.skuFamilyId,
        subSkuFamilyId: variant.subSkuFamilyId,
        ram: variant.ram,
        sequence: null,
      }));
      setRows(newRows);
    } else if (variantType === 'single') {
      setRows([{
        subModelName: '',
        storage: '',
        colour: '',
        country: '',
        sim: '',
        version: '',
        grade: '',
        status: 'Active',
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
        paymentTerm: [],
        paymentMethod: [],
        negotiableFixed: '0',
        shippingTime: '',
        vendor: '',
        vendorListingNo: '',
        carrier: '',
        carrierListingNo: '',
        uniqueListingNo: '',
        hotDeal: '',
        lowStock: '',
        adminCustomMessage: '',
        startTime: '',
        endTime: '',
        remark: '',
        supplierId: '',
        supplierListingNumber: '',
        skuFamilyId: '',
        sequence: null,
      }]);
    }
  }, [variantType, variants]);

  // Fetch dropdown data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch grades
        const gradeResponse = await GradeService.getGradeList(1, 1000);
        setGrades(gradeResponse.data.docs || []);
        
        // Fetch sellers
        const sellersList = await SellerService.getAllSellers();
        setSellers(sellersList || []);
        
        // Fetch constants
        const constantsData = await ConstantsService.getConstants();
        setConstants(constantsData);
        
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

  // Auto-calculate delivery location based on pricing
  useEffect(() => {
    setRows(prevRows => prevRows.map(row => {
      const locations: string[] = [];
      // If HK pricing exists, add HK to delivery locations
      if (row.hkUsd || row.hkHkd) {
        locations.push('HK');
      }
      // If Dubai pricing exists, add D to delivery locations
      if (row.dubaiUsd || row.dubaiAed) {
        locations.push('D');
      }
      return { ...row, deliveryLocation: locations };
    }));
  }, [rows.map(r => `${r.hkUsd}-${r.hkHkd}-${r.dubaiUsd}-${r.dubaiAed}`).join(',')]);

  const updateRow = (index: number, field: keyof ProductRowData, value: any) => {
    setRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index] = { ...newRows[index], [field]: value };
      
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
      if (!row.endTime) errors.push(`Row ${index + 1}: END TIME is required`);
    });
    
    if (errors.length > 0) {
      const errorMessage = `Please fix the following ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n\n... and ${errors.length - 10} more errors` : ''}`;
      if (window.confirm(errorMessage + '\n\nDo you want to continue anyway?')) {
        // User wants to continue despite errors
      } else {
        return;
      }
    }
    
    // Generate unique listing numbers
    const rowsWithListingNos = updatedRows.map((row, index) => ({
      ...row,
      uniqueListingNo: row.uniqueListingNo || `LIST-${Date.now()}-${index}`,
    }));
    
    onSave(rowsWithListingNos);
  };

  // Get location options from constants (show name, store code)
  const currentLocationOptions = constants?.currentLocation || [];
  const deliveryLocationOptions = constants?.deliveryLocation || [];
  
  const countryOptions = ['Hong Kong', 'Dubai'];
  const simOptions = ['Dual SIM', 'E-SIM', 'Physical Sim'];
  const statusOptions = ['Active', 'Non Active', 'pre owned'];
  const lockUnlockOptions = [
    { value: '1', label: 'Lock' },
    { value: '0', label: 'Unlock' },
  ];
  const packingOptions = ['sealed', 'open sealed', 'master cartoon'];
  const paymentTermOptions = ['on order', 'on delivery', 'as in conformation'];
  const paymentMethodOptions = ['hkd cash / aed cash', 'usd cash /tt', 'as in conformation'];
  const negotiableFixedOptions = [
    { value: '1', label: 'Negotiable' },
    { value: '0', label: 'Fixed' },
  ];
  const vendorOptions = ['att', 'tmobile'];
  const carrierOptions = ['tmob', 'mixed'];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white">
            {variantType === 'multi' ? 'Multi-Variant Product Form' : 'Single Variant Product Form'}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {rows.length} row(s) to fill
          </p>
        </div>

        {/* Scrollable Table Container */}
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
              {/* Product Detail Group Header */}
              <tr>
                <th colSpan={11} className="bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 text-left font-bold text-sm border">
                  Product Detail Group
                </th>
              </tr>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[120px]">
                  SubModelName*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  Storage*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  Colour*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  Country (specs)*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  SIM*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  VERSION
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  GRADE*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  STATUS*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  LOCK/UNLOCK*
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  WARRANTY
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border text-left min-w-[100px]">
                  BATTERY HEALTH
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.subModelName}
                      onChange={(e) => updateRow(rowIndex, 'subModelName', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                      disabled={variantType === 'multi'}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.storage}
                      onChange={(e) => updateRow(rowIndex, 'storage', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                      disabled={variantType === 'multi'}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.colour}
                      onChange={(e) => updateRow(rowIndex, 'colour', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                      disabled={variantType === 'multi'}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <select
                      value={row.country}
                      onChange={(e) => updateRow(rowIndex, 'country', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                    >
                      <option value="">Select</option>
                      {countryOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <select
                      value={row.sim}
                      onChange={(e) => updateRow(rowIndex, 'sim', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                    >
                      <option value="">Select</option>
                      {simOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.version}
                      onChange={(e) => updateRow(rowIndex, 'version', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="e.g., ALSKW123"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <Select
                      options={grades.map(g => ({ value: g._id, label: g.title }))}
                      value={grades.find(g => g._id === row.grade) ? { value: row.grade, label: grades.find(g => g._id === row.grade)?.title } : null}
                      onChange={(opt) => updateRow(rowIndex, 'grade', opt?.value || '')}
                      className="text-sm"
                      classNamePrefix="select"
                      isSearchable
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(rowIndex, 'status', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                    >
                      {statusOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <select
                      value={row.lockUnlock}
                      onChange={(e) => updateRow(rowIndex, 'lockUnlock', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                    >
                      <option value="">Select</option>
                      {lockUnlockOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.warranty}
                      onChange={(e) => updateRow(rowIndex, 'warranty', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="e.g., 6 months +"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.batteryHealth}
                      onChange={(e) => updateRow(rowIndex, 'batteryHealth', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="e.g., 70% above"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing / Delivery / Payment Method Group */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden mt-6">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white">Pricing / Delivery / Payment Method Group</h3>
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th colSpan={15} className="bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 text-left font-bold text-sm border">
                  Pricing / Delivery / Payment Method Group
                </th>
              </tr>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">PACKING*</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">CURRENT LOCATION*</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">HK USD</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">HK XE</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">HK HKD</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">DUBAI USD</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">DUBAI XE</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">DUBAI AED</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">DELIVERY LOCATION</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">CUSTOM MESSAGE</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">TOTAL QTY*</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">MOQ/VARIANT*</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">WEIGHT</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">PAYMENT TERM</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">PAYMENT METHOD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 border">
                    <select
                      value={row.packing}
                      onChange={(e) => updateRow(rowIndex, 'packing', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                    >
                      <option value="">Select</option>
                      {packingOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <select
                      value={row.currentLocation}
                      onChange={(e) => updateRow(rowIndex, 'currentLocation', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                    >
                      <option value="">Select</option>
                      {currentLocationOptions.map(opt => (
                        <option key={opt.code} value={opt.code}>{opt.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      step="0.01"
                      value={row.hkUsd}
                      onChange={(e) => updateRow(rowIndex, 'hkUsd', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      step="0.0001"
                      value={row.hkXe}
                      onChange={(e) => updateRow(rowIndex, 'hkXe', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="0.0000"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      step="0.01"
                      value={row.hkHkd}
                      onChange={(e) => updateRow(rowIndex, 'hkHkd', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      step="0.01"
                      value={row.dubaiUsd}
                      onChange={(e) => updateRow(rowIndex, 'dubaiUsd', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      step="0.0001"
                      value={row.dubaiXe}
                      onChange={(e) => updateRow(rowIndex, 'dubaiXe', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="0.0000"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      step="0.01"
                      value={row.dubaiAed}
                      onChange={(e) => updateRow(rowIndex, 'dubaiAed', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <Select
                      isMulti
                      options={deliveryLocationOptions.map(opt => ({ value: opt.code, label: opt.name }))}
                      value={row.deliveryLocation.map(code => {
                        const option = deliveryLocationOptions.find(opt => opt.code === code);
                        return option ? { value: option.code, label: option.name } : null;
                      }).filter(Boolean) as any}
                      onChange={(selected) => {
                        const codes = selected ? selected.map((s: any) => s.value) : [];
                        updateRow(rowIndex, 'deliveryLocation', codes);
                      }}
                      className="basic-select"
                      classNamePrefix="select"
                      placeholder="Select delivery locations"
                      styles={{
                        control: (provided) => ({
                          ...provided,
                          minHeight: '32px',
                          fontSize: '14px',
                        }),
                        multiValue: (provided) => ({
                          ...provided,
                          fontSize: '12px',
                        }),
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.customMessage}
                      onChange={(e) => updateRow(rowIndex, 'customMessage', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="e.g., frt inc"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      value={row.totalQty}
                      onChange={(e) => updateRow(rowIndex, 'totalQty', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      value={row.moqPerVariant}
                      onChange={(e) => updateRow(rowIndex, 'moqPerVariant', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      step="0.01"
                      value={row.weight}
                      onChange={(e) => updateRow(rowIndex, 'weight', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="0.00 kg"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <Select
                      isMulti
                      options={paymentTermOptions.map(opt => ({ value: opt, label: opt }))}
                      value={row.paymentTerm.map(term => ({ value: term, label: term }))}
                      onChange={(selected) => {
                        const values = selected ? selected.map((s: any) => s.value) : [];
                        updateRow(rowIndex, 'paymentTerm', values);
                      }}
                      className="basic-select"
                      classNamePrefix="select"
                      placeholder="Select payment terms"
                      styles={{
                        control: (provided) => ({
                          ...provided,
                          minHeight: '32px',
                          fontSize: '14px',
                        }),
                        multiValue: (provided) => ({
                          ...provided,
                          fontSize: '12px',
                        }),
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <Select
                      isMulti
                      options={paymentMethodOptions.map(opt => ({ value: opt, label: opt }))}
                      value={row.paymentMethod.map(method => ({ value: method, label: method }))}
                      onChange={(selected) => {
                        const values = selected ? selected.map((s: any) => s.value) : [];
                        updateRow(rowIndex, 'paymentMethod', values);
                      }}
                      className="basic-select"
                      classNamePrefix="select"
                      placeholder="Select payment methods"
                      styles={{
                        control: (provided) => ({
                          ...provided,
                          minHeight: '32px',
                          fontSize: '14px',
                        }),
                        multiValue: (provided) => ({
                          ...provided,
                          fontSize: '12px',
                        }),
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Other Information Group */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden mt-6">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white">Other Information Group</h3>
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th colSpan={15} className="bg-yellow-100 dark:bg-yellow-900/30 px-4 py-2 text-left font-bold text-sm border">
                  Other Information Group
                </th>
              </tr>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">NEGOTIABLE/FIXED</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">SHIPPING TIME</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">VENDOR</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">VENDOR LISTING NO</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">CARRIER</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">CARRIER LISTING NO</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">UNIQUE LISTING NO</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">HOT DEAL</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[100px]">LOW STOCK</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[150px]">ADMIN CUSTOM MESSAGE</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[150px]">START TIME</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[150px]">END TIME *</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">SUPPLIER ID*</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[150px]">SUPPLIER LISTING NO*</th>
                <th className="px-3 py-2 text-xs font-semibold border text-left min-w-[120px]">REMARK</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 border">
                    <select
                      value={row.negotiableFixed}
                      onChange={(e) => updateRow(rowIndex, 'negotiableFixed', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                    >
                      {negotiableFixedOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.shippingTime}
                      onChange={(e) => updateRow(rowIndex, 'shippingTime', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="e.g., ship today"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <select
                      value={row.vendor}
                      onChange={(e) => updateRow(rowIndex, 'vendor', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                    >
                      <option value="">Select</option>
                      {vendorOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.vendorListingNo}
                      onChange={(e) => updateRow(rowIndex, 'vendorListingNo', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="e.g., att123abc"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <select
                      value={row.carrier}
                      onChange={(e) => updateRow(rowIndex, 'carrier', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                    >
                      <option value="">Select</option>
                      {carrierOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.carrierListingNo}
                      onChange={(e) => updateRow(rowIndex, 'carrierListingNo', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="e.g., qwe123"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.uniqueListingNo}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-100 dark:bg-gray-700"
                      readOnly
                      placeholder="Auto-generated"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.hotDeal}
                      onChange={(e) => updateRow(rowIndex, 'hotDeal', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="tag 1"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.lowStock}
                      onChange={(e) => updateRow(rowIndex, 'lowStock', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="tag 1"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.adminCustomMessage}
                      onChange={(e) => updateRow(rowIndex, 'adminCustomMessage', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="Admin only message"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <DatePicker
                      selected={row.startTime ? new Date(row.startTime) : null}
                      onChange={(date) => updateRow(rowIndex, 'startTime', date ? date.toISOString() : '')}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={30}
                      dateFormat="yyyy-MM-dd HH:mm"
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholderText="Select start time (auto: current time)"
                      popperClassName="inline-datetime-picker"
                      calendarClassName="inline-datetime-calendar"
                      popperModifiers={[
                        {
                          name: 'offset',
                          options: {
                            offset: [0, 8],
                          },
                        },
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <DatePicker
                      selected={row.endTime ? new Date(row.endTime) : null}
                      onChange={(date) => updateRow(rowIndex, 'endTime', date ? date.toISOString() : '')}
                      showTimeSelect
                      timeFormat="HH:mm"
                      timeIntervals={30}
                      dateFormat="yyyy-MM-dd HH:mm"
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholderText="Select end time *"
                      required
                      popperClassName="inline-datetime-picker"
                      calendarClassName="inline-datetime-calendar"
                      popperModifiers={[
                        {
                          name: 'offset',
                          options: {
                            offset: [0, 8],
                          },
                        },
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <Select
                      options={sellers.map(s => ({ value: s._id, label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))}
                      value={sellers.find(s => s._id === row.supplierId) ? { value: row.supplierId, label: sellers.find(s => s._id === row.supplierId)?.name } : null}
                      onChange={(opt) => updateRow(rowIndex, 'supplierId', opt?.value || '')}
                      className="text-sm"
                      classNamePrefix="select"
                      isSearchable
                      placeholder="Select Supplier"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.supplierListingNumber}
                      onChange={(e) => updateRow(rowIndex, 'supplierListingNumber', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      required
                      placeholder="Supplier listing number"
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <input
                      type="text"
                      value={row.remark}
                      onChange={(e) => updateRow(rowIndex, 'remark', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded bg-gray-50 dark:bg-gray-800"
                      placeholder="Customer visible remark"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Products
        </button>
      </div>
    </form>
  );
};

export default ComprehensiveProductForm;

