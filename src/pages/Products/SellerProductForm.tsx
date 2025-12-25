import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CascadingVariantSelector, { VariantOption } from '../../components/products/CascadingVariantSelector';
import { SellerProductPermissionService, SellerProductFieldPermission } from '../../services/sellerProductPermission/sellerProductPermission.services';
import { ProductService } from '../../services/product/product.services';
import { GradeService } from '../../services/grade/grade.services';
import { ConstantsService, Constants } from '../../services/constants/constants.services';
import toastHelper from '../../utils/toastHelper';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type PageStep = 'variant-selection' | 'variant-config' | 'form';

interface ProductRowData {
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
  packing: string;
  currentLocation: string;
  hkUsd: number | string;
  hkXe: number | string;
  hkHkd: number | string;
  dubaiUsd: number | string;
  dubaiXe: number | string;
  dubaiAed: number | string;
  deliveryLocation: string[];
  customMessage: string;
  totalQty: number | string;
  moqPerVariant: number | string;
  weight: number | string;
  purchaseType: string; // 'full' | 'partial'
  paymentTerm: string;
  paymentMethod: string;
  negotiableFixed: string;
  tags: string;
  flashDeal: string;
  shippingTime: string;
  vendor: string;
  vendorListingNo: string;
  carrier: string;
  carrierListingNo: string;
  uniqueListingNo: string;
  adminCustomMessage: string;
  startTime: string;
  endTime: string;
  remark: string;
  supplierId: string;
  supplierListingNumber: string;
  customerListingNumber: string;
  skuFamilyId: string;
  subSkuFamilyId?: string;
  ram?: string;
  sequence?: number;
}

const SellerProductForm: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<PageStep>('variant-selection');
  const [variantType, setVariantType] = useState<'single' | 'multi' | null>(null);
  const [_selectedVariants, setSelectedVariants] = useState<VariantOption[]>([]);
  const [rows, setRows] = useState<ProductRowData[]>([]);
  const [permissions, setPermissions] = useState<SellerProductFieldPermission[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [_constants, setConstants] = useState<Constants | null>(null);
  const [loading, _setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load permissions on mount
  useEffect(() => {
    loadPermissions();
    loadDropdownData();
  }, []);

  const loadPermissions = async () => {
    try {
      const sellerPermissions = await SellerProductPermissionService.getCurrentSellerPermissions();
      setPermissions(sellerPermissions);
    } catch (error: any) {
      // If no permissions set, use all fields (for development/testing)
      console.warn('No seller permissions found, using all fields');
      const allFields = SellerProductPermissionService.getAvailableFields();
      // Set all fields to have permission by default if no permissions are set
      setPermissions(allFields.map(f => ({ ...f, hasPermission: true })));
    }
  };

  const loadDropdownData = async () => {
    try {
      const gradeResponse = await GradeService.getGradeList(1, 1000);
      setGrades(gradeResponse.data.docs || []);
      
      const constantsData = await ConstantsService.getConstants();
      setConstants(constantsData);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const hasPermission = (fieldName: string): boolean => {
    const permission = permissions.find(p => p.fieldName === fieldName);
    return permission?.hasPermission ?? false;
  };

  const handleVariantSelection = (type: 'single' | 'multi') => {
    setVariantType(type);
    if (type === 'single') {
      setStep('form');
      setRows([createEmptyRow()]);
    } else {
      setStep('variant-config');
    }
  };

  const handleVariantsSelected = (variants: VariantOption[]) => {
    setSelectedVariants(variants);
    if (variants.length > 0) {
      const newRows = variants.map((variant, index) => createRowFromVariant(variant, index));
      setRows(newRows);
      setStep('form');
    }
  };

  const createEmptyRow = (): ProductRowData => ({
    subModelName: '',
    storage: '',
    colour: '',
    country: '',
    sim: '',
    version: '',
    grade: '',
    status: 'Active',
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
    paymentTerm: '',
    paymentMethod: '',
    negotiableFixed: '0',
    tags: '',
    flashDeal: '',
    shippingTime: '',
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
    skuFamilyId: '',
    sequence: undefined,
  });

  const createRowFromVariant = (variant: VariantOption, _index: number): ProductRowData => ({
    ...createEmptyRow(),
    subModelName: variant.subModelName,
    storage: variant.storage,
    colour: variant.color,
    skuFamilyId: variant.skuFamilyId,
    subSkuFamilyId: variant.subSkuFamilyId,
    ram: variant.ram,
    sequence: undefined,
  });

  const updateRow = (index: number, field: keyof ProductRowData, value: any) => {
    setRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index] = { ...newRows[index], [field]: value };
      return newRows;
    });
  };

  const isValidObjectId = (id: string | null | undefined): boolean => {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  const handleFormSave = async () => {
    try {
      setSaving(true);
      
      // Validate required fields that have permission
      const validationErrors: string[] = [];
      rows.forEach((row, index) => {
        if (hasPermission('skuFamilyId') && (!row.skuFamilyId || !isValidObjectId(row.skuFamilyId))) {
          validationErrors.push(`Row ${index + 1}: Invalid or missing SKU Family ID`);
        }
        if (hasPermission('grade') && row.grade && !isValidObjectId(row.grade)) {
          validationErrors.push(`Row ${index + 1}: Invalid Grade ID`);
        }
        if (hasPermission('totalQty') && (!row.totalQty || parseFloat(String(row.totalQty)) <= 0)) {
          validationErrors.push(`Row ${index + 1}: Total Qty is required`);
        }
        if (hasPermission('moqPerVariant') && (!row.moqPerVariant || parseFloat(String(row.moqPerVariant)) <= 0)) {
          validationErrors.push(`Row ${index + 1}: MOQ/Variant is required`);
        }
      });

      if (validationErrors.length > 0) {
        toastHelper.showTost(
          `Validation errors:\n${validationErrors.join('\n')}`,
          'error'
        );
        setSaving(false);
        return;
      }
      
      // Transform rows to backend format
      const productsToCreate = rows.map(row => {
        const cleanString = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          return val;
        };
        
        const countryDeliverables: any[] = [];
        
        if (hasPermission('hkUsd') || hasPermission('hkHkd')) {
          if (row.hkUsd || row.hkHkd) {
            countryDeliverables.push({
              country: 'Hongkong',
              price: parseFloat(String(row.hkUsd)) || 0,
              usd: parseFloat(String(row.hkUsd)) || 0,
              xe: parseFloat(String(row.hkXe)) || 0,
              local: parseFloat(String(row.hkHkd)) || 0,
              hkd: parseFloat(String(row.hkHkd)) || 0,
              paymentTerm: hasPermission('paymentTerm') ? (cleanString(row.paymentTerm) || null) : null,
              paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || null) : null,
            });
          }
        }
        
        if (hasPermission('dubaiUsd') || hasPermission('dubaiAed')) {
          if (row.dubaiUsd || row.dubaiAed) {
            countryDeliverables.push({
              country: 'Dubai',
              price: parseFloat(String(row.dubaiUsd)) || 0,
              usd: parseFloat(String(row.dubaiUsd)) || 0,
              xe: parseFloat(String(row.dubaiXe)) || 0,
              local: parseFloat(String(row.dubaiAed)) || 0,
              aed: parseFloat(String(row.dubaiAed)) || 0,
              paymentTerm: hasPermission('paymentTerm') ? (cleanString(row.paymentTerm) || null) : null,
              paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || null) : null,
            });
          }
        }

        return {
          skuFamilyId: row.skuFamilyId,
          gradeId: hasPermission('grade') && row.grade && isValidObjectId(row.grade) ? row.grade : null,
          specification: hasPermission('version') ? (cleanString(row.version) || '') : '',
          simType: hasPermission('sim') ? row.sim : '',
          color: hasPermission('colour') ? row.colour : '',
          ram: hasPermission('ram') ? (cleanString(row.ram) || '') : '',
          storage: hasPermission('storage') ? row.storage : '',
          weight: hasPermission('weight') && row.weight ? parseFloat(String(row.weight)) : null,
          condition: hasPermission('condition') ? (cleanString(row.condition) || null) : null,
          price: parseFloat(String(row.hkUsd || row.dubaiUsd || 0)),
          stock: hasPermission('totalQty') ? parseFloat(String(row.totalQty)) || 0 : 0,
          country: hasPermission('country') ? (cleanString(row.country) || null) : null,
          moq: hasPermission('moqPerVariant') ? parseFloat(String(row.moqPerVariant)) || 1 : 1,
          purchaseType: hasPermission('purchaseType') ? ((row.purchaseType === 'full' || row.purchaseType === 'partial') ? row.purchaseType : 'partial') : 'partial',
          isNegotiable: hasPermission('negotiableFixed') ? (row.negotiableFixed === '1') : false,
          isFlashDeal: hasPermission('flashDeal') && row.flashDeal && (row.flashDeal === '1' || row.flashDeal === 'true') ? 'true' : 'false',
          startTime: hasPermission('startTime') && row.startTime ? new Date(row.startTime).toISOString() : '',
          expiryTime: hasPermission('endTime') && row.endTime ? new Date(row.endTime).toISOString() : '',
          groupCode: variantType === 'multi' ? `GROUP-${Date.now()}` : undefined,
          sequence: row.sequence || null,
          countryDeliverables,
          supplierListingNumber: hasPermission('supplierListingNumber') ? (cleanString(row.supplierListingNumber) || '') : '',
          packing: hasPermission('packing') ? (cleanString(row.packing) || '') : '',
          currentLocation: hasPermission('currentLocation') ? (cleanString(row.currentLocation) || '') : '',
          deliveryLocation: hasPermission('deliveryLocation') && Array.isArray(row.deliveryLocation) ? row.deliveryLocation : [],
          customMessage: hasPermission('customMessage') ? (cleanString(row.customMessage) || '') : '',
          totalMoq: variantType === 'multi' ? null : null,
          paymentTerm: hasPermission('paymentTerm') ? (cleanString(row.paymentTerm) || null) : null,
          paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || null) : null,
          shippingTime: hasPermission('shippingTime') ? (cleanString(row.shippingTime) || '') : '',
          vendor: hasPermission('vendor') ? (cleanString(row.vendor) || null) : null,
          vendorListingNo: hasPermission('vendorListingNo') ? (cleanString(row.vendorListingNo) || '') : '',
          carrier: hasPermission('carrier') ? (cleanString(row.carrier) || null) : null,
          carrierListingNo: hasPermission('carrierListingNo') ? (cleanString(row.carrierListingNo) || '') : '',
          uniqueListingNo: hasPermission('uniqueListingNo') ? (cleanString(row.uniqueListingNo) || '') : '',
          tags: hasPermission('tags') ? (cleanString(row.tags) || '') : '',
          remark: hasPermission('remark') ? (cleanString(row.remark) || '') : '',
          warranty: hasPermission('warranty') ? (cleanString(row.warranty) || '') : '',
          batteryHealth: hasPermission('batteryHealth') ? (cleanString(row.batteryHealth) || '') : '',
          lockUnlock: hasPermission('lockUnlock') ? (row.lockUnlock === '1') : false,
        };
      });

      // Create product requests
      const createPromises = productsToCreate.map(product => 
        ProductService.createSellerProductRequest(product)
      );

      await Promise.all(createPromises);
      
      toastHelper.showTost('Product requests submitted successfully! They will be reviewed by admin.', 'success');
      navigate('/products'); // Navigate back or to seller products list
    } catch (error: any) {
      console.error('Error creating product requests:', error);
      toastHelper.showTost(error.message || 'Failed to submit product requests', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderFormField = (rowIndex: number, fieldName: keyof ProductRowData, label: string, type: 'text' | 'number' | 'select' | 'date' = 'text', options?: any[]) => {
    if (!hasPermission(fieldName)) return null;

    const row = rows[rowIndex];
    const isRequired = permissions.find(p => p.fieldName === fieldName)?.isRequired || false;

    if (type === 'select' && options) {
      return (
        <div key={fieldName} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label} {isRequired && <span className="text-red-500">*</span>}
          </label>
          <select
            value={String(row[fieldName] || '')}
            onChange={(e) => updateRow(rowIndex, fieldName, e.target.value)}
            required={isRequired}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">Select {label}</option>
            {options.map(opt => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (type === 'date') {
      return (
        <div key={fieldName} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label} {isRequired && <span className="text-red-500">*</span>}
          </label>
          <DatePicker
            selected={row[fieldName] ? new Date(String(row[fieldName])) : null}
            onChange={(date) => updateRow(rowIndex, fieldName, date ? date.toISOString() : '')}
            showTimeSelect
            timeFormat="HH:mm"
            dateFormat="yyyy-MM-dd HH:mm"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            required={isRequired}
          />
        </div>
      );
    }

    return (
      <div key={fieldName} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <input
          type={type}
          value={String(row[fieldName] || '')}
          onChange={(e) => updateRow(rowIndex, fieldName, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          required={isRequired}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-y-auto">
      {/* Variant Selection Step */}
      {step === 'variant-selection' && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-6xl">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
                      Create New Product Request
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Choose your listing type to get started
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/products')}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => handleVariantSelection('single')}
                    className="group relative p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 text-left transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                        <i className="fas fa-file-alt text-white text-3xl"></i>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        Single Variant
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Create one product listing with a single set of specifications.
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleVariantSelection('multi')}
                    className="group relative p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300 text-left transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                        <i className="fas fa-layer-group text-white text-3xl"></i>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        Multi Variant
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Create multiple variants using smart filters.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Variant Configuration Step */}
      {step === 'variant-config' && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-7xl">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
              <div className="bg-purple-600 dark:bg-purple-800 p-6 border-b-2 border-purple-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Multi-Variant Configuration</h2>
                  <button onClick={() => setStep('variant-selection')} className="text-white hover:bg-white/20 rounded-lg p-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <CascadingVariantSelector onVariantsSelected={handleVariantsSelected} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Step */}
      {step === 'form' && (
        <div className="min-h-screen p-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="bg-blue-600 dark:bg-blue-800 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {variantType === 'multi' ? 'Multi-Variant Product Form' : 'Single Variant Product Form'}
                </h2>
                <button onClick={() => setStep('variant-selection')} className="text-white hover:bg-white/20 rounded-lg p-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                {rows.map((_row, rowIndex) => (
                  <div key={rowIndex} className="mb-8 p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                      Product {rowIndex + 1}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {renderFormField(rowIndex, 'skuFamilyId', 'SKU Family', 'text')}
                      {renderFormField(rowIndex, 'storage', 'Storage', 'text')}
                      {renderFormField(rowIndex, 'colour', 'Colour', 'text')}
                      {renderFormField(rowIndex, 'country', 'Country', 'select', [
                        { value: 'Hong Kong', label: 'Hong Kong' },
                        { value: 'Dubai', label: 'Dubai' },
                      ])}
                      {renderFormField(rowIndex, 'sim', 'SIM', 'select', [
                        { value: 'Dual SIM', label: 'Dual SIM' },
                        { value: 'E-SIM', label: 'E-SIM' },
                        { value: 'Physical Sim', label: 'Physical Sim' },
                      ])}
                      {renderFormField(rowIndex, 'version', 'Version', 'text')}
                      {renderFormField(rowIndex, 'grade', 'Grade', 'select', grades.map(g => ({ value: g._id, label: g.title })))}
                      {renderFormField(rowIndex, 'status', 'Status', 'select', [
                        { value: 'Active', label: 'Active' },
                        { value: 'Non Active', label: 'Non Active' },
                        { value: 'pre owned', label: 'Pre Owned' },
                      ])}
                      {renderFormField(rowIndex, 'lockUnlock', 'Lock/Unlock', 'select', [
                        { value: '1', label: 'Lock' },
                        { value: '0', label: 'Unlock' },
                      ])}
                      {renderFormField(rowIndex, 'warranty', 'Warranty', 'text')}
                      {renderFormField(rowIndex, 'batteryHealth', 'Battery Health', 'text')}
                      {renderFormField(rowIndex, 'packing', 'Packing', 'select', [
                        { value: 'sealed', label: 'Sealed' },
                        { value: 'open sealed', label: 'Open Sealed' },
                        { value: 'master cartoon', label: 'Master Cartoon' },
                      ])}
                      {renderFormField(rowIndex, 'totalQty', 'Total Qty', 'number')}
                      {renderFormField(rowIndex, 'moqPerVariant', 'MOQ/Variant', 'number')}
                      {renderFormField(rowIndex, 'weight', 'Weight', 'number')}
                      {renderFormField(rowIndex, 'purchaseType', 'Purchase Type', 'select', [
                        { value: 'partial', label: 'Partial' },
                        { value: 'full', label: 'Full' },
                      ])}
                      {renderFormField(rowIndex, 'hkUsd', 'HK USD', 'number')}
                      {renderFormField(rowIndex, 'hkHkd', 'HK HKD', 'number')}
                      {renderFormField(rowIndex, 'dubaiUsd', 'Dubai USD', 'number')}
                      {renderFormField(rowIndex, 'dubaiAed', 'Dubai AED', 'number')}
                      {renderFormField(rowIndex, 'negotiableFixed', 'Negotiable/Fixed', 'select', [
                        { value: '1', label: 'Negotiable' },
                        { value: '0', label: 'Fixed' },
                      ])}
                      {renderFormField(rowIndex, 'shippingTime', 'Shipping Time', 'text')}
                      {renderFormField(rowIndex, 'startTime', 'Start Time', 'date')}
                      {renderFormField(rowIndex, 'endTime', 'End Time', 'date')}
                      {renderFormField(rowIndex, 'remark', 'Remark', 'text')}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setStep('variant-selection')}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFormSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Submitting...' : 'Submit for Review'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProductForm;
