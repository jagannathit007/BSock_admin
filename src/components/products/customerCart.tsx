import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import toastHelper from "../../utils/toastHelper";
import CustomerCartService, { CustomerCartItem, CartProduct } from "../../services/order/customerCart.services";
import { useDebounce } from "../../hooks/useDebounce";

// Interface for Customer Cart data
interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

type CustomerCart = CustomerCartItem & { updatedAt?: string };

const CustomerCart: React.FC = () => {
  const [customerCartsData, setCustomerCartsData] = useState<CustomerCart[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [previewItem, setPreviewItem] = useState<CustomerCart | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [itemsPerPage] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalDocs, setTotalDocs] = useState<number>(0);

  // Fetch customer carts on filters change
  useEffect(() => {
    fetchCustomerCarts();
  }, [currentPage, debouncedSearchTerm, selectedCustomer]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  // Fetch all customers once on mount
  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCustomerCarts = async () => {
    try {
      setLoading(true);
      const response = await CustomerCartService.getCustomerCartList(
        currentPage,
        itemsPerPage,
        debouncedSearchTerm,
        selectedCustomer
      );
      const docs = (response?.data?.docs || []) as any[];
      console.log('Fetched cart docs:', docs.length > 0 ? docs[0] : 'No docs'); // Debug: Log first doc
      console.log('First doc costSummary:', docs.length > 0 ? docs[0]?.costSummary : 'No costSummary'); // Debug: Log costSummary
      const mapped: CustomerCart[] = docs.map((d: any) => ({
        _id: d._id,
        customer: {
          _id: d.customerId?._id || "",
          name: d.customerId?.name || "",
          email: d.customerId?.email || "",
        },
        product: {
          _id: d.productId?._id || "",
          skuFamilyId: d.skuFamilyId || null,
          simType: d.simType,
          color: d.color,
          ram: d.ram,
          storage: d.storage,
          condition: d.condition,
          price: (() => {
            // Try to get price from cart item first
            if (d.price) return d.price;
            // Then try product's countryDeliverables
            if (d.productId?.countryDeliverables && Array.isArray(d.productId.countryDeliverables) && d.productId.countryDeliverables.length > 0) {
              const deliverable = d.productId.countryDeliverables[0];
              return deliverable.usd || 0;
            }
            // Fallback to legacy price field
            return d.productId?.price ?? 0;
          })(),
          stock: d.stock,
          country: d.country,
          moq: d.moq,
          isNegotiable: d.isNegotiable,
          isFlashDeal: d.isFlashDeal,
          expiryTime: d.expiryTime,
          specification: d.specification ?? null,
          purchaseType: d.purchaseType,
          isApproved: d.isApproved,
          isDeleted: d.isDeleted,
        },
        quantity: parseFloat(String(d.quantity)) || 0,
        addedAt: d.createdAt || d.updatedAt || "",
        updatedAt: d.updatedAt || "",
        status: d.isActive ? "active" : "removed",
        notes: undefined,
        costSummary: d.costSummary || {
          totalCartValue: 0,
          totalAmount: 0,
          appliedCharges: []
        }
      }));

      const nTotalPages = parseInt(String(response?.data?.totalPages || 1)) || 1;

      setCustomerCartsData(mapped);
      setTotalPages(nTotalPages);
    } catch (error) {
      console.error("Failed to fetch customer carts:", error);
      toastHelper.showTost(
        (error as any)?.message || "Failed to fetch customer carts",
        "error"
      );
      setCustomerCartsData([]);
      setTotalPages(1);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      // Load a large page of cart items to aggregate all customers
      const resp = await CustomerCartService.getCustomerCartList(1, 10);
      const docs = (resp?.data?.docs || []) as any[];
      const uniqueMap = new Map<string, Customer>();
      for (const d of docs) {
        const c = d?.customerId;
        if (c?._id && !uniqueMap.has(c._id)) {
          uniqueMap.set(c._id, { _id: c._id, name: c.name, email: c.email });
        }
      }
      setCustomers(Array.from(uniqueMap.values()));
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      toastHelper.showTost((error as any)?.message || 'Failed to fetch customers', 'error');
    }
  };


  const handlePreview = (cartItem: CustomerCart) => {
    console.log('Preview item costSummary:', (cartItem as any).costSummary); // Debug
    setPreviewItem(cartItem);
    setIsPreviewModalOpen(true);
  };

  // Safely get product title: use specification only; if null/empty, show blank
  const getProductTitle = (productOrSku: any): string => {
    const product: any = productOrSku && productOrSku._id ? productOrSku : null;
    if (product) {
      const spec = product.specification;
      if (spec === null || spec === undefined || String(spec).trim() === "") {
        return "N/A";
      }
      return String(spec);
    }
    // If called with non-product, do not fallback; return blank
    return "";
  };

  // Build image URL
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

  // Get product image
  const getProductImageSrc = (product: CartProduct): string => {
    try {
      const sku = product?.skuFamilyId as any;
      const first =
        Array.isArray(sku?.images) && sku.images.length > 0
          ? sku.images[0]
          : "";
      if (first) return buildImageUrl(first);
    } catch (_) {}
    return "https://via.placeholder.com/60x60?text=Product";
  };

  // Format price
  const formatPrice = (price: number | string): string => {
    if (typeof price === "string") {
      const num = parseFloat(price);
      return isNaN(num) ? "0.00" : num.toFixed(2);
    }
    return price.toFixed(2);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return format(date, "yyyy-MM-dd HH:mm");
    } catch {
      return "-";
    }
  };

  // Utility function to convert a string to title case (only first letter capitalized)
  const toTitleCase = (str: string): string => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // Get status styles
  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700";
      case "removed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700";
      case "ordered":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-700";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 border border-gray-200 dark:border-gray-700";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "fa-check-circle";
      case "removed":
        return "fa-times";
      case "ordered":
        return "fa-shopping-cart";
      default:
        return "";
    }
  };

  return (
    <div className="p-4">
      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        {/* Table Header with Controls */}
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by product title..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          {/* Customer Filter */}
          <div className="relative">
            <i className="fas fa-user absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            <select
              className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-48 appearance-none cursor-pointer"
              value={selectedCustomer}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setSelectedCustomer(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Customers</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
          </div>
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Product Details
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Customer Details
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Quantity
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Added Date
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Customer Carts...
                    </div>
                  </td>
                </tr>
              ) : customerCartsData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No customer carts found
                    </div>
                  </td>
                </tr>
              ) : (
                customerCartsData.map((item: CustomerCart, index: number) => (
                  <tr
                    key={item._id || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Product Details Column */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {/* <img
                          src={getProductImageSrc(item.product)}
                          alt={getProductTitle(item.product)}
                          className="w-16 h-16 object-contain rounded-full border border-gray-200 dark:border-gray-600 flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAQhoZ9wi9UzWyWDidI7NIP2qPzL4dGE6k9w&s";
                          }}
                        /> */}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {getProductTitle(item.product)}
                          </h3>
                          <div className="mt-1 space-y-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                              {item.product.color && (
                                <span>Color: {item.product.color}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                              <span>
                                Price: ${formatPrice(item.product.price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Customer Details Column */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {item.customer.name}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {item.customer.email}
                        </p>
                        {item.customer.phone && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {item.customer.phone}
                          </p>
                        )}
                        {item.customer.address && (
                          <p
                            className="text-xs text-gray-600 dark:text-gray-400 truncate"
                            title={item.customer.address}
                          >
                            {item.customer.address}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Quantity Column */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <span
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                      >
                        {item.quantity}
                      </span>
                    </td>

                    {/* Status Column */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold  tracking-wider ${getStatusStyles(
                          item.status
                        )}`}
                      >
                        <i
                          className={`fas ${getStatusIcon(item.status)} text-xs`}
                        ></i>
                        {toTitleCase(item.status)}
                      </span>
                    </td>

                    {/* Added Date Column */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(item.addedAt)}
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handlePreview(item)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Preview Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
            Showing {customerCartsData.length} of {totalDocs} items
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Previous
            </button>

            {/* Page Numbers */}
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

      {/* Preview Modal */}
      {isPreviewModalOpen && previewItem && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header - Sticky */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Cart Item Details
                </h2>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors duration-200"
                >
                  <svg
                    className="w-5 h-5"
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
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="space-y-6">
                {/* Product and Customer Info Grid */}
                <div className="grid md:grid-cols-1 gap-6">
                  {/* Product Details */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
                      Product Information
                    </h3>

                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                      <div className="flex items-start gap-4">
                        {/* <img
                          src={getProductImageSrc(previewItem.product)}
                          alt={getProductTitle(previewItem.product)}
                          className="w-16 h-16 object-contain rounded-md border border-gray-200 dark:border-gray-600 bg-white"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSAQhoZ9wi9UzWyWDidI7NIP2qPzL4dGE6k9w&s";
                          }}
                        /> */}
                        <div className="flex-1">
                          <h4 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-2">
                            {getProductTitle(previewItem.product)}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            {previewItem.product.simType && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">
                                  SIM Type:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {previewItem.product.simType}
                                </span>
                              </div>
                            )}
                            {previewItem.product.color && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">
                                  Color:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {previewItem.product.color}
                                </span>
                              </div>
                            )}
                            {previewItem.product.ram && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">
                                  RAM:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {previewItem.product.ram}
                                </span>
                              </div>
                            )}
                            {previewItem.product.storage && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">
                                  Storage:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {previewItem.product.storage}
                                </span>
                              </div>
                            )}
                            {previewItem.product.specification && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">
                                  Specification:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {previewItem.product.specification}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-left gap-1">
                              <span className="text-gray-800 dark:text-gray-200">
                                Condition:
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {previewItem.product.condition}
                              </span>
                            </div>
                            <div className="flex justify-left gap-1">
                              <span className="text-gray-800 dark:text-gray-200">
                                Price:
                              </span>
                              <span className="text-green-600 dark:text-green-200 font-medium">
                                ${formatPrice(previewItem.product.price)}
                              </span>
                            </div>
                            <div className="flex justify-left gap-1">
                              <span className="text-gray-800 dark:text-gray-200">
                                Stock:
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {previewItem.product.stock}
                              </span>
                            </div>
                            <div className="flex justify-left gap-1">
                              <span className="text-gray-800 dark:text-gray-200">
                                Country:
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {previewItem.product.country}
                              </span>
                            </div>
                            <div className="flex justify-left gap-1">
                              <span className="text-gray-800 dark:text-gray-200">
                                MOQ:
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {previewItem.product.moq}
                              </span>
                            </div>
                            {previewItem.product.purchaseType && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">
                                  Purchase Type:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400 capitalize">
                                  {previewItem.product.purchaseType}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-left gap-1">
                              <span className="text-gray-800 dark:text-gray-200">
                                Negotiable:
                              </span>
                              <span
                                className={`${
                                  previewItem.product.isNegotiable
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {previewItem.product.isNegotiable
                                  ? "Yes"
                                  : "No"}
                              </span>
                            </div>
                            <div className="flex justify-left gap-1">
                              <span className="text-gray-800 dark:text-gray-200">
                                Flash Deal:
                              </span>
                              <span
                                className={`${
                                  previewItem.product.isFlashDeal === true ||
                                  previewItem.product.isFlashDeal === "true"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {previewItem.product.isFlashDeal === true ||
                                previewItem.product.isFlashDeal === "true"
                                  ? "Yes"
                                  : "No"}
                              </span>
                            </div>
                            {previewItem.product.expiryTime && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">
                                  Expires:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {formatDate(previewItem.product.expiryTime)}
                                </span>
                              </div>
                            )}
                            {typeof previewItem.product.isApproved !== 'undefined' && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">Approved:</span>
                                <span className={`${previewItem.product.isApproved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {previewItem.product.isApproved ? 'Yes' : 'No'}
                                </span>
                              </div>
                            )}
                            {typeof previewItem.product.isDeleted !== 'undefined' && (
                              <div className="flex justify-left gap-1">
                                <span className="text-gray-800 dark:text-gray-200">Deleted:</span>
                                <span className={`${previewItem.product.isDeleted ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                  {previewItem.product.isDeleted ? 'Yes' : 'No'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
                      Customer Information
                    </h3>

                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Name */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-600 dark:text-gray-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                          <div>
                            <div className="text-gray-800 dark:text-gray-200 font-medium">
                              {previewItem.customer.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Customer Name
                            </div>
                          </div>
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-600 dark:text-gray-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <div>
                            <div className="text-gray-800 dark:text-gray-200 font-medium">
                              {previewItem.customer.email}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Email Address
                            </div>
                          </div>
                        </div>

                        {/* Phone */}
                        {previewItem.customer.phone && (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-gray-600 dark:text-gray-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                            </div>
                            <div>
                              <div className="text-gray-800 dark:text-gray-200 font-medium">
                                {previewItem.customer.phone}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Phone Number
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Address */}
                        {previewItem.customer.address && (
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mt-1">
                              <svg
                                className="w-5 h-5 text-gray-600 dark:text-gray-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </div>
                            <div>
                              <div className="text-gray-800 dark:text-gray-200 font-medium">
                                {previewItem.customer.address}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Address
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cart Statistics */}
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
                    Cart Statistics
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">
                        {previewItem.quantity}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Quantity
                      </div>
                    </div>

                    <div
                      className={`text-center p-4 rounded-lg border ${
                        previewItem.status === "active"
                          ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                          : previewItem.status === "removed"
                          ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div
                        className={`text-lg font-semibold mb-1 capitalize ${
                          previewItem.status === "active"
                            ? "text-green-600 dark:text-green-400"
                            : previewItem.status === "removed"
                            ? "text-red-600 dark:text-red-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {toTitleCase(previewItem.status)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Status
                      </div>
                    </div>

                    <div className="text-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400 mb-1">
                        $
                        {(
                          (parseFloat(String(previewItem.product.price)) || 0) * previewItem.quantity
                        ).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Total Value
                      </div>
                    </div>

                    <div className="text-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                        {formatDate(previewItem.addedAt)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Added Date
                      </div>
                    </div>
                    <div className="text-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                        {formatDate(previewItem.updatedAt || previewItem.addedAt)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Updated Date
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Cost Summary Section */}
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">
                    Applied Charges
                  </h3>
                  {(previewItem as any).costSummary && (previewItem as any).costSummary.appliedCharges && (previewItem as any).costSummary.appliedCharges.length > 0 ? (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ${((previewItem as any).costSummary.totalCartValue || 0).toFixed(2)}
                        </span>
                      </div>
                      <div>Logistics Fee</div>
                      {(previewItem as any).costSummary.appliedCharges.map((charge: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {charge.type === 'ExtraDelivery' ? 'Extra Delivery' : charge.type}
                            {charge.costType === 'Percentage' && ` (${charge.value}%)`}
                          </span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            ${(charge.calculatedAmount || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-3 mt-2 border-t border-gray-300 dark:border-gray-600 flex justify-between items-center">
                        <span className="text-base font-semibold text-gray-800 dark:text-gray-200">Total Amount</span>
                        <span className="text-base font-bold text-green-600 dark:text-green-400">
                          ${((previewItem as any).costSummary.totalAmount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No charges applied. Cost Summary: {JSON.stringify((previewItem as any).costSummary || 'Not found')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Notes Section */}
                {previewItem.notes && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">
                      Notes
                    </h3>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-gray-700 dark:text-gray-300 text-sm">
                        {previewItem.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Sticky */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky bottom-0">
              <div className="flex justify-end">
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerCart;
