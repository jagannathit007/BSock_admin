import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CascadingVariantSelector, { VariantOption } from '../../components/products/CascadingVariantSelector';
import ExcelLikeProductForm, { ProductRowData } from '../../components/products/ExcelLikeProductForm';
import { ProductService, Product } from '../../services/product/product.services';
import toastHelper from '../../utils/toastHelper';

type PageStep = 'variant-selection' | 'variant-config' | 'form';

const ProductVariantForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const editId = searchParams.get('editId');
  const editIdsParam = searchParams.get('editIds');
  const groupCodeParam = searchParams.get('groupCode');
  const editIds = (editIdsParam || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editProducts, setEditProducts] = useState<Product[]>([]); // For multi-variant products
  const [loadingProduct, setLoadingProduct] = useState(false);
  
  // Initialize step and variantType based on URL parameter
  const getInitialStep = (): PageStep => {
    if (editId || editIds.length > 0 || groupCodeParam) {
      return 'form'; // Go directly to form when editing
    }
    if (typeParam === 'single') {
      return 'form';
    }
    if (typeParam === 'multi') {
      return 'form'; // Directly go to form for multi variant
    }
    return 'variant-selection';
  };

  const getInitialVariantType = (): 'single' | 'multi' | null => {
    if (groupCodeParam) {
      return 'multi';
    }
    if (editIds.length > 0) {
      return editIds.length > 1 ? 'multi' : 'single';
    }
    if (editId) {
      return null; // Determined after loading product
    }
    if (typeParam === 'single') {
      return 'single';
    }
    if (typeParam === 'multi') {
      return 'multi';
    }
    return null;
  };

  const [step, setStep] = useState<PageStep>(getInitialStep());
  const [variantType, setVariantType] = useState<'single' | 'multi' | null>(getInitialVariantType());
  const [selectedVariants, setSelectedVariants] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(false);
  // Load product data when editing (single or multiple)
  useEffect(() => {
    const mapProductToVariant = (p: Product): VariantOption => {
      const skuFamily = typeof p.skuFamilyId === 'object' ? p.skuFamilyId : null;
      let subModelName = '';
      if (p.specification) {
        subModelName = p.specification;
      } else if (skuFamily && (skuFamily as any).subSkuFamilies && Array.isArray((skuFamily as any).subSkuFamilies)) {
        const matchingSubSku = (skuFamily as any).subSkuFamilies.find((sub: any) => sub.subName);
        if (matchingSubSku && matchingSubSku.subName) {
          subModelName = matchingSubSku.subName;
        }
      }
      return {
        skuFamilyId: typeof p.skuFamilyId === 'object' ? (p.skuFamilyId as any)._id : p.skuFamilyId,
        subModelName,
        storage: p.storage || '',
        color: p.color || '',
        ram: p.ram || '',
      };
    };

    const loadProductsForEdit = async () => {
      if (!editId && editIds.length === 0 && !groupCodeParam) return;

      try {
        setLoadingProduct(true);

        // Prefer explicit groupCode param for multi-variant edit
        if (groupCodeParam) {
          console.log('Loading products for groupCode:', groupCodeParam);
          const groupedProducts = await ProductService.getProductsByGroupCode(groupCodeParam);
          console.log('Loaded products for groupCode:', groupedProducts?.length || 0, groupedProducts);

          if (!groupedProducts || groupedProducts.length === 0) {
            toastHelper.showTost('No products found for this group code', 'warning');
            navigate('/products');
            return;
          }

          // Ensure products are properly sorted and have all required fields
          const sortedProducts = groupedProducts.sort((a, b) => {
            // Sort by sequence if available, otherwise by creation date
            const seqA = (a as any).sequence ?? 999999;
            const seqB = (b as any).sequence ?? 999999;
            if (seqA !== seqB) return seqA - seqB;
            return new Date((a as any).createdAt || 0).getTime() - new Date((b as any).createdAt || 0).getTime();
          });

          console.log('Setting editProducts:', sortedProducts.length, 'products');
          setEditProducts(sortedProducts);
          setVariantType('multi');
          setSelectedVariants(sortedProducts.map(mapProductToVariant));
          setStep('form');
          try {
            localStorage.removeItem('variant-product-form-data');
          } catch (error) {
            console.error('Error clearing localStorage:', error);
          }
          return;
        }

        // If multiple IDs were provided via editIds query param
        if (editIds.length > 0) {
          const fetched = await Promise.all(
            editIds.map(async (id) => {
              try {
                return await ProductService.getProductById(id);
              } catch (err) {
                console.error('Failed to load product', id, err);
                return null;
              }
            })
          );
          const validProducts = fetched.filter((p): p is Product => Boolean(p));

          if (validProducts.length === 0) {
            toastHelper.showTost('Selected products not found', 'error');
            navigate('/products');
            return;
          }

          if (validProducts.length === 1) {
            const product = validProducts[0];
            const groupCode = (product as any)?.groupCode;

            if (groupCode) {
              const groupedProducts = await ProductService.getProductsByGroupCode(groupCode);

              if (!groupedProducts || groupedProducts.length === 0) {
                toastHelper.showTost('No products found for this group code', 'warning');
                navigate('/products');
                return;
              }

              setEditProducts(groupedProducts);
              setVariantType('multi');
              setSelectedVariants(groupedProducts.map(mapProductToVariant));
            } else {
              setEditProduct(product);
              setVariantType('single');
              setSelectedVariants([mapProductToVariant(product)]);
            }
          } else {
            setEditProducts(validProducts);
            setVariantType('multi');
            setSelectedVariants(validProducts.map(mapProductToVariant));
          }

          setStep('form');
          try {
            localStorage.removeItem('variant-product-form-data');
          } catch (error) {
            console.error('Error clearing localStorage:', error);
          }
          return;
        }

        // Legacy single editId flow
        if (editId) {
          const product = await ProductService.getProductById(editId);

          console.log('Loaded product for edit:', product);

          if (!product) {
            toastHelper.showTost('Product not found', 'error');
            navigate('/products');
            return;
          }

          const groupCode = (product as any).groupCode;
          if (groupCode) {
            const groupedProducts = await ProductService.getProductsByGroupCode(groupCode);

            setEditProducts(groupedProducts);
            setVariantType('multi');
            setSelectedVariants(groupedProducts.map(mapProductToVariant));
          } else {
            setEditProduct(product);
            setVariantType('single');
            setSelectedVariants([mapProductToVariant(product)]);
          }

          setStep('form');

          try {
            localStorage.removeItem('variant-product-form-data');
          } catch (error) {
            console.error('Error clearing localStorage:', error);
          }
        }
      } catch (error: any) {
        console.error('Error loading product:', error);
        toastHelper.showTost(error.message || 'Failed to load product', 'error');
        navigate('/products');
      } finally {
        setLoadingProduct(false);
      }
    };

    loadProductsForEdit();
  }, [editId, editIds.length, groupCodeParam, navigate]);

  // For multi variant, initialize with empty variant to allow form entry
  useEffect(() => {
    if (variantType === 'multi' && typeParam === 'multi' && selectedVariants.length === 0 && !editId) {
      // Create an empty variant to allow form entry
      setSelectedVariants([{
        skuFamilyId: '',
        subModelName: '',
        storage: '',
        color: '',
        ram: '',
      }]);
    }
  }, [variantType, typeParam, selectedVariants.length, editId]);

  const handleVariantSelection = (type: 'single' | 'multi') => {
    setVariantType(type);
    if (type === 'single') {
      setStep('form');
    } else {
      // For multi-variant, check if variants are already selected from modal
      const savedVariants = sessionStorage.getItem('multiVariantSelectedVariants');
      if (savedVariants) {
        try {
          const parsed = JSON.parse(savedVariants);
          setSelectedVariants(parsed);
          setStep('form');
          sessionStorage.removeItem('multiVariantSelectedVariants');
        } catch (error) {
          console.error('Failed to parse saved variants:', error);
          setStep('variant-config');
          sessionStorage.removeItem('multiVariantSelectedVariants');
        }
      } else {
        setStep('variant-config');
      }
    }
  };

  const handleVariantsSelected = (variants: VariantOption[]) => {
    setSelectedVariants(variants);
    if (variants.length > 0) {
      setStep('form');
    }
  };

  // Helper function to validate ObjectId
  const isValidObjectId = (id: string | null | undefined): boolean => {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  const handleFormSave = async (rows: ProductRowData[], totalMoq?: number | string, customColumns?: Array<{ key: string; label: string; width: number }>) => {
    try {
      setLoading(true);
      // Check if we're in edit mode - include groupCodeParam for multi-variant products
      const isEditMode = Boolean(editId || editIds.length > 0 || groupCodeParam);
      
      // Validate all required IDs before processing
      const validationErrors: string[] = [];
      rows.forEach((row, index) => {
        if (!row.skuFamilyId || !isValidObjectId(row.skuFamilyId)) {
          validationErrors.push(`Row ${index + 1}: Invalid or missing SKU Family ID`);
        }
        if (row.grade && !isValidObjectId(row.grade)) {
          validationErrors.push(`Row ${index + 1}: Invalid Grade ID`);
        }
        if (row.supplierId && !isValidObjectId(row.supplierId)) {
          validationErrors.push(`Row ${index + 1}: Invalid Supplier ID`);
        }
      });

      if (validationErrors.length > 0) {
        toastHelper.showTost(
          `Validation errors:\n${validationErrors.join('\n')}`,
          'error'
        );
        setLoading(false);
        return;
      }
      
      // Transform rows to backend format and create/update products
      // ✅ FIX: Generate a single groupCode for all products in multi-variant group
      // Use existing groupCode from first product if editing, otherwise generate new one
      let sharedGroupCode: string | undefined = undefined;
      if (variantType === 'multi') {
        // Check if we're editing and have an existing groupCode
        if ((editId || editIds.length > 0 || groupCodeParam) && editProducts.length > 0) {
          // Use existing groupCode when editing
          sharedGroupCode = (editProducts[0] as any).groupCode || undefined;
        } else if (rows.length > 0 && rows[0].groupCode && String(rows[0].groupCode).trim()) {
          // Use groupCode from first row if available
          sharedGroupCode = String(rows[0].groupCode).trim();
        } else {
          // Generate new groupCode for new multi-variant products
          sharedGroupCode = `GROUP-${Date.now()}`;
        }
      }

      const productsToCreate = rows.map((row, rowIndex) => {
        // Helper to convert empty strings to null
        const cleanString = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          return val;
        };
        
        // ✅ Get existing product data for edit mode (needed for preserving fields)
        const existingProduct = isEditMode 
          ? (variantType === 'single' ? editProduct : (editProducts[rowIndex] || null))
          : null;
        
        // When editing, use NEW countryDeliverables from calculation flow if available
        let countryDeliverables: any[] = [];
        
        // ✅ CRITICAL: Check if row has NEW countryDeliverables from calculation/preview flow
        // These contain the UPDATED margins and costs based on user's new selections
        // The old margins and costs will be completely replaced by these new ones
        if ((row as any).countryDeliverables && Array.isArray((row as any).countryDeliverables)) {
          // ✅ USE NEW calculated countryDeliverables with UPDATED margins and costs
          // IMPORTANT: Use them DIRECTLY without any modification - they already contain complete data
          // This completely replaces the old countryDeliverables in the database
          countryDeliverables = JSON.parse(JSON.stringify((row as any).countryDeliverables)); // Deep copy to avoid mutations
          
          // ✅ DEBUG: Log to verify new margins and costs are being used
          console.log(`✅ Using NEW countryDeliverables for row ${rowIndex + 1} (EDIT MODE):`, {
            countryDeliverablesCount: countryDeliverables.length,
            marginsAndCosts: countryDeliverables.map((cd: any) => ({
              country: cd.country,
              currency: cd.currency,
              marginsCount: cd.margins?.length || 0,
              costsCount: cd.costs?.length || 0,
              margins: cd.margins?.map((m: any) => ({ 
                name: m.name, 
                type: m.type,
                marginValue: m.marginValue,
                calculatedAmount: m.calculatedAmount
              })) || [],
              costs: cd.costs?.map((c: any) => ({ 
                name: c.name, 
                costId: c.costId || c._id,
                value: c.value,
                calculatedAmount: c.calculatedAmount
              })) || [],
            })),
          });
        } else if (editId && existingProduct) {
          // For edit mode, preserve existing countryDeliverables structure
          if ((existingProduct as any).countryDeliverables) {
            // Preserve existing countryDeliverables with margins and costs
            countryDeliverables = (existingProduct as any).countryDeliverables.map((cd: any) => {
              // Update prices from form data
              if (cd.country === 'Hongkong') {
                return {
                  ...cd,
                  basePrice: parseFloat(String(row.hkUsd)) || cd.basePrice || cd.usd || 0,
                  calculatedPrice: cd.calculatedPrice || parseFloat(String(row.hkUsd)) || cd.usd || 0,
                  usd: parseFloat(String(row.hkUsd)) || cd.usd || 0,
                  xe: parseFloat(String(row.hkXe)) || cd.xe || 0,
                  local: parseFloat(String(row.hkHkd)) || cd.local || cd.hkd || 0,
                  hkd: parseFloat(String(row.hkHkd)) || cd.hkd || 0,
                  price: parseFloat(String(row.hkUsd)) || cd.price || cd.usd || 0,
                  // Preserve margins and costs
                  margins: cd.margins || [],
                  costs: cd.costs || [],
                };
              } else if (cd.country === 'Dubai') {
                return {
                  ...cd,
                  basePrice: parseFloat(String(row.dubaiUsd)) || cd.basePrice || cd.usd || 0,
                  calculatedPrice: cd.calculatedPrice || parseFloat(String(row.dubaiUsd)) || cd.usd || 0,
                  usd: parseFloat(String(row.dubaiUsd)) || cd.usd || 0,
                  xe: parseFloat(String(row.dubaiXe)) || cd.xe || 0,
                  local: parseFloat(String(row.dubaiAed)) || cd.local || cd.aed || 0,
                  aed: parseFloat(String(row.dubaiAed)) || cd.aed || 0,
                  price: parseFloat(String(row.dubaiUsd)) || cd.price || cd.usd || 0,
                  // Preserve margins and costs
                  margins: cd.margins || [],
                  costs: cd.costs || [],
                };
              }
              return cd;
            });
          } else {
            // If no existing countryDeliverables, create new ones
            if (row.hkUsd || row.hkHkd) {
              countryDeliverables.push({
                country: 'Hongkong',
                currency: 'USD',
                basePrice: parseFloat(String(row.hkUsd)) || 0,
                calculatedPrice: parseFloat(String(row.hkUsd)) || 0,
                exchangeRate: parseFloat(String(row.hkXe)) || null,
                price: parseFloat(String(row.hkUsd)) || 0,
                usd: parseFloat(String(row.hkUsd)) || 0,
                xe: parseFloat(String(row.hkXe)) || 0,
                local: parseFloat(String(row.hkHkd)) || 0,
                hkd: parseFloat(String(row.hkHkd)) || 0,
                margins: [],
                costs: [],
                charges: [],
              });
            }
            
            if (row.dubaiUsd || row.dubaiAed) {
              countryDeliverables.push({
                country: 'Dubai',
                currency: 'USD',
                basePrice: parseFloat(String(row.dubaiUsd)) || 0,
                calculatedPrice: parseFloat(String(row.dubaiUsd)) || 0,
                exchangeRate: parseFloat(String(row.dubaiXe)) || null,
                price: parseFloat(String(row.dubaiUsd)) || 0,
                usd: parseFloat(String(row.dubaiUsd)) || 0,
                xe: parseFloat(String(row.dubaiXe)) || 0,
                local: parseFloat(String(row.dubaiAed)) || 0,
                aed: parseFloat(String(row.dubaiAed)) || 0,
                margins: [],
                costs: [],
                charges: [],
              });
            }
          }
        } else {
          // For create mode, create new countryDeliverables with proper structure
          if (row.hkUsd || row.hkHkd) {
            const hkUsd = parseFloat(String(row.hkUsd)) || 0;
            const hkXe = parseFloat(String(row.hkXe)) || null;
            const hkHkd = parseFloat(String(row.hkHkd)) || 0;
            
            countryDeliverables.push({
              country: 'Hongkong',
              currency: 'USD',
              basePrice: hkUsd,
              calculatedPrice: hkUsd, // Will be updated by backend calculation if margins/costs are provided
              exchangeRate: hkXe,
              price: hkUsd,
              usd: hkUsd,
              xe: hkXe,
              local: hkHkd,
              hkd: hkHkd,
              margins: (row as any).hkMargins || [], // Extract margins if provided in row
              costs: (row as any).hkCosts || [], // Extract costs if provided in row
              charges: [],
            });
          }
          
          if (row.dubaiUsd || row.dubaiAed) {
            const dubaiUsd = parseFloat(String(row.dubaiUsd)) || 0;
            const dubaiXe = parseFloat(String(row.dubaiXe)) || null;
            const dubaiAed = parseFloat(String(row.dubaiAed)) || 0;
            
            countryDeliverables.push({
              country: 'Dubai',
              currency: 'USD',
              basePrice: dubaiUsd,
              calculatedPrice: dubaiUsd, // Will be updated by backend calculation if margins/costs are provided
              exchangeRate: dubaiXe,
              price: dubaiUsd,
              usd: dubaiUsd,
              xe: dubaiXe,
              local: dubaiAed,
              aed: dubaiAed,
              margins: (row as any).dubaiMargins || [], // Extract margins if provided in row
              costs: (row as any).dubaiCosts || [], // Extract costs if provided in row
              charges: [],
            });
          }
        }

        // ✅ BUILD COMPLETE PRODUCT OBJECT with ALL fields
        // Include all fields from row data + existing product data (for edit mode) + new countryDeliverables
        const productData: any = {
          // ✅ Core product fields from row
          skuFamilyId: row.skuFamilyId, // Already validated above - required field
          gradeId: (row.grade && isValidObjectId(row.grade)) ? row.grade : null,
          sellerId: (row.supplierId && isValidObjectId(row.supplierId)) ? row.supplierId : null,
          specification: cleanString(row.subModelName) || cleanString(row.version) || cleanString((row as any).specification) || '',
          simType: row.sim || '',
          color: row.colour || '',
          ram: cleanString(row.ram) || '',
          storage: row.storage || '',
          weight: row.weight ? parseFloat(String(row.weight)) : null,
          condition: cleanString(row.condition) || null,
          price: parseFloat(String(row.hkUsd || row.dubaiUsd || 0)),
          stock: parseFloat(String(row.totalQty)) || 0,
          country: (cleanString(row.country) || null) as string | null,
          moq: parseFloat(String(row.moqPerVariant)) || 1,
          purchaseType: (row.purchaseType === 'full' || row.purchaseType === 'partial') ? row.purchaseType : 'partial',
          isNegotiable: row.negotiableFixed === '1',
          // Use flashDeal field from form (code value from constants), convert to boolean string
          isFlashDeal: row.flashDeal && (row.flashDeal === '1' || row.flashDeal === 'true' || row.flashDeal.toLowerCase() === 'yes') ? 'true' : 'false',
          startTime: cleanString(row.startTime) ? new Date(row.startTime).toISOString() : '',
          expiryTime: cleanString(row.endTime) ? new Date(row.endTime).toISOString() : '',
          groupCode: sharedGroupCode, // ✅ Use the same groupCode for all products in the group
          sequence: row.sequence || null,
          // ✅ NEW countryDeliverables with updated margins and costs
          countryDeliverables,
          // Additional fields that need to be stored - convert empty strings to null
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
          // Always include these text fields - send null if empty to clear them (for update mode)
          customMessage: cleanString(row.customMessage) || null,
          totalMoq: variantType === 'multi' && totalMoq ? parseFloat(String(totalMoq)) : null,
          paymentTerm: (() => {
            if (!row.paymentTerm) return [];
            if (Array.isArray(row.paymentTerm)) return row.paymentTerm;
            const paymentTermValue = row.paymentTerm as unknown;
            if (typeof paymentTermValue === 'string') {
              return paymentTermValue.trim() ? [paymentTermValue.trim()] : [];
            }
            return [];
          })(),
          paymentMethod: (() => {
            if (!row.paymentMethod) return [];
            if (Array.isArray(row.paymentMethod)) return row.paymentMethod;
            const paymentMethodValue = row.paymentMethod as unknown;
            if (typeof paymentMethodValue === 'string') {
              return paymentMethodValue.trim() ? [paymentMethodValue.trim()] : [];
            }
            return [];
          })(),
          shippingTime: cleanString(row.shippingTime) || null,
          vendor: cleanString(row.vendor) || null,
          vendorListingNo: cleanString(row.vendorListingNo) || null,
          carrier: cleanString(row.carrier) || null,
          carrierListingNo: cleanString(row.carrierListingNo) || null,
          uniqueListingNo: cleanString(row.uniqueListingNo) || null,
          tags: cleanString(row.tags) || null,
          adminCustomMessage: cleanString(row.adminCustomMessage) || null,
          remark: cleanString(row.remark) || null,
          warranty: cleanString(row.warranty) || null,
          batteryHealth: cleanString(row.batteryHealth) || null,
          lockUnlock: row.lockUnlock === '1',
          // Map status field from form to isStatus field in backend
          // Always use the status from the form if provided, otherwise use existing or default
          isStatus: (() => {
            // If status is provided in the form, use it (normalize "non active" to "nonactive")
            if (row.status && row.status.trim() !== '') {
              const statusValue = row.status.trim();
              if (statusValue === 'nonactive' || statusValue === 'active') {
                return statusValue;
              }
              // Handle "non active" with space
              if (statusValue === 'non active' || statusValue.toLowerCase() === 'non active') {
                return 'nonactive';
              }
              return 'active';
            }
            // If no status in form, use existing isStatus from product (for edit mode) or default to active
            if (isEditMode && existingProduct && (existingProduct as any).isStatus) {
              return (existingProduct as any).isStatus;
            }
            return 'active';
          })(),
        };
        
        // Collect custom fields and send to backend
        // Extract custom field keys from row that start with 'custom_'
        const customFieldsMap: Record<string, string> = {};
        const customColsMetadata: Array<{ key: string; label: string; width: number }> = [];
        
        // For new products, extract from all custom_ keys in row
        // For edit mode, use customColumns passed from ExcelLikeProductForm if available
        if (customColumns !== undefined) {
          // Use customColumns to extract custom fields (for edit mode or when explicitly provided)
          // customColumns can be an empty array when all custom columns were deleted
          customColumns.forEach(customCol => {
            const value = row[customCol.key as keyof ProductRowData];
            // Remove custom_ prefix when sending to backend
            const backendKey = customCol.key.startsWith('custom_') 
              ? customCol.key.replace(/^custom_/, '') 
              : customCol.key;
            // Include value even if empty (backend can handle empty strings)
            const fieldValue = (value && typeof value === 'string') ? value.trim() : '';
            customFieldsMap[backendKey] = fieldValue;
            // Store column metadata
            customColsMetadata.push({
              key: backendKey,
              label: customCol.label || backendKey.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              width: customCol.width || 150
            });
          });
        } else {
          // For new products, extract from all keys starting with 'custom_'
          Object.keys(row).forEach(key => {
            if (key.startsWith('custom_')) {
              const value = row[key as keyof ProductRowData];
              // Remove custom_ prefix when sending to backend
              const backendKey = key.replace(/^custom_/, '');
              // Include value even if empty (backend can handle empty strings)
              const fieldValue = (value && typeof value === 'string') ? value.trim() : '';
              customFieldsMap[backendKey] = fieldValue;
              // Store column metadata
              customColsMetadata.push({
                key: backendKey,
                label: backendKey.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                width: 150
              });
            }
          });
        }
        
        // Always include customFields and customColumns in payload
        // For edit mode or when customColumns is provided: Always include (even if empty) to ensure deletions persist
        // For new products without customColumns: Only include if there are actual custom fields
        if (isEditMode || customColumns !== undefined) {
          // Always include customFields and customColumns in edit mode or when customColumns is provided
          // If empty, send empty object/array to clear them in backend
          productData.customFields = customFieldsMap;
          productData.customColumns = customColsMetadata;
        } else if (Object.keys(customFieldsMap).length > 0) {
          // For new products without customColumns passed, only include if there are actual custom fields
          productData.customFields = customFieldsMap;
          productData.customColumns = customColsMetadata;
        }
        
        // ✅ For edit mode: Preserve additional fields from existing product that might not be in row
        if (isEditMode && existingProduct) {
          // Preserve status, verification, approval fields if they exist
          if ((existingProduct as any).status !== undefined) productData.status = (existingProduct as any).status;
          if ((existingProduct as any).isVerified !== undefined) productData.isVerified = (existingProduct as any).isVerified;
          if ((existingProduct as any).verifiedBy !== undefined) productData.verifiedBy = (existingProduct as any).verifiedBy;
          if ((existingProduct as any).isApproved !== undefined) productData.isApproved = (existingProduct as any).isApproved;
          if ((existingProduct as any).approvedBy !== undefined) productData.approvedBy = (existingProduct as any).approvedBy;
          if ((existingProduct as any).isShowTimer !== undefined) productData.isShowTimer = (existingProduct as any).isShowTimer;
          // Preserve pricingMetadata if it exists
          if ((existingProduct as any).pricingMetadata) productData.pricingMetadata = (existingProduct as any).pricingMetadata;
        }
        
        return productData;
      });

      // Update or create products
      if (isEditMode) {
        console.log('Edit mode detected. editId:', editId, 'editIds:', editIds.length, 'groupCodeParam:', groupCodeParam);
        console.log('Variant type:', variantType, 'editProducts count:', editProducts.length, 'rows count:', rows.length);
        
        // Update existing products
        if (variantType === 'single' && editProduct?._id) {
          // Single variant update
          console.log('Updating single product:', editProduct._id);
          await ProductService.updateProduct(editProduct._id, productsToCreate[0]);
          toastHelper.showTost('Product updated successfully!', 'success');
        } else if (variantType === 'multi' && editProducts.length > 0) {
          // Multi variant update - update all products in the group
          console.log('Updating multi-variant products. editProducts count:', editProducts.length, 'rows count:', rows.length);
          
          // Ensure we have matching products and rows
          if (editProducts.length !== rows.length) {
            console.warn(`Mismatch: editProducts (${editProducts.length}) vs rows (${rows.length}). This may cause issues.`);
          }
          
          // Update each existing product by matching index
          const updatePromises = editProducts.map((editProd, index) => {
            if (editProd._id && productsToCreate[index]) {
              console.log(`Updating product ${index + 1}/${editProducts.length}: ${editProd._id}`);
              return ProductService.updateProduct(editProd._id, productsToCreate[index]);
            } else {
              console.warn(`Skipping product ${index + 1}: missing _id (${editProd._id}) or productData (${!!productsToCreate[index]})`);
            }
            return Promise.resolve();
          });
          
          const results = await Promise.all(updatePromises);
          const successCount = results.filter(r => r !== undefined).length;
          console.log(`Successfully updated ${successCount} out of ${editProducts.length} products`);
          
          if (successCount > 0) {
            toastHelper.showTost(`Successfully updated ${successCount} product(s)!`, 'success');
          } else {
            toastHelper.showTost('No products were updated', 'warning');
          }
        } else {
          // Fallback: if editProducts is empty but we're in edit mode, show error
          console.error('Edit mode but no products to update. variantType:', variantType, 'editProducts.length:', editProducts.length);
          toastHelper.showTost('No products found to update. Please refresh and try again.', 'error');
          setLoading(false);
          return;
        }
        
        // Navigate back to products list after successful update
        setTimeout(() => {
          navigate('/products');
        }, 1000);
      } else {
        // Create new products (only when NOT in edit mode)
        console.log('Create mode: Creating', productsToCreate.length, 'new products');
        const createPromises = productsToCreate.map((product, index) => {
          console.log(`Creating product ${index + 1}/${productsToCreate.length}`);
          return ProductService.createProduct(product);
        });
        await Promise.all(createPromises);
        toastHelper.showTost(`Successfully created ${productsToCreate.length} product(s)!`, 'success');
        
        // Navigate back to products list after successful creation
        setTimeout(() => {
          navigate('/products');
        }, 1000);
      }
      
      // Clear localStorage on successful save
      try {
        localStorage.removeItem('variant-product-form-data');
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }
    } catch (error: any) {
      console.error('Error creating products:', error);
      toastHelper.showTost(error.message || 'Failed to create products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'form') {
      // Both single and multi go back to products list when coming from type param
      if (typeParam === 'single' || typeParam === 'multi') {
        navigate('/products');
      } else {
        if (variantType === 'multi') {
          setStep('variant-config');
        } else {
          setStep('variant-selection');
        }
      }
    } else if (step === 'variant-config') {
      setStep('variant-selection');
    }
  };

  const handleCancel = () => {
    navigate('/products');
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-y-auto">
      {/* Variant Selection Step */}
      {step === 'variant-selection' && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-6xl">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <i className="fas fa-boxes text-white text-2xl"></i>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
                        {editId ? 'Edit Product' : 'Create New Product'}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Choose your listing type to get started
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => handleVariantSelection('single')}
                    className="group relative p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 text-left transform hover:scale-105 hover:shadow-2xl"
                  >
                    <div className="absolute top-4 right-4 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                      <i className="fas fa-check text-blue-600 dark:text-blue-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                        <i className="fas fa-file-alt text-white text-3xl"></i>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        Single Variant
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        Create one product listing with a single set of specifications. Perfect for individual products.
                      </p>
                      <div className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <i className="fas fa-info-circle mr-1"></i>
                          Best for: Single products
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleVariantSelection('multi')}
                    className="group relative p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300 text-left transform hover:scale-105 hover:shadow-2xl"
                  >
                    <div className="absolute top-4 right-4 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                      <i className="fas fa-check text-purple-600 dark:text-purple-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                        <i className="fas fa-layer-group text-white text-3xl"></i>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Multi Variant
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        Create multiple variants using smart filters. Select models, storage, and colors to auto-generate all combinations.
                      </p>
                      <div className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <i className="fas fa-bolt mr-1"></i>
                          Best for: Multiple variants
                        </p>
                      </div>
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
              <div className="bg-purple-600 dark:bg-purple-800 p-6 border-b-2 border-purple-500 dark:border-purple-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 dark:bg-white/10 rounded-lg flex items-center justify-center">
                      <i className="fas fa-layer-group text-white text-xl"></i>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Multi-Variant Configuration
                      </h2>
                      <p className="text-purple-100 text-sm mt-1">
                        Select models, storage, and colors to generate product variants
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <CascadingVariantSelector onVariantsSelected={handleVariantsSelected} />
                {selectedVariants.length > 0 && (
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-5 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-sm font-medium transition-all duration-200 flex items-center gap-2"
                    >
                      <i className="fas fa-arrow-left"></i>
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-semibold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                    >
                      <i className="fas fa-arrow-right"></i>
                      Continue to Form
                      <span className="ml-1 px-2.5 py-0.5 bg-white/30 rounded-full text-sm font-bold">
                        {selectedVariants.length}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Step - Full Width and Height */}
      {step === 'form' && (
        <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
          <div className="flex-shrink-0 bg-blue-600 dark:bg-blue-800 px-5 py-2 border-b-2 border-blue-500 dark:border-blue-700 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 dark:bg-white/10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-table text-white text-xl"></i>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {variantType === 'multi' ? 'Multi-Variant Product Form' : 'Single Variant Product Form'}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1 flex items-center gap-2">
                    <i className="fas fa-info-circle text-xs"></i>
                    Excel-like interface • Scroll horizontally to see all columns
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {loadingProduct ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading product data...</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">{(editId || editIds.length > 0 || groupCodeParam) ? 'Updating products...' : 'Creating products...'}</p>
                </div>
              </div>
            ) : variantType ? (
              <ExcelLikeProductForm
                variantType={variantType}
                variants={selectedVariants}
                onSave={handleFormSave}
                onCancel={handleCancel}
                editProducts={
                  (editId || editIds.length > 0 || groupCodeParam) 
                    ? (variantType === 'multi' 
                        ? editProducts 
                        : (editProduct ? [editProduct] : [])) 
                    : []
                }
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantForm;
