import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { format } from "date-fns";
import toastHelper from "../../utils/toastHelper";
import ProductModal from "./ProductsModal";
import ProductListingModal from "./ProductListingModal";
import ProductHistoryModal from "./ProductHistoryModal";
import VariantSelectionModal from "./VariantSelectionModal";
import SellerProductReviewModal from "./SellerProductReviewModal";
import SellerProductPermissionModal from "./SellerProductPermissionModal";
import SubmitAdminDetailsModal from "./SubmitAdminDetailsModal";
import ProductImageVideoModal from "./ProductImageVideoModal";

// Tooltip Component for Action Items
interface ActionTooltipProps {
  text: string;
}

const ActionTooltip: React.FC<ActionTooltipProps> = ({ text }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <i className="fas fa-info-circle text-xs"></i>
      </button>
      {showTooltip && (
        <div className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 z-50 w-48 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg whitespace-normal">
          {text}
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-900 dark:border-l-gray-700"></div>
        </div>
      )}
    </div>
  );
};
import {
  ProductService,
  Product,
} from "../../services/product/product.services";
import { SellerService, Seller } from "../../services/seller/sellerService";
import placeholderImage from "../../../public/images/product/noimage.jpg";
import { useDebounce } from "../../hooks/useDebounce";
import { usePermissions } from "../../context/PermissionsContext";

interface ProductsTableProps {
  loggedInAdminId?: string; 
}

const ProductsTable: React.FC<ProductsTableProps> = ({ loggedInAdminId }) => {
const navigate = useNavigate();
  const { hasPermission, permissions } = usePermissions();
  const canWrite = hasPermission('/products', 'write');
  const canVerifyApprove = hasPermission('/products', 'verifyApprove');
  const isSuperAdmin = permissions?.role === 'superadmin';
  
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all"); // "all" | "moveToTop" | "expiredOnly" | "soldOut" | "showTimer"
  const [sellerFilter, setSellerFilter] = useState<string>("all"); // "all" | sellerId
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isListingModalOpen, setIsListingModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isVariantSelectOpen, setIsVariantSelectOpen] = useState<boolean>(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [historyProductId, setHistoryProductId] = useState<string | undefined>(undefined);
  const [historyProductName, setHistoryProductName] = useState<string | undefined>(undefined);
  const itemsPerPage = 10;
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkActionDropdownOpen, setBulkActionDropdownOpen] = useState<boolean>(false);
  const [isSellerPermissionModalOpen, setIsSellerPermissionModalOpen] = useState<boolean>(false);
  const [isSellerReviewModalOpen, setIsSellerReviewModalOpen] = useState<boolean>(false);
  const [selectedSellerRequest, setSelectedSellerRequest] = useState<Product | null>(null);
  const [isSellerRequestView, setIsSellerRequestView] = useState<boolean>(false);
  const [isAdminDetailsModalOpen, setIsAdminDetailsModalOpen] = useState<boolean>(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [isImageVideoModalOpen, setIsImageVideoModalOpen] = useState<boolean>(false);
  const [selectedProductForImages, setSelectedProductForImages] = useState<Product | null>(null);

  // Helper to extract seller id from various shapes
  const getProductSellerId = (product: any): string | null => {
    const tryExtract = (value: any): string | null => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (typeof value === 'object') {
        return value._id || value.id || value.sellerId || null;
      }
      return null;
    };

    return (
      tryExtract(product?.sellerId) ||
      tryExtract(product?.addedBySeller) ||
      tryExtract(product?.createdBy) ||
      null
    );
  };

  const handleExport = async () => {
    try {
      const blob = await ProductService.exportProductsExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toastHelper.showTost('Export started', 'success');
    } catch (error) {}
  };

  // Fetch sellers on component mount
  useEffect(() => {
    const fetchSellers = async () => {
      try {
        // Get all sellers for the filter dropdown (admin should see all sellers)
        const response = await SellerService.getSellerList({ page: 1, limit: 1000 });
        console.log('Fetched sellers response:', response);
        const allSellers = response.docs || [];
        console.log('All sellers count:', allSellers.length);
        
        // Show all sellers in the dropdown (don't filter by isActive)
        // Admin should be able to filter by any seller
        setSellers(allSellers);
        
        if (allSellers.length === 0) {
          console.warn('No sellers found');
        } else {
          console.log('Sellers loaded successfully:', allSellers.map(s => ({ id: s._id, name: s.name, code: s.code })));
        }
      } catch (error) {
        console.error('Failed to fetch sellers:', error);
        toastHelper.showTost('Failed to load sellers list', 'error');
      }
    };
    fetchSellers();
  }, []);

  // Fetch products on component mount and when page/search/filter changes
  useEffect(() => {
    fetchProducts();
  }, [currentPage, debouncedSearchTerm, statusFilter, productFilter, sellerFilter]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target) return;
      if (!(event.target as HTMLElement).closest(".dropdown-container")) {
        setOpenDropdownId(null);
        setDropdownPosition(null);
      }
    };

    const handleResize = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
        setDropdownPosition(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("resize", handleResize);
    };
  }, [openDropdownId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('fetchProducts - productFilter:', productFilter);
      
      // Check if we're viewing seller requests
      if (productFilter === "sellerRequests") {
        setIsSellerRequestView(true);
        const response = await ProductService.getSellerProductRequests(
          currentPage,
          itemsPerPage,
          debouncedSearchTerm
        );
        let docs = response.data.docs || [];

        if (sellerFilter !== "all") {
          docs = docs.filter((product: any) => getProductSellerId(product) === sellerFilter);
        }

        setProductsData(docs);

        if (sellerFilter !== "all") {
          const filteredCount = docs.length;
          setTotalDocs(filteredCount);
          setTotalPages(Math.max(1, Math.ceil(filteredCount / itemsPerPage)));
        } else {
          setTotalDocs(response.data.totalDocs || 0);
          setTotalPages(response.data.totalPages || 1);
        }
        setLoading(false);
        return;
      }
      
      setIsSellerRequestView(false);
      const moveToTop = productFilter === "moveToTop";
      const expiredOnly = productFilter === "expiredOnly";
      const soldOut = productFilter === "soldOut";
      const showTimer = productFilter === "showTimer";
      const response = await ProductService.getProductList(
        currentPage,
        itemsPerPage,
        debouncedSearchTerm,
        moveToTop,
        expiredOnly,
        soldOut,
        showTimer
      );
      console.log('fetchProducts - response data count:', response.data.docs.length);
      console.log('fetchProducts - sellerFilter:', sellerFilter);

      let filteredData = response.data.docs;

      // Apply seller filter first
      if (sellerFilter !== "all") {
        // Log first product structure to debug
        if (filteredData.length > 0) {
          console.log('Sample product structure:', {
            sellerId: (filteredData[0] as any).sellerId,
            addedBySeller: (filteredData[0] as any).addedBySeller,
            isAddedBySeller: (filteredData[0] as any).isAddedBySeller,
            fullProduct: filteredData[0]
          });
        }
        
        filteredData = filteredData.filter((product: any) => {
          // Handle sellerId as object or string
          let productSellerId: string | null = null;
          
          if (product.sellerId) {
            if (typeof product.sellerId === 'object' && product.sellerId !== null) {
              productSellerId = product.sellerId._id || product.sellerId.id || null;
            } else if (typeof product.sellerId === 'string') {
              productSellerId = product.sellerId;
            }
          }
          
          // Also check if sellerId might be in a different field (like addedBySeller, createdBy, etc.)
          if (!productSellerId && product.addedBySeller) {
            const addedBySeller = product.addedBySeller;
            if (typeof addedBySeller === 'object' && addedBySeller !== null) {
              productSellerId = addedBySeller._id || addedBySeller.id || null;
            } else if (typeof addedBySeller === 'string') {
              productSellerId = addedBySeller;
            }
          }
          
          // Check isAddedBySeller field - if true, product might have seller info elsewhere
          if (!productSellerId && product.isAddedBySeller && product.sellerId) {
            // Try sellerId again with different structure
            const sellerIdField = product.sellerId;
            if (typeof sellerIdField === 'object' && sellerIdField !== null) {
              productSellerId = sellerIdField._id || sellerIdField.id || null;
            } else if (typeof sellerIdField === 'string') {
              productSellerId = sellerIdField;
            }
          }
          
          const matches = productSellerId === sellerFilter;
          if (sellerFilter && !matches) {
            console.log('Product filtered out:', {
              productId: product._id,
              productSellerId,
              filterSellerId: sellerFilter,
              matches
            });
          }
          
          return matches;
        });
        
        console.log('After seller filter, products count:', filteredData.length, 'out of', response.data.docs.length);
      }

      // Apply status filter
      if (statusFilter !== "all") {
        filteredData = filteredData.filter((product: Product) => {
          if (statusFilter === "approved") {
            return product.isApproved;
          } else if (statusFilter === "pending") {
            return product.isVerified && !product.isApproved;
          } else if (statusFilter === "verification") {
            return !product.isVerified;
          }
          return true;
        });
      }

      setProductsData(filteredData);
      
      // Use API's totalDocs and totalPages for pagination
      // But if filtering client-side, we need to recalculate based on filtered results
      if (statusFilter !== "all" || sellerFilter !== "all") {
        // When filtering client-side, we can't use server pagination properly
        // For now, use the filtered count but this is not ideal
        // TODO: Move status and seller filtering to server-side
        setTotalDocs(filteredData.length);
        setTotalPages(Math.ceil(filteredData.length / itemsPerPage));
      } else {
        // Use server pagination when no filter is applied
        const totalDocsFromAPI = response.data.totalDocs || 0;
        const totalPagesFromAPI = response.data.totalPages;
        
        setTotalDocs(totalDocsFromAPI);
        
        // If API provides totalPages, use it; otherwise calculate from totalDocs
        if (totalPagesFromAPI !== undefined && totalPagesFromAPI !== null) {
          setTotalPages(totalPagesFromAPI);
        } else {
          // Fallback: calculate from totalDocs if available
          setTotalPages(Math.ceil(totalDocsFromAPI / itemsPerPage));
        }
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
      setProductsData([]);
      setTotalPages(1);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (productData: any) => {
    try {
      // Transform countryDeliverables to ensure currency and basePrice are present
      const transformedCountryDeliverables = (productData.countryDeliverables || []).map((cd: any) => {
        // If currency and basePrice are missing, try to infer from legacy fields
        let currency = cd.currency;
        let basePrice = cd.basePrice;
        
        if (!currency) {
          // Infer currency from country and existing fields
          if (cd.country === 'Hongkong') {
            currency = cd.hkd ? 'HKD' : 'USD';
          } else if (cd.country === 'Dubai') {
            currency = cd.aed ? 'AED' : 'USD';
          } else {
            currency = 'USD'; // Default
          }
        }
        
        // Ensure basePrice is set (can be 0)
        if (basePrice === undefined || basePrice === null) {
          // Infer basePrice from currency
          if (currency === 'USD') {
            basePrice = cd.usd !== undefined && cd.usd !== null ? cd.usd : (cd.price !== undefined && cd.price !== null ? cd.price : 0);
          } else if (currency === 'HKD') {
            basePrice = cd.hkd !== undefined && cd.hkd !== null ? cd.hkd : (cd.local !== undefined && cd.local !== null ? cd.local : 0);
          } else if (currency === 'AED') {
            basePrice = cd.aed !== undefined && cd.aed !== null ? cd.aed : (cd.local !== undefined && cd.local !== null ? cd.local : 0);
          } else {
            basePrice = cd.usd !== undefined && cd.usd !== null ? cd.usd : (cd.price !== undefined && cd.price !== null ? cd.price : 0);
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
      });
      
      // Filter out invalid entries (must have country, currency, and basePrice)
      const validCountryDeliverables = transformedCountryDeliverables.filter((cd: any) => 
        cd.country && cd.currency && (cd.basePrice !== undefined && cd.basePrice !== null)
      );
      
      // Extract paymentTerm and paymentMethod from productData (top level or from first countryDeliverable for backward compatibility)
      let paymentTerm: string[] = [];
      let paymentMethod: string[] = [];
      
      if (productData.paymentTerm) {
        paymentTerm = Array.isArray(productData.paymentTerm) 
          ? productData.paymentTerm 
          : (productData.paymentTerm ? [productData.paymentTerm] : []);
      } else if (productData.countryDeliverables && productData.countryDeliverables.length > 0 && productData.countryDeliverables[0].paymentTerm) {
        // Backward compatibility: extract from first countryDeliverable
        const cdPaymentTerm = productData.countryDeliverables[0].paymentTerm;
        paymentTerm = Array.isArray(cdPaymentTerm) ? cdPaymentTerm : (cdPaymentTerm ? [cdPaymentTerm] : []);
      }
      
      if (productData.paymentMethod) {
        paymentMethod = Array.isArray(productData.paymentMethod) 
          ? productData.paymentMethod 
          : (productData.paymentMethod ? [productData.paymentMethod] : []);
      } else if (productData.countryDeliverables && productData.countryDeliverables.length > 0 && productData.countryDeliverables[0].paymentMethod) {
        // Backward compatibility: extract from first countryDeliverable
        const cdPaymentMethod = productData.countryDeliverables[0].paymentMethod;
        paymentMethod = Array.isArray(cdPaymentMethod) ? cdPaymentMethod : (cdPaymentMethod ? [cdPaymentMethod] : []);
      }
      
      const processedData = {
        ...productData,
        stock:
          typeof productData.stock === "string"
            ? parseInt(productData.stock)
            : productData.stock,
        moq:
          typeof productData.moq === "string"
            ? parseInt(productData.moq)
            : productData.moq,
        countryDeliverables: validCountryDeliverables,
        paymentTerm: paymentTerm,
        paymentMethod: paymentMethod,
      };
      
      console.log('Processed data for API:', JSON.stringify(processedData, null, 2));

      if (editProduct && editProduct._id) {
        await ProductService.updateProduct(editProduct._id, processedData);
        toastHelper.showTost("Product updated successfully!", "success");
      } else {
        await ProductService.createProduct(processedData);
        toastHelper.showTost("Product added successfully!", "success");
      }
      setIsModalOpen(false);
      setEditProduct(null);
      fetchProducts();
    } catch (error) {
      console.error("Failed to save product:", error);
    }
  };

  const handleEdit = (product: Product) => {
    // Multi-variant products are identified by a groupCode and should open the multi-variant form
    const groupCode = (product as any)?.groupCode;

    if (groupCode) {
      navigate(`/products/create?groupCode=${encodeURIComponent(groupCode)}`);
    } else if (product._id) {
      // Single-variant edit
      navigate(`/products/create?editId=${product._id}`);
    }

    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleDelete = async (product: Product) => {
    if (!product._id) return;

    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel!",
    });

    if (confirmed.isConfirmed) {
      try {
        await ProductService.deleteProduct(product._id);
        toastHelper.showTost("Product deleted successfully!", "success");
        fetchProducts();
      } catch (error) {
        console.error("Failed to delete product:", error);
      }
    }
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleVerify = async (product: Product) => {
    if (!product._id) return;

    const confirmed = await Swal.fire({
      title: "Verify Product",
      text: "Are you sure you want to verify this product?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, verify it!",
      cancelButtonText: "No, cancel!",
    });

    if (confirmed.isConfirmed) {
      try {
        const result = await ProductService.verifyProduct(product._id);
        if (result !== false) {
          fetchProducts();
        }
      } catch (error) {
        console.error("Failed to verify product:", error);
      }
    }
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleApprove = async (product: Product) => {
    if (!product._id) return;

    const confirmed = await Swal.fire({
      title: "Approve Product",
      text: "Are you sure you want to approve this product?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, approve it!",
      cancelButtonText: "No, cancel!",
    });

    if (confirmed.isConfirmed) {
      try {
        const result = await ProductService.approveProduct(product._id);
        if (result !== false) {
          fetchProducts();
        }
      } catch (error) {
        console.error("Failed to approve product:", error);
      }
    }
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleHistory = (product: Product) => {
    setHistoryProductId(product._id);
    setHistoryProductName(getSkuFamilyText(product.skuFamilyId));
    setIsHistoryModalOpen(true);
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleToggleSelect = (productId: string | undefined) => {
    if (!productId) return;
    setSelectedProductIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProductIds.size === productsData.length) {
      setSelectedProductIds(new Set());
    } else {
      const allIds = productsData
        .map((p) => p._id)
        .filter((id): id is string => Boolean(id));
      setSelectedProductIds(new Set(allIds));
    }
  };

  const handleToggleSequence = async () => {
    if (selectedProductIds.size === 0) {
      toastHelper.showTost('Please select at least one product', 'warning');
      return;
    }

    const confirmed = await Swal.fire({
      title: 'Toggle Sequence',
      text: `Are you sure you want to toggle sequence for ${selectedProductIds.size} product(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, toggle it!',
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        const productIdsArray = Array.from(selectedProductIds);
        await ProductService.toggleSequence(productIdsArray);
        setSelectedProductIds(new Set());
        fetchProducts();
      } catch (error) {
        console.error('Failed to toggle sequence:', error);
      }
    }
  };

  const handleExpire = async (product: Product) => {
    if (!product._id) return;

    const confirmed = await Swal.fire({
      title: 'Expire Product',
      text: 'Are you sure you want to expire this product? It will be hidden from the frontend.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, expire it!',
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        await ProductService.expireProducts(product._id);
        setSelectedProductIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(product._id!);
          return newSet;
        });
        fetchProducts();
      } catch (error) {
        console.error('Failed to expire product:', error);
      }
    }
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleBulkExpire = async () => {
    if (selectedProductIds.size === 0) {
      toastHelper.showTost('Please select at least one product', 'warning');
      return;
    }

    const confirmed = await Swal.fire({
      title: 'Expire Products',
      text: `Are you sure you want to expire ${selectedProductIds.size} product(s)? They will be hidden from the frontend.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, expire them!',
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        const productIdsArray = Array.from(selectedProductIds);
        await ProductService.expireProducts(productIdsArray);
        setSelectedProductIds(new Set());
        fetchProducts();
      } catch (error) {
        console.error('Failed to expire products:', error);
      }
    }
  };

  const handleBulkToggleTimer = async () => {
    if (selectedProductIds.size === 0) {
      toastHelper.showTost('Please select at least one product', 'warning');
      return;
    }

    // Check current timer state of selected products
    const selectedProducts = productsData.filter(p => p._id && selectedProductIds.has(p._id));
    const allHaveTimer = selectedProducts.every(p => p.isShowTimer === true);
    
    // Determine new state: if all have timer, disable; otherwise enable
    const newTimerState = !allHaveTimer;
    const actionText = newTimerState ? 'enable' : 'disable';

    const confirmed = await Swal.fire({
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Timer`,
      text: `Are you sure you want to ${actionText} timer for ${selectedProductIds.size} product(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Yes, ${actionText} it!`,
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        const productIdsArray = Array.from(selectedProductIds);
        await ProductService.toggleTimer(productIdsArray, newTimerState);
        setSelectedProductIds(new Set());
        fetchProducts();
      } catch (error) {
        console.error('Failed to toggle timer:', error);
      }
    }
  };

  const handleMarkSoldOut = async () => {
    if (selectedProductIds.size === 0) {
      toastHelper.showTost('Please select at least one product', 'warning');
      return;
    }

    const confirmed = await Swal.fire({
      title: 'Mark as Sold Out',
      text: `Are you sure you want to mark ${selectedProductIds.size} product(s) as sold out? This will set their stock to 0.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark as sold out!',
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        const productIdsArray = Array.from(selectedProductIds);
        await ProductService.markSoldOut(productIdsArray);
        setSelectedProductIds(new Set());
        fetchProducts();
      } catch (error) {
        console.error('Failed to mark products as sold out:', error);
      }
    }
  };

  const handleBulkEdit = () => {
    if (selectedProductIds.size === 0) {
      toastHelper.showTost('Please select at least one product', 'warning');
      return;
    }

    const selectedProducts = productsData.filter(
      (p) => p._id && selectedProductIds.has(p._id),
    );

    if (selectedProducts.length === 0) {
      toastHelper.showTost('Selected products not found', 'error');
      return;
    }

    // Enforce groupCode rules:
    // - If multi-variant (groupCode present), all selected must share the same groupCode
    // - Do not mix single-variant (no groupCode) with multi-variant selections
    const groupCodes = new Set(
      selectedProducts
        .map((p) => (p as any)?.groupCode)
        .filter((code): code is string => Boolean(code)),
    );

    if (groupCodes.size > 1) {
      toastHelper.showTost(
        'Please select multi-variant products with the same group code only.',
        'warning',
      );
      return;
    }

    if (groupCodes.size === 1) {
      const groupCode = Array.from(groupCodes)[0];
      const mixedSingle = selectedProducts.some((p) => !(p as any)?.groupCode);
      if (mixedSingle) {
        toastHelper.showTost(
          `Cannot mix multi-variant products (group ${groupCode}) with single-variant products. Select only products with the same group code.`,
          'warning',
        );
        return;
      }
    }

    const idsParam = selectedProducts
      .map((p) => p._id)
      .filter((id): id is string => Boolean(id))
      .join(',');
    setBulkActionDropdownOpen(false);
    navigate(`/products/create?editIds=${encodeURIComponent(idsParam)}`);
  };

  const handleBulkVerify = async () => {
    if (selectedProductIds.size === 0) {
      toastHelper.showTost('Please select at least one product', 'warning');
      return;
    }

    const confirmed = await Swal.fire({
      title: 'Verify Products',
      text: `Are you sure you want to verify ${selectedProductIds.size} product(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, verify them!',
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        const productIdsArray = Array.from(selectedProductIds);
        await ProductService.bulkVerify(productIdsArray);
        setSelectedProductIds(new Set());
        fetchProducts();
      } catch (error) {
        console.error('Failed to verify products:', error);
      }
    }
  };

  const handleBulkApprove = async () => {
    if (selectedProductIds.size === 0) {
      toastHelper.showTost('Please select at least one product', 'warning');
      return;
    }

    const confirmed = await Swal.fire({
      title: 'Approve Products',
      text: `Are you sure you want to approve ${selectedProductIds.size} product(s)? Products must be verified first.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, approve them!',
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        const productIdsArray = Array.from(selectedProductIds);
        await ProductService.bulkApprove(productIdsArray);
        setSelectedProductIds(new Set());
        fetchProducts();
      } catch (error) {
        console.error('Failed to approve products:', error);
      }
    }
  };

  const handleSingleProductToggleSequence = async (product: Product) => {
    if (!product._id) return;

    const currentSequence = product.sequence === null || product.sequence === undefined ? 'null' : product.sequence;
    const newSequence = currentSequence === 'null' ? '0' : 'null';

    const confirmed = await Swal.fire({
      title: 'Toggle Sequence',
      text: `Are you sure you want to toggle sequence for this product? Sequence will change from ${currentSequence} to ${newSequence}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, toggle it!',
      cancelButtonText: 'No, cancel!',
    });

    if (confirmed.isConfirmed) {
      try {
        await ProductService.moveToTop(product._id);
        fetchProducts();
      } catch (error) {
        console.error('Failed to toggle sequence:', error);
      }
    }
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const getSkuFamilyText = (skuFamilyId: any): string => {
    if (skuFamilyId == null) return "";
    if (typeof skuFamilyId === "string") return skuFamilyId;
    if (typeof skuFamilyId === "object") {
      return skuFamilyId.name || skuFamilyId.code || skuFamilyId._id || "";
    }
    return String(skuFamilyId);
  };


  const buildImageUrl = (relativeOrAbsolute: string): string => {
    if (!relativeOrAbsolute)
      return "https://via.placeholder.com/60x60?text=Product";
    const isAbsolute = /^https?:\/\//i.test(relativeOrAbsolute);
    if (isAbsolute) return relativeOrAbsolute;
    const base = import.meta.env.VITE_BASE_URL || "";
    return `${base}${
      relativeOrAbsolute.startsWith("/") ? "" : "/"
    }${relativeOrAbsolute}`;
  };

  const getProductImageSrc = (product: Product): string => {
    try {
      // ✅ Try to get image from product itself first (product-specific images)
      if (product && (product as any).images && Array.isArray((product as any).images) && (product as any).images.length > 0) {
        const first = (product as any).images[0];
        if (first) return buildImageUrl(first);
      }
      
      // Fallback: Get image from skuFamilyId
      const sku = product?.skuFamilyId as any;
      if (sku && typeof sku === 'object') {
        const skuImage = Array.isArray(sku?.images) && sku.images.length > 0 ? sku.images[0] : null;
        if (skuImage) return buildImageUrl(skuImage);
      }
    } catch (_) {}
    return placeholderImage;
  };

  const renderProductBadges = (product: Product) => {
    const badges = [];
    
    if (product.simType) {
      badges.push({ label: product.simType, tooltip: `SIM Type: ${product.simType}` });
    }
    if (product.color) {
      badges.push({ label: product.color, tooltip: `Color: ${product.color}` });
    }
    if (product.ram) {
      badges.push({ label: product.ram, tooltip: `RAM: ${product.ram}` });
    }
    if (product.storage) {
      badges.push({ label: product.storage, tooltip: `Storage: ${product.storage}` });
    }

    if (badges.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-1 mt-2">
        {badges.map((badge, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="text-gray-400 dark:text-gray-500 mx-0.5">•</span>
            )}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700 cursor-pointer transition-colors hover:bg-blue-200 dark:hover:bg-blue-900/50"
              title={badge.tooltip}
            >
              {badge.label}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const formatPrice = (price: number | string): string => {
    if (price === null || price === undefined) return "-";
    if (typeof price === "string") {
      const num = parseFloat(price);
      return isNaN(num) ? "0.00" : num.toFixed(2);
    }
    return price.toFixed(2);
  };

  const isMultiVariant = (product: Product): boolean => {
    return Boolean((product as any)?.groupCode);
  };

  const getCountryPrice = (product: Product, country: "Hongkong" | "Dubai"): string => {
    // Get price from countryDeliverables
    if (Array.isArray(product.countryDeliverables) && product.countryDeliverables.length > 0) {
      const entry = product.countryDeliverables.find((cd) => cd.country === country);
      if (entry && entry.usd !== undefined && entry.usd !== null) {
        return `$${formatPrice(entry.usd)}`;
      }
    }

    return "-";
  };

  const formatExpiryTime = (expiryTime: string): string => {
    if (!expiryTime) return "-";
    try {
      const date = new Date(expiryTime);
      return format(date, "MMM dd, yyyy");
    } catch {
      return "-";
    }
  };

  // Updated getStatusBadge function to match reference code styling and icons
  const getStatusBadge = (product: Product) => {
    let statusText: string;
    let statusStyles: string;
    let statusIcon: string;

    // Check if product needs admin details (for seller products)
    const needsAdminDetails = (product as any).needsAdminDetails || 
      (product.status === 'pending_admin_details' && !(product as any).adminDetailsSubmitted);

    if (product.isApproved) {
      statusText = "Approved";
      statusStyles =
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700";
      statusIcon = "fa-check-circle";
    } else if (product.isVerified) {
      statusText = "Pending Approval";
      statusStyles =
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700";
      statusIcon = "fa-clock";
    } else if (needsAdminDetails) {
      statusText = "Pending Admin Details";
      statusStyles =
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700";
      statusIcon = "fa-exclamation-circle";
    } else {
      statusText = "Under Verification";
      statusStyles =
        "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700";
      statusIcon = "fa-times";
    }

    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${statusStyles}`}
      >
        <i className={`fas ${statusIcon} text-xs`}></i>
        {statusText}
      </span>
    );
  };

  const handleAddDetails = (product: Product) => {
    setSelectedProductForDetails(product);
    setIsAdminDetailsModalOpen(true);
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  return (
    <div className="p-4">
      
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by name, SKU Family, color, price, supplier, grade, listing number..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={productFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setProductFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none cursor-pointer min-w-[180px]"
              >
                <option value="all">All Products</option>
                <option value="sellerRequests">Seller Requests</option>
                <option value="moveToTop">Moved to Top</option>
                <option value="expiredOnly">Expired Only</option>
                <option value="soldOut">Sold Out</option>
                <option value="showTimer">Timer Enabled</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
            </div>
            <div className="relative">
              <select
                value={sellerFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setSellerFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none cursor-pointer min-w-[180px]"
              >
                <option value="all">All Sellers</option>
                {sellers && sellers.length > 0 ? (
                  sellers.map((seller) => (
                    <option key={seller._id} value={seller._id}>
                      {seller.name} {seller.code ? `(${seller.code})` : ''}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Loading sellers...</option>
                )}
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending Approval</option>
                <option value="verification">Under Verification</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
            </div>
            <div className="flex items-center gap-1">
              {selectedProductIds.size > 0 && (
                <div className="relative">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                    onClick={() => setBulkActionDropdownOpen(!bulkActionDropdownOpen)}
                  >
                    <i className="fas fa-cog text-xs"></i>
                    Actions ({selectedProductIds.size})
                    <i className={`fas fa-chevron-${bulkActionDropdownOpen ? 'up' : 'down'} text-xs`}></i>
                  </button>
                  {bulkActionDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setBulkActionDropdownOpen(false)}
                      ></div>
                      <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-20">
                        <div className="py-1" role="menu">
                          {canWrite && (
                            <button
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                              onClick={() => {
                                setBulkActionDropdownOpen(false);
                                handleBulkEdit();
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <i className="fas fa-edit text-xs text-blue-600"></i>
                                Edit Products
                              </div>
                              <ActionTooltip text="Edit multiple selected products at once. Opens the variant selection modal to choose editing mode." />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                              onClick={() => {
                                setBulkActionDropdownOpen(false);
                                handleToggleSequence();
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <i className="fas fa-sort-numeric-down text-xs text-yellow-600"></i>
                                Toggle Sequence
                              </div>
                              <ActionTooltip text="Toggle the display sequence/order of selected products. This affects how products appear in listings." />
                            </button>
                          )}
                          {canVerifyApprove && (
                            <>
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                                onClick={() => {
                                  setBulkActionDropdownOpen(false);
                                  handleBulkExpire();
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-clock text-xs text-red-600"></i>
                                  Expire
                                </div>
                                <ActionTooltip text="Mark selected products as expired. Expired products are no longer available for purchase." />
                              </button>
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                                onClick={() => {
                                  setBulkActionDropdownOpen(false);
                                  handleBulkToggleTimer();
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-stopwatch text-xs text-purple-600"></i>
                                  Toggle Timer
                                </div>
                                <ActionTooltip text="Enable or disable the countdown timer display for selected products. Useful for flash deals and time-sensitive offers." />
                              </button>
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                                onClick={() => {
                                  setBulkActionDropdownOpen(false);
                                  handleMarkSoldOut();
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-box text-xs text-orange-600"></i>
                                  Mark as Sold Out
                                </div>
                                <ActionTooltip text="Mark selected products as sold out. This updates the stock status and prevents further orders." />
                              </button>
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                                onClick={() => {
                                  setBulkActionDropdownOpen(false);
                                  handleBulkVerify();
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-check-circle text-xs text-green-600"></i>
                                  Verify
                                </div>
                                <ActionTooltip text="Verify selected products. Verified products have been checked for accuracy and are ready for approval." />
                              </button>
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                                onClick={() => {
                                  setBulkActionDropdownOpen(false);
                                  handleBulkApprove();
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-check-double text-xs text-blue-600"></i>
                                  Approve
                                </div>
                                <ActionTooltip text="Approve selected products. Approved products are published and visible to customers. Products must be verified before approval." />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {canWrite && (
                <>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg bg-purple-600 text-white px-4 py-2 text-sm font-medium hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 transition-colors"
                    onClick={() => setIsSellerPermissionModalOpen(true)}
                    title="Manage Seller Product Permissions"
                  >
                    <i className="fas fa-user-shield text-xs"></i>
                    Seller Permissions
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                    onClick={() => setIsVariantSelectOpen(true)}
                  >
                    <i className="fas fa-plus text-xs"></i>
                    Add Product
                  </button>
                </>
              )}
              <button
                className="inline-flex items-center gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                onClick={handleExport}
              >
                <i className="fas fa-download text-xs"></i>
                Export
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  <input
                    type="checkbox"
                    checked={productsData.length > 0 && selectedProductIds.size === productsData.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Image
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  SKU Family
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  HK Price (USD)
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Dubai Price (USD)
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Products...
                    </div>
                  </td>
                </tr>
              ) : productsData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No products found
                    </div>
                  </td>
                </tr>
              ) : (
                productsData.map((item: Product, index: number) => (
                  <tr
                    key={item._id || index}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      item.sequence !== null && item.sequence !== undefined
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={item._id ? selectedProductIds.has(item._id) : false}
                        onChange={() => handleToggleSelect(item._id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <img
                        src={getProductImageSrc(item) || placeholderImage}
                        alt={getSkuFamilyText(item?.skuFamilyId) || "Product"}
                        className="w-12 h-12 object-cover rounded-md border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setSelectedProductForImages(item);
                          setIsImageVideoModalOpen(true);
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            placeholderImage;
                        }}
                        title="Click to manage images and videos"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                        <span>{getSkuFamilyText(item.skuFamilyId)}  {item?.specification?.toString() !==  getSkuFamilyText(item.skuFamilyId).toString() ? item?.specification?.toString() : ""}</span>
                        {isMultiVariant(item) && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 border border-purple-200"
                            title={`Multi-variant group: ${(item as any).groupCode || ''}`}
                          >
                            MV
                          </span>
                        )}
                      </div>
                      {renderProductBadges(item)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {getSkuFamilyText(item.skuFamilyId)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {getCountryPrice(item, "Hongkong")}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {getCountryPrice(item, "Dubai")}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {getStatusBadge(item)}
                    </td>
                    <td className="px-6 py-4 text-sm text-center relative">
                      <div className="dropdown-container relative">
                        <button
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openDropdownId === item._id) {
                              setOpenDropdownId(null);
                              setDropdownPosition(null);
                            } else {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const dropdownWidth = 192;
                              const dropdownHeight = 200; // Adjusted for more options
                              let top = rect.bottom + 8;
                              let left = rect.right - dropdownWidth;

                              if (top + dropdownHeight > window.innerHeight) {
                                top = rect.top - dropdownHeight - 8;
                              }
                              if (left < 8) {
                                left = 8;
                              }
                              if (
                                left + dropdownWidth >
                                window.innerWidth - 8
                              ) {
                                left = window.innerWidth - dropdownWidth - 8;
                              }

                              setDropdownPosition({ top, left });
                              setOpenDropdownId(item._id || null);
                            }
                          }}
                        >
                          <i className="fas fa-ellipsis-v"></i>
                        </button>
                        {openDropdownId === item._id && dropdownPosition && (
                          <div
                            className="fixed w-48 bg-white border rounded-md shadow-lg"
                            style={{
                              top: `${dropdownPosition.top}px`,
                              left: `${dropdownPosition.left}px`,
                              zIndex: 9999,
                            }}
                          >
                            {isSellerRequestView ? (
                              <>
                                {/* Show "Add Details" button if product needs admin details */}
                                {/* {((item as any).needsAdminDetails || (item.status === 'pending_admin_details' && !(item as any).adminDetailsSubmitted)) ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddDetails(item);
                                    }}
                                    className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-orange-600 group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <i className="fas fa-edit"></i>
                                      Add Details
                                    </div>
                                    <ActionTooltip text="Add or update admin-specific details for this product. Required for seller-submitted products before verification." />
                                  </button>
                                ) : null} */}
                                {/* Show Verify button only if admin details submitted and not verified */}
                                {((item as any).adminDetailsSubmitted || !(item as any).needsAdminDetails) && 
                                 canVerifyApprove && item.canVerify && item.verifiedBy !== loggedInAdminId && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleVerify(item);
                                      }}
                                      className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-green-600 group"
                                    >
                                      <div className="flex items-center gap-2">
                                        <i className="fas fa-check"></i>
                                        Verify
                                      </div>
                                      <ActionTooltip text="Verify this product. Verified products have been checked for accuracy and are ready for approval by another admin." />
                                    </button>
                                  )}
                                {/* Show Approve button only if verified and not approved */}
                                {item.isVerified && !item.isApproved && canVerifyApprove && item.canApprove && 
                                 item.verifiedBy !== loggedInAdminId && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApprove(item);
                                    }}
                                    className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-blue-600 group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <i className="fas fa-thumbs-up"></i>
                                      Approve
                                    </div>
                                    <ActionTooltip text="Approve this product. Approved products are published and visible to customers. Product must be verified before approval." />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSellerRequest(item);
                                    setIsSellerReviewModalOpen(true);
                                  }}
                                  className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-blue-600 group"
                                >
                                  <div className="flex items-center gap-2">
                                    <i className="fas fa-eye"></i>
                                    Review
                                  </div>
                                  <ActionTooltip text="Review this seller-submitted product. Check all details and approve or request changes before it goes live." />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Show "Add Details" button if product needs admin details (for seller products) */}
                                {/* {((item as any).needsAdminDetails || (item.status === 'pending_admin_details' && !(item as any).adminDetailsSubmitted)) && canWrite && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddDetails(item);
                                    }}
                                    className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-orange-600 group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <i className="fas fa-edit"></i>
                                      Add Details
                                    </div>
                                    <ActionTooltip text="Add or update admin-specific details for this product. Required for seller-submitted products before verification." />
                                  </button>
                                )} */}
                                {/* Show Verify button only if admin details submitted (for seller products) or not a seller product */}
                                {canVerifyApprove && item.canVerify &&
                                  item.verifiedBy !== loggedInAdminId && 
                                  (!(item as any).needsAdminDetails || (item as any).adminDetailsSubmitted) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleVerify(item);
                                      }}
                                      className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-green-600 group"
                                    >
                                      <div className="flex items-center gap-2">
                                        <i className="fas fa-check"></i>
                                        Verify
                                      </div>
                                      <ActionTooltip text="Verify this product. Verified products have been checked for accuracy and are ready for approval by another admin." />
                                    </button>
                                  )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleView(item);
                                  }}
                                  className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-blue-600 group"
                                >
                                  <div className="flex items-center gap-2">
                                    <i className="fas fa-eye"></i>
                                    View
                                  </div>
                                  <ActionTooltip text="View detailed information about this product including all specifications, pricing, and status." />
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHistory(item);
                              }}
                              className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-purple-600 group"
                            >
                              <div className="flex items-center gap-2">
                                <i className="fas fa-history"></i>
                                History
                              </div>
                              <ActionTooltip text="View the complete change history of this product including all edits, status changes, and modifications." />
                            </button>
                            {canVerifyApprove && item.canApprove &&
                              item.verifiedBy !== loggedInAdminId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(item);
                                  }}
                                  className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-blue-600 group"
                                >
                                  <div className="flex items-center gap-2">
                                    <i className="fas fa-thumbs-up"></i>
                                    Approve
                                  </div>
                                  <ActionTooltip text="Approve this product. Approved products are published and visible to customers. Product must be verified before approval." />
                                </button>
                              )}
                            {canWrite && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSingleProductToggleSequence(item);
                                  }}
                                  className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-orange-600 group"
                                >
                                  <div className="flex items-center gap-2">
                                    <i className="fas fa-arrow-up"></i>
                                    Toggle Sequence
                                  </div>
                                  <ActionTooltip text="Move this product to the top of the listing. This gives it priority in search results and product listings." />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(item);
                                  }}
                                  className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-green-600 group"
                                >
                                  <div className="flex items-center gap-2">
                                    <i className="fas fa-edit"></i>
                                    Edit
                                  </div>
                                  <ActionTooltip text="Edit this product's details including specifications, pricing, margins, costs, and other attributes." />
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item);
                                    }}
                                    className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-red-600 group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <i className="fas fa-trash"></i>
                                      Delete
                                    </div>
                                    <ActionTooltip text="Permanently delete this product. This action cannot be undone. Only super admins can delete products." />
                                  </button>
                                )}
                              </>
                            )}
                            {canVerifyApprove && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExpire(item);
                                }}
                                className="flex items-center justify-between w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-red-600 group"
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-clock"></i>
                                  Expire
                                </div>
                                <ActionTooltip text="Mark this product as expired. Expired products are no longer available for purchase and will be hidden from customer view." />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
            Showing {productsData.length} of {totalDocs} items
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Previous
            </button>
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      currentPage === pageNum
                        ? "bg-[#0071E0] text-white dark:bg-blue-500 dark:text-white border border-blue-600 dark:border-blue-500"
                        : "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    } transition-colors`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ProductListingModal
        isOpen={isListingModalOpen}
        onClose={() => {
          setIsListingModalOpen(false);
        }}
        onSuccess={fetchProducts}
      />
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditProduct(null);
        }}
        onSave={handleSave}
        editItem={editProduct || undefined}
      />

      <ProductHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryProductId(undefined);
          setHistoryProductName(undefined);
        }}
        productId={historyProductId}
        productName={historyProductName}
      />

      <VariantSelectionModal
        isOpen={isVariantSelectOpen}
        onClose={() => setIsVariantSelectOpen(false)}
        onSelectVariant={(type) => {
          setIsVariantSelectOpen(false);
          if (type === 'single') {
            navigate('/products/create?type=single');
          } else {
            navigate('/products/create?type=multi');
          }
        }}
      />

      <SellerProductPermissionModal
        isOpen={isSellerPermissionModalOpen}
        onClose={() => setIsSellerPermissionModalOpen(false)}
        onUpdate={fetchProducts}
      />

      {selectedSellerRequest && (
        <SellerProductReviewModal
          isOpen={isSellerReviewModalOpen}
          onClose={() => {
            setIsSellerReviewModalOpen(false);
            setSelectedSellerRequest(null);
          }}
          product={selectedSellerRequest}
          onUpdate={fetchProducts}
        />
      )}

      {/* Admin Details Modal */}
      {selectedProductForDetails && (
        <SubmitAdminDetailsModal
          isOpen={isAdminDetailsModalOpen}
          onClose={() => {
            setIsAdminDetailsModalOpen(false);
            setSelectedProductForDetails(null);
          }}
          product={selectedProductForDetails}
          onSuccess={fetchProducts}
        />
      )}

      {/* Product Image/Video Modal */}
      {selectedProductForImages && (
        <ProductImageVideoModal
          isOpen={isImageVideoModalOpen}
          onClose={() => {
            setIsImageVideoModalOpen(false);
            setSelectedProductForImages(null);
          }}
          product={selectedProductForImages}
          onUpdate={() => {
            fetchProducts();
          }}
        />
      )}

      {selectedProduct && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <img
                  src={getProductImageSrc(selectedProduct)}
                  alt={getSkuFamilyText(selectedProduct?.skuFamilyId)}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600 flex-shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      placeholderImage;
                  }}
                />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {getSkuFamilyText(selectedProduct.skuFamilyId)}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Product Details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 flex-shrink-0"
                title="Close"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="mb-6">{getStatusBadge(selectedProduct)}</div>

              <div className="space-y-6">
                {/* Basic Information Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {getSkuFamilyText(selectedProduct.skuFamilyId)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SKU Family
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {getSkuFamilyText(selectedProduct.skuFamilyId)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Specification
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.specification || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SIM Type
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.simType}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Color
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.color}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        RAM
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.ram}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Storage
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.storage}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Weight (kg)
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).weight || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Flash Deal
                      </label>
                      <p className={`text-sm font-medium bg-gray-50 dark:bg-gray-800 p-3 rounded-md ${selectedProduct.isFlashDeal ? "text-green-600" : "text-red-600"}`}>
                        {selectedProduct.isFlashDeal ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Negotiable
                      </label>
                      <p className={`text-sm font-medium bg-gray-50 dark:bg-gray-800 p-3 rounded-md ${selectedProduct.isNegotiable ? "text-green-600" : "text-red-600"}`}>
                        {selectedProduct.isNegotiable ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Purchase Type
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md capitalize">
                        {(selectedProduct as any).purchaseType || 'partial'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pricing & Inventory Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                    Pricing & Inventory
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Stock
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.stock} units
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        MOQ
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.moq} units
                      </p>
                    </div>
                    {selectedProduct.totalMoq !== undefined && selectedProduct.totalMoq !== null && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          MOQ PER CART
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                          {selectedProduct.totalMoq} units
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Country
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.country || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Start Time
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {selectedProduct.startTime ? formatExpiryTime(selectedProduct.startTime) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Expiry Time
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {formatExpiryTime(selectedProduct.expiryTime)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Sequence
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).sequence ?? 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Group Code
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).groupCode || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md capitalize">
                        {(selectedProduct as any).status || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Verified
                      </label>
                      <p className={`text-sm font-medium bg-gray-50 dark:bg-gray-800 p-3 rounded-md ${(selectedProduct as any).isVerified ? "text-green-600" : "text-red-600"}`}>
                        {(selectedProduct as any).isVerified ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Approved
                      </label>
                      <p className={`text-sm font-medium bg-gray-50 dark:bg-gray-800 p-3 rounded-md ${(selectedProduct as any).isApproved ? "text-green-600" : "text-red-600"}`}>
                        {(selectedProduct as any).isApproved ? "Yes" : "No"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pricing (by Country)
                    </label>
                    <div className="space-y-2">
                      {Array.isArray(selectedProduct.countryDeliverables) && selectedProduct.countryDeliverables.length > 0 ? (
                        selectedProduct.countryDeliverables.map((cd, idx) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{cd.country}:</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              ${formatPrice(cd.usd || 0)} USD
                            </p>
                            {cd.xe && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Exchange Rate: {cd.xe}
                              </p>
                            )}
                            {cd.local && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Local: {formatPrice(cd.local)} {cd.country === 'Hongkong' ? 'HKD' : 'AED'}
                              </p>
                            )}
                            {cd.hkd && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                HKD: {formatPrice(cd.hkd)}
                              </p>
                            )}
                            {cd.aed && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                AED: {formatPrice(cd.aed)}
                              </p>
                            )}
                            {cd.charges && cd.charges.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Charges:</p>
                                {cd.charges.map((charge, cIdx) => (
                                  <p key={cIdx} className="text-xs text-gray-500 dark:text-gray-500">
                                    • {charge.name}: {formatPrice(charge.value)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No pricing information available</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Margins & Costs Details Section */}
                {Array.isArray(selectedProduct.countryDeliverables) && selectedProduct.countryDeliverables.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                      Margins & Costs Details
                    </h3>
                    <div className="space-y-4">
                      {selectedProduct.countryDeliverables.map((cd: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="text-md font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                            <i className="fas fa-globe text-blue-600"></i>
                            {cd.country || 'N/A'}
                            {cd.currency && (
                              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                ({cd.currency})
                              </span>
                            )}
                          </h4>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Margins Section */}
                            <div>
                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <i className="fas fa-chart-line text-blue-600"></i>
                                Margins
                                {cd.margins && Array.isArray(cd.margins) && cd.margins.length > 0 && (
                                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                    ({cd.margins.length})
                                  </span>
                                )}
                              </h5>
                              {cd.margins && Array.isArray(cd.margins) && cd.margins.length > 0 ? (
                                <div className="space-y-2">
                                  {cd.margins.map((margin: any, mIdx: number) => (
                                    <div
                                      key={mIdx}
                                      className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800"
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            {margin.name || 'N/A'}
                                          </p>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            Type: <span className="font-medium capitalize">{margin.type || 'N/A'}</span>
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                            +{formatPrice(margin.calculatedAmount || 0)}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="text-gray-600 dark:text-gray-400">Margin Type:</span>
                                            <span className="ml-1 font-medium text-gray-800 dark:text-gray-200 capitalize">
                                              {margin.marginType || 'N/A'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-600 dark:text-gray-400">Value:</span>
                                            <span className="ml-1 font-medium text-gray-800 dark:text-gray-200">
                                              {margin.marginType === 'percentage' 
                                                ? `${margin.marginValue || 0}%` 
                                                : `$${formatPrice(margin.marginValue || 0)}`}
                                            </span>
                                          </div>
                                        </div>
                                        {margin.description && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                                            {margin.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No margins applied</p>
                              )}
                            </div>

                            {/* Costs Section */}
                            <div>
                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <i className="fas fa-dollar-sign text-green-600"></i>
                                Costs
                                {cd.costs && Array.isArray(cd.costs) && cd.costs.length > 0 && (
                                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                    ({cd.costs.length})
                                  </span>
                                )}
                              </h5>
                              {cd.costs && Array.isArray(cd.costs) && cd.costs.length > 0 ? (
                                <div className="space-y-2">
                                  {cd.costs.map((cost: any, cIdx: number) => (
                                    <div
                                      key={cIdx}
                                      className={`p-3 rounded-md border ${
                                        cost.isExpressDelivery || cost.isSameLocationCharge
                                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            {cost.name || 'N/A'}
                                            {(cost.isExpressDelivery || cost.isSameLocationCharge) && (
                                              <span className="ml-2 text-xs px-1.5 py-0.5 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                                                {cost.isExpressDelivery ? 'Express' : 'Same Location'}
                                              </span>
                                            )}
                                          </p>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            Field: <span className="font-medium capitalize">{cost.costField || 'N/A'}</span>
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                            +{formatPrice(cost.calculatedAmount || 0)}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="text-gray-600 dark:text-gray-400">Cost Type:</span>
                                            <span className="ml-1 font-medium text-gray-800 dark:text-gray-200">
                                              {cost.costType || 'N/A'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-gray-600 dark:text-gray-400">Value:</span>
                                            <span className="ml-1 font-medium text-gray-800 dark:text-gray-200">
                                              {cost.costType === 'Percentage' 
                                                ? `${cost.value || 0}%` 
                                                : `$${formatPrice(cost.value || 0)}`}
                                            </span>
                                          </div>
                                          {cost.costUnit && (
                                            <div className="col-span-2">
                                              <span className="text-gray-600 dark:text-gray-400">Unit:</span>
                                              <span className="ml-1 font-medium text-gray-800 dark:text-gray-200 capitalize">
                                                {cost.costUnit}
                                              </span>
                                            </div>
                                          )}
                                          {cost.groupId && (
                                            <div className="col-span-2">
                                              <span className="text-gray-600 dark:text-gray-400">Group ID:</span>
                                              <span className="ml-1 font-medium text-gray-800 dark:text-gray-200">
                                                {cost.groupId}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No costs applied</p>
                              )}
                            </div>
                          </div>

                          {/* Summary */}
                          {(cd.margins && cd.margins.length > 0) || (cd.costs && cd.costs.length > 0) ? (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Base Price:</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  ${formatPrice(cd.basePrice || 0)}
                                </span>
                              </div>
                              {cd.margins && cd.margins.length > 0 && (
                                <div className="flex items-center justify-between text-sm mt-1">
                                  <span className="text-gray-600 dark:text-gray-400">Total Margins:</span>
                                  <span className="font-medium text-blue-600 dark:text-blue-400">
                                    +${formatPrice(
                                      cd.margins.reduce((sum: number, m: any) => sum + (m.calculatedAmount || 0), 0)
                                    )}
                                  </span>
                                </div>
                              )}
                              {cd.costs && cd.costs.length > 0 && (
                                <div className="flex items-center justify-between text-sm mt-1">
                                  <span className="text-gray-600 dark:text-gray-400">Total Costs:</span>
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    +${formatPrice(
                                      cd.costs.reduce((sum: number, c: any) => sum + (c.calculatedAmount || 0), 0)
                                    )}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-sm font-semibold mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-gray-800 dark:text-gray-200">Final Price:</span>
                                <span className="text-lg text-blue-600 dark:text-blue-400">
                                  ${formatPrice(cd.calculatedPrice || cd.usd || 0)}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Details Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                    Additional Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Supplier Listing Number
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).supplierListingNumber || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Customer Listing Number
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).customerListingNumber || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Packing
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).packing || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Current Location
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).currentLocation || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Delivery Location
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {Array.isArray((selectedProduct as any).deliveryLocation) 
                          ? (selectedProduct as any).deliveryLocation.join(', ') 
                          : ((selectedProduct as any).deliveryLocation || 'N/A')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Term
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {Array.isArray((selectedProduct as any).paymentTerm) 
                          ? (selectedProduct as any).paymentTerm.join(', ') 
                          : ((selectedProduct as any).paymentTerm || 'N/A')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Method
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {Array.isArray((selectedProduct as any).paymentMethod) 
                          ? (selectedProduct as any).paymentMethod.join(', ') 
                          : ((selectedProduct as any).paymentMethod || 'N/A')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Shipping Time
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).shippingTime || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Vendor
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md capitalize">
                        {(selectedProduct as any).vendor || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Vendor Listing No
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).vendorListingNo || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Carrier
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md capitalize">
                        {(selectedProduct as any).carrier || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Carrier Listing No
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).carrierListingNo || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Unique Listing No
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).uniqueListingNo || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tags
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).tags || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Warranty
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).warranty || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Battery Health
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).batteryHealth || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Lock/Unlock
                      </label>
                      <p className={`text-sm font-medium bg-gray-50 dark:bg-gray-800 p-3 rounded-md ${(selectedProduct as any).lockUnlock ? "text-red-600" : "text-green-600"}`}>
                        {(selectedProduct as any).lockUnlock ? "Lock" : "Unlock"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Version
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                        {(selectedProduct as any).version || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages & Notes Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                    Messages & Notes
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Custom Message
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md min-h-[60px]">
                        {(selectedProduct as any).customMessage || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Admin Custom Message
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md min-h-[60px]">
                        {(selectedProduct as any).adminCustomMessage || 'N/A'}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Remark
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md min-h-[60px]">
                        {(selectedProduct as any).remark || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Custom Fields Section */}
                {(selectedProduct as any).customFields && Object.keys((selectedProduct as any).customFields).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                      Custom Fields
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries((selectedProduct as any).customFields).map(([key, value]) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">
                            {key.replace(/custom_/g, '').replace(/_/g, ' ')}
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                            {String(value) || 'N/A'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsTable;
