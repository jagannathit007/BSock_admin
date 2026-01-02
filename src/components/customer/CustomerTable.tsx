import React, { useState, useEffect } from 'react';
import { CustomerService, Customer } from '../../services/customer/customerService';
import CustomerEditModal from './CustomerEditModal';
import ViewCustomerModal from './ViewCustomerModal';
import { useDebounce } from '../../hooks/useDebounce';
import { usePermissions } from '../../context/PermissionsContext';

const CustomerTable: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('/customers', 'write');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [allowBiddingFilter, setAllowBiddingFilter] = useState<string>(""); // '', 'allowed', 'notAllowed'
  const [statusFilter, setStatusFilter] = useState<string>(""); // '', 'active','inactive','approved','pending','emailVerified','notEmailVerified'
  const [loading, setLoading] = useState<boolean>(true);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, [currentPage, debouncedSearchTerm, allowBiddingFilter, statusFilter]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await CustomerService.getCustomerList({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        isAllowBidding: allowBiddingFilter === '' ? undefined : allowBiddingFilter === 'allowed',
        status: statusFilter === '' ? undefined : (statusFilter as any),
      });
      
      console.log("Fetched Customer data:", response.docs);
      setCustomers(response.docs);
      setTotalDocs(response.totalDocs || 0);
    } catch (err: any) {
      console.error("Error fetching customers:", err);
      setCustomers([]);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalDocs / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };


  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleView = (customer: Customer) => {
    setViewingCustomer(customer);
    setIsViewModalOpen(true);
  };

  const handleSave = () => {
    // Refresh the data after save
    fetchData();
    setIsModalOpen(false);
    setEditingCustomer(null);
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
                value={allowBiddingFilter}
                onChange={(e) => { setAllowBiddingFilter(e.target.value); setCurrentPage(1); }}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none cursor-pointer"
              >
                <option value="">All Bidding</option>
                <option value="allowed">Allowed</option>
                <option value="notAllowed">Not Allowed</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
            </div>
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
              onClick={() => CustomerService.exportCustomersExcel({
                search: searchTerm,
                isAllowBidding: allowBiddingFilter === '' ? undefined : allowBiddingFilter === 'allowed',
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
                {/* <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Email
                </th> */}
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
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Allow Bidding
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Customer Category
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Customers...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No customers found
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer, index) => (
                  <tr
                    key={customer._id || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      <p className='capitalize'>{customer.name}</p>
                      <p className='text-gray-500 text-sm'>{customer.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {customer.code || '-'}
                    </td>
                    {/* <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {customer.email}
                    </td> */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {customer.mobileNumber || customer.whatsappNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {customer.isActive ? (
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
                      {customer.isEmailVerified ? (
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
                      {customer.isApproved ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {customer.isAllowBidding ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Allowed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Not Allowed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {typeof customer.customerCategory === 'object' && customer.customerCategory !== null
                        ? customer.customerCategory.title
                        : customer.customerCategory || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleView(customer)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="View Customer Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => handleEdit(customer)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Edit Customer"
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

      <CustomerEditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSave}
        editCustomer={editingCustomer}
      />

      <ViewCustomerModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingCustomer(null);
        }}
        customer={viewingCustomer}
      />
    </div>
  );
};

export default CustomerTable;

