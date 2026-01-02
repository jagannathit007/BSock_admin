import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import toastHelper from "../../utils/toastHelper";
import UploadExcelModal from "./UploadExcelModal";
import PreviewModal from "./PreviewModal";
import ViewBidProductModal from "./ViewBidProductModal";
import BidHistoryModal from "./BidHistoryModal";
import SendMessageModal from "./SendMessageModal";
import {
  BidProductService,
  BidProduct,
} from "../../services/bidProducts/bidProduct.services";
import { useDebounce } from "../../hooks/useDebounce";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import { usePermissions } from "../../context/PermissionsContext";

const BidProductsTable: React.FC = () => {
  const { canWrite } = useModulePermissions('/bid-products');
  const { permissions } = usePermissions();
  const isSuperAdmin = permissions?.role === 'superadmin';
  const [productsData, setProductsData] = useState<BidProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewProducts, setPreviewProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const itemsPerPage = 10;
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<BidProduct | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [isSendMessageModalOpen, setIsSendMessageModalOpen] = useState<boolean>(false);
  const [messageProduct, setMessageProduct] = useState<BidProduct | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, debouncedSearchTerm, statusFilter]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await BidProductService.getBidProductList(
        currentPage,
        itemsPerPage,
        debouncedSearchTerm,
        statusFilter
      );
      setProductsData(response.data.docs);
      setTotalPages(response.data.totalPages || 1);
      setTotalDocs(response.data.totalDocs || 0);
    } catch (error) {
      console.error("Failed to fetch bid products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (product: BidProduct) => {
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
        await BidProductService.deleteBidProduct(product._id);
        toastHelper.showTost("Bid product deleted successfully!", "success");
        fetchProducts();
      } catch (error) {
        console.error("Failed to delete bid product:", error);
      }
    }
  };

  const handleExport = async () => {
    try {
      await BidProductService.exportBidProducts();
    } catch (error) {
      console.error("Failed to export bid products:", error);
    }
  };

  const handleDownloadSample = async () => {
    try {
      await BidProductService.downloadSampleExcel();
    } catch (error) {
      console.error("Failed to download sample file:", error);
    }
  };

  const handlePreviewConfirm = async (products: any[]) => {
     try {
       await BidProductService.createBulk(products);
       setIsPreviewModalOpen(false);
       fetchProducts();
      toastHelper.showTost("Bid products saved successfully!", "success");
     } catch (error) {
      console.error("Failed to create bulk bid products:", error);
      toastHelper.showTost("Failed to save bid products", "error");
    }
  };

  const handleUploadSuccess = (products: any[]) => {
    setPreviewProducts(products);
    setIsPreviewModalOpen(true);
    setIsUploadModalOpen(false);
  };

  const handleView = (product: BidProduct) => {
    setSelectedProduct(product);
    setIsViewModalOpen(true);
  };

  const handleHistory = (product: BidProduct) => {
    if (!product._id) return;
    setHistoryProductId(product._id);
    setIsHistoryOpen(true);
  };

  const handleExportHistory = async (product: BidProduct) => {
    if (!product._id) return;
    try {
      await BidProductService.exportBidHistoryByProduct(product._id);
    } catch (error) {
      console.error('Failed to export bid history:', error);
    }
  };

  const handleSendMessage = (product: BidProduct) => {
    setMessageProduct(product);
    setIsSendMessageModalOpen(true);
  };

  return (
    <div className="py-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by lot number or Model or category..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
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
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
              <i className="fas fa-chevron-down absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
              onClick={handleDownloadSample}
            >
              <i className="fas fa-file-excel text-xs"></i>
              Download Sample
            </button>
            {canWrite && (
              <button
                className="inline-flex items-center gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <i className="fas fa-upload text-xs"></i>
                Import
              </button>
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

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Lot Number
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Quantity
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  OEM
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Model
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Price
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Grade
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
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
                  <td colSpan={9} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Bid Products...
                    </div>
                  </td>
                </tr>
              ) : productsData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No bid products found
                    </div>
                  </td>
                </tr>
              ) : (
                productsData.map((item: BidProduct, index: number) => {
                  const getStatusBadge = (status?: string) => {
                    const statusValue = status || 'pending';
                    const statusConfig = {
                      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
                      active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
                      closed: { label: 'Closed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' }
                    };
                    const config = statusConfig[statusValue as keyof typeof statusConfig] || statusConfig.pending;
                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    );
                  };

                  return (
                    <tr
                      key={item._id || index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                        {item.lotNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.qty}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.oem}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.model}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.category}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        ${typeof item.price === 'number' ? item.price.toFixed(2) : "0.00"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.grade}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleView(item)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="View Product Details"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button
                            onClick={() => handleHistory(item)}
                            className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                            title="Bid History"
                          >
                            <i className="fas fa-gavel"></i>
                          </button>
                          <button
                            onClick={() => handleExportHistory(item)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Export Bid History"
                          >
                            <i className="fas fa-file-excel"></i>
                          </button>
                          {canWrite && (
                            <>
                              {item.status === 'closed' && (
                                <button
                                  onClick={() => handleSendMessage(item)}
                                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                                  title="Send Message to Highest Bidder"
                                >
                                  <i className="fas fa-envelope"></i>
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                  title="Delete Product"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      <UploadExcelModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
      <PreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        products={previewProducts}
        onConfirm={handlePreviewConfirm}
      />
      <ViewBidProductModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        product={selectedProduct}
      />
      <BidHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        productId={historyProductId}
      />
      <SendMessageModal
        isOpen={isSendMessageModalOpen}
        onClose={() => {
          setIsSendMessageModalOpen(false);
          setMessageProduct(null);
        }}
        product={messageProduct}
        onSuccess={() => {
          // Optionally refresh the products list
          fetchProducts();
        }}
      />
    </div>
  );
};

export default BidProductsTable;
