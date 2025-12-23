import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import VersionProductService from "../../services/versioning/versionProduct.services";

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | undefined;
  productName?: string;
}

interface VersionRecord {
  _id: string;
  version: number;
  changeType: string;
  changeReason?: string;
  changedBy?: {
    name?: string;
    email?: string;
  };
  changedByType?: string;
  createdAt: string;
  productData?: any;
}

const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
}) => {
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const itemsPerPage = 10;

  useEffect(() => {
    if (isOpen && productId) {
      fetchProductHistory();
    } else {
      setVersions([]);
      setCurrentPage(1);
    }
  }, [isOpen, productId, currentPage]);

  const fetchProductHistory = async () => {
    if (!productId) return;

    try {
      setLoading(true);
      const response = await VersionProductService.fetchHistory({
        productId,
        page: currentPage,
        limit: itemsPerPage,
      });

      // Check if response is successful and has data
      if (response?.status === 200 && response?.data) {
        setVersions(response.data.docs || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalDocs(response.data.totalDocs || 0);
      } else if (response?.status !== 200) {
        // Handle error response
        console.error("Failed to fetch product history:", response?.message || 'Unknown error');
        setVersions([]);
        setTotalPages(1);
        setTotalDocs(0);
      } else {
        // No data but successful
        setVersions([]);
        setTotalPages(1);
        setTotalDocs(0);
      }
    } catch (error) {
      console.error("Failed to fetch product history:", error);
      setVersions([]);
      setTotalPages(1);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return format(date, "MMM dd, yyyy HH:mm");
    } catch {
      return "-";
    }
  };

  const getChangeTypeBadge = (changeType: string) => {
    const badges: Record<string, string> = {
      create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      restore: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          badges[changeType] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
        }`}
      >
        {changeType ? changeType.charAt(0).toUpperCase() + changeType.slice(1) : "N/A"}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Product History
              {productName && (
                <span className="text-xl font-normal text-gray-600 dark:text-gray-400 ml-2">
                  - {productName}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Version history and changes
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2"
            title="Close"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading product history...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-history text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                No version history found
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                        Version
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                        Change Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                        Changed By
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                        Change Reason
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {versions.map((version) => (
                      <tr
                        key={version._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                          v{version.version}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {getChangeTypeBadge(version.changeType)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <div>
                            <div className="font-medium">
                              {version.changedBy?.name || "System"}
                            </div>
                            {version.changedBy?.email && (
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                {version.changedBy.email}
                              </div>
                            )}
                            {version.changedByType && (
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                ({version.changedByType})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {version.changeReason || "-"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(version.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {versions.length} of {totalDocs} versions
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductHistoryModal;

