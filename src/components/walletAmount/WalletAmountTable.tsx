import React, { useState, useEffect } from "react";
import toastHelper from "../../utils/toastHelper";
import WalletAmountModal from "./WalletAmountModal";
import {
  walletAmountService,
  CustomerWalletData,
  WalletTransaction,
  ListTransactionsRequest,
} from "../../services/walletAmount/walletAmountService";
import {
  CustomerService,
  Customer,
} from "../../services/customer/customerService";
import { useDebounce } from "../../hooks/useDebounce";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import { formatWalletAmount } from "../../utils/numberPrecision";

// Define the interface for Transaction data
interface Transaction {
  _id: string;
  customerId: string;
  customerName: string;
  type: "credit" | "debit";
  amount: number;
  remark: string;
  createdAt: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

const WalletAmountTable: React.FC = () => {
  const { canWrite } = useModulePermissions('/wallet-amount');
  const [walletData, setWalletData] = useState<CustomerWalletData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState<boolean>(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editingCustomer, setEditingCustomer] =
    useState<CustomerWalletData | null>(null);
  const [viewingCustomer, setViewingCustomer] =
    useState<CustomerWalletData | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalDocs, setTotalDocs] = useState<number>(0);

  // Fetch wallet data on mount
  useEffect(() => {
    fetchWalletData();
  }, []);

  // Fetch transactions when filters change
  useEffect(() => {
    if (selectedCustomer !== "all") {
      fetchTransactions();
    }
  }, [currentPage, selectedCustomer]);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Update pagination totals when walletData, debouncedSearchTerm, or statusFilter changes
  useEffect(() => {
    let filtered = walletData;

    if (debouncedSearchTerm.trim()) {
      filtered = filtered.filter((item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (item.businessProfile.businessName &&
            item.businessProfile.businessName
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase())) ||
          (item.mobileNumber &&
            item.mobileNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
        return matchesSearch;
      });
    }

    if (statusFilter !== "All") {
      filtered = filtered.filter(
        (item) =>
          item.businessProfile.status.toLowerCase() ===
          statusFilter.toLowerCase()
      );
    }

    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    setTotalDocs(filtered.length);
    setCurrentPage(1);
  }, [walletData, debouncedSearchTerm, statusFilter]);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const response = await walletAmountService.getWalletBalance();
      setWalletData(response);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
      toastHelper.error("Failed to fetch wallet data");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      if (selectedCustomer === "all") {
        setTransactions([]);
        return;
      }

      const requestData: ListTransactionsRequest = {
        customerId: selectedCustomer,
        page: currentPage,
        limit: itemsPerPage,
      };

      const response = await walletAmountService.listTransactions(requestData);
      const transformedTransactions: Transaction[] = response.docs.map(
        (transaction: WalletTransaction) => ({
          _id: transaction._id,
          customerId: transaction.customerId,
          customerName:
            customers.find((c) => c._id === transaction.customerId)?.name ||
            "Unknown Customer",
          type: transaction.type,
          amount: transaction.amount,
          remark: transaction.remark,
          createdAt: transaction.createdAt,
          createdBy: transaction.createdBy,
        })
      );

      setTransactions(transformedTransactions);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      toastHelper.showTost("Failed to fetch transactions", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customerList = await CustomerService.getAllCustomers();
      setCustomers(customerList);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      toastHelper.showTost("Failed to fetch customers", "error");
    }
  };

  // Calculate wallet stats
  const totalCustomers = walletData.length;
  const totalWalletBalance = walletData.reduce(
    (sum, item) => sum + parseFloat(item.walletBalance),
    0
  );
  const approvedCustomers = walletData.filter(
    (item) => item.businessProfile.status === "approved"
  ).length;
  const pendingCustomers = walletData.filter(
    (item) => item.businessProfile.status === "pending"
  ).length;
  const rejectedCustomers = walletData.filter(
    (item) => item.businessProfile.status === "rejected"
  ).length;

  const walletStats = {
    totalCustomers,
    totalWalletBalance,
    approvedCustomers,
    pendingCustomers,
    rejectedCustomers,
  };

  // Handle saving a new or edited transaction
  const handleSave = () => {
    fetchWalletData();
    if (selectedCustomer !== "all") {
      fetchTransactions();
    }
    setEditIndex(null);
    setEditingCustomer(null);
    setIsModalOpen(false);
  };

  // Handle viewing customer details
  const handleViewDetails = (customer: CustomerWalletData) => {
    setViewingCustomer(customer);
    setSelectedCustomer(customer._id);
    setCurrentPage(1);
    setIsViewDetailsOpen(true);
  };

  // Handle editing customer wallet
  const handleEditCustomer = (customer: CustomerWalletData) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  // Utility function to convert a string to title case
  const toTitleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get status styles
  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700";
      default:
        return "";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "fa-check-circle";
      case "pending":
        return "fa-clock";
      case "rejected":
        return "fa-times";
      default:
        return "";
    }
  };

  // Filter and paginate wallet data (client-side)
  const filteredWalletData = walletData.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (item.businessProfile.businessName &&
        item.businessProfile.businessName
          .toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase())) ||
      (item.mobileNumber &&
        item.mobileNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
    const matchesStatus =
      statusFilter === "All" ||
      item.businessProfile.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredWalletData.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header with Stats Cards */}
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Total Customers Card */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Total Customers
                  </p>
                </div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {walletStats.totalCustomers}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Registered users
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                <i className="fas fa-users text-blue-600 dark:text-blue-400 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Total Wallet Balance Card */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Total Balance
                  </p>
                </div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                  ${formatWalletAmount(walletStats.totalWalletBalance)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Across all wallets
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
                <i className="fas fa-wallet text-emerald-600 dark:text-emerald-400 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Approved Customers Card */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Approved
                  </p>
                </div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {walletStats.approvedCustomers}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Business verified
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl">
                <i className="fas fa-check-circle text-green-600 dark:text-green-400 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Pending Customers Card */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Pending
                  </p>
                </div>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  {walletStats.pendingCustomers}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Awaiting approval
                </p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl">
                <i className="fas fa-clock text-yellow-600 dark:text-yellow-400 text-xl"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        {/* Table Header with Controls */}
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by customer name, business name, or mobile..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                }}
              />
            </div>
            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-[120px] appearance-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
            </div>
          </div>

          {canWrite && (
            <button
              className="inline-flex items-center whitespace-nowrap gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              onClick={() => {
                setEditIndex(null);
                setIsModalOpen(true);
              }}
            >
              <i className="fas fa-plus text-xs"></i>
              Add Transaction
            </button>
          )}
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Customer Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Business Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Mobile Number
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Wallet Balance
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Business Status
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
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
                      Loading Wallet Data...
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No wallet data found
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item: CustomerWalletData, index: number) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      {toTitleCase(item.name)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.businessProfile.businessName || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.mobileNumber || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <span
                        className={`font-bold ${
                          parseFloat(item.walletBalance) >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-500 dark:text-red-400"
                        }`}
                      >
                        ${formatWalletAmount(item.walletBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${getStatusStyles(
                          item.businessProfile.status
                        )}`}
                      >
                        <i
                          className={`fas ${getStatusIcon(
                            item.businessProfile.status
                          )} text-xs`}
                        ></i>
                        {toTitleCase(item.businessProfile.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="View Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => handleEditCustomer(item)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Edit Wallet"
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
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
            Showing {paginatedData.length} of {totalDocs} items
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

      <WalletAmountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditIndex(null);
          setEditingCustomer(null);
        }}
        onSave={handleSave}
        editItem={editIndex !== null ? transactions[editIndex] : undefined}
        editCustomer={editingCustomer}
      />

      {/* View Details Modal */}
      {isViewDetailsOpen && viewingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-blue-600 dark:text-blue-400 text-xl"></i>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {toTitleCase(viewingCustomer.name)} Recent Transaction List
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Recent Transaction Details
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsViewDetailsOpen(false);
                  setViewingCustomer(null);
                  setSelectedCustomer("all");
                  setTransactions([]);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Customer Information */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Country
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {viewingCustomer.businessProfile.country || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Wallet Balance
                    </label>
                    <p
                      className={`text-lg font-bold ${
                        parseFloat(viewingCustomer.walletBalance) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400"
                      }`}
                    >
                      ${formatWalletAmount(viewingCustomer.walletBalance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transactions Section */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Transactions
                </h3>
                {transactions.length > 0 ? (
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((transaction, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              transaction.type === "credit"
                                ? "bg-emerald-100 dark:bg-emerald-900/30"
                                : "bg-red-100 dark:bg-red-900/30"
                            }`}
                          >
                            <i
                              className={`fas ${
                                transaction.type === "credit"
                                  ? "fa-arrow-up text-emerald-600 dark:text-emerald-400"
                                  : "fa-arrow-down text-red-600 dark:text-red-400"
                              } text-sm`}
                            ></i>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {transaction.remark}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(transaction.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-bold ${
                              transaction.type === "credit"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-500 dark:text-red-400"
                            }`}
                          >
                            {transaction.type === "debit" ? "-" : "+"}$
                            {formatWalletAmount(transaction.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No transactions found for this customer
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => {
                  setIsViewDetailsOpen(false);
                  setViewingCustomer(null);
                  setSelectedCustomer("all");
                  setTransactions([]);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              {canWrite && (
                <button
                  onClick={() => {
                    handleEditCustomer(viewingCustomer);
                    setIsViewDetailsOpen(false);
                    setViewingCustomer(null);
                    setSelectedCustomer("all");
                    setTransactions([]);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletAmountTable;
