import React, { useState, useEffect } from 'react';
import { SellerService, Seller } from '../../services/seller/sellerService';
import SellerEditModal from './SellerEditModal';
import ViewSellerModal from './ViewSellerModal';
import { useDebounce } from '../../hooks/useDebounce';
import { usePermissions } from '../../context/PermissionsContext';

const SellerTable: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('/sellers', 'write');
  
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>(""); // '', 'active','inactive','approved','pending','emailVerified','notEmailVerified'
  const [loading, setLoading] = useState<boolean>(true);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [viewingSeller, setViewingSeller] = useState<Seller | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, [currentPage, debouncedSearchTerm, statusFilter]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await SellerService.getSellerList({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        status: statusFilter === '' ? undefined : (statusFilter as any),
      });
      
      console.log("Fetched Seller data:", response.docs);
      setSellers(response.docs);
      setTotalDocs(response.totalDocs || 0);
    } catch (err: any) {
      console.error("Error fetching sellers:", err);
      setSellers([]);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalDocs / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };


  const handleEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setIsModalOpen(true);
  };

  const handleView = (seller: Seller) => {
    setViewingSeller(seller);
    setIsViewModalOpen(true);
  };

  const handleSave = () => {
    // Refresh the data after save
    fetchData();
    setIsModalOpen(false);
    setEditingSeller(null);
  };


  return (
    <div className="py-4">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        {/* Table Header with Controls */}
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 w-full">
            {/* Search */}
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by name, email or phone..."
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
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="emailVerified">Email Verified</option>
                <option value="notEmailVerified">Email Not Verified</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              onClick={() => SellerService.exportSellersExcel({
                search: searchTerm,
                status: statusFilter === '' ? undefined : (statusFilter as any),
              })}
            >
              <i className="fas fa-download text-xs"></i>
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Code
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Mobile Number
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Active Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Email Verified
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Approve Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Seller Category
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
                      Loading Sellers...
                    </div>
                  </td>
                </tr>
              ) : sellers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No sellers found
                    </div>
                  </td>
                </tr>
              ) : (
                sellers.map((seller, index) => (
                  <tr
                    key={seller._id || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      <p className='capitalize'>{seller.name}</p>
                      <p className='text-gray-500 text-sm'>{seller.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {seller.code || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {seller.mobileNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {seller.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {seller.isEmailVerified ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                          Not Verified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {seller.isApproved ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {typeof seller.sellerCategory === 'object' && seller.sellerCategory !== null
                        ? seller.sellerCategory.title
                        : seller.sellerCategory || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleView(seller)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="View Seller Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => handleEdit(seller)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Edit Seller"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalDocs > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 w-full">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalDocs)} of {totalDocs} entries
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
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
                      onClick={() => handlePageChange(pageNum)}
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
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <SellerEditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSeller(null);
        }}
        onSave={handleSave}
        editSeller={editingSeller}
      />

      <ViewSellerModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingSeller(null);
        }}
        seller={viewingSeller}
      />
    </div>
  );
};

export default SellerTable;

