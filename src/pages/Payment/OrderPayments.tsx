import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toastHelper from '../../utils/toastHelper';
import { OrderPaymentService, OrderPayment } from '../../services/orderPayment/orderPayment.services';
import { useDebounce } from '../../hooks/useDebounce';
// Using Font Awesome CSS classes instead of React components

const OrderPayments: React.FC = () => {
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<OrderPayment | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'approve' | 'markPaid' | 'view' | null>(null);
  const [verificationFiles, setVerificationFiles] = useState<File[]>([]);
  const [remarks, setRemarks] = useState<string>('');
  const itemsPerPage = 10;

  const paymentStatuses = ['requested', 'verified', 'approved', 'paid'];
  const paymentMethods = ['Cash', 'TT', 'ThirdParty'];

  useEffect(() => {
    fetchPayments();
  }, [currentPage, debouncedSearchTerm, selectedStatus, selectedPaymentMethod]);

  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await OrderPaymentService.listPayments(
        currentPage,
        itemsPerPage,
        undefined,
        selectedStatus || undefined,
        selectedPaymentMethod || undefined
      );
      const docs = response?.data?.docs || [];
      setPayments(docs);
      setTotalDocs(response?.data?.totalDocs || docs.length);
      setTotalPages(response?.data?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      toastHelper.showTost(
        (error as any)?.message || 'Failed to fetch payments',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!selectedPayment) return;

    try {
      await OrderPaymentService.verifyPayment(
        selectedPayment._id!,
        verificationFiles.length > 0 ? verificationFiles : undefined,
        remarks
      );
      setIsModalOpen(false);
      setSelectedPayment(null);
      setVerificationFiles([]);
      setRemarks('');
      fetchPayments();
    } catch (error) {
      console.error('Failed to verify payment:', error);
    }
  };

  const handleApprovePayment = async () => {
    if (!selectedPayment) return;

    try {
      await OrderPaymentService.approvePayment(selectedPayment._id!, remarks);
      setIsModalOpen(false);
      setSelectedPayment(null);
      setRemarks('');
      fetchPayments();
    } catch (error) {
      console.error('Failed to approve payment:', error);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedPayment) return;

    try {
      await OrderPaymentService.markAsPaid(selectedPayment._id!, remarks);
      setIsModalOpen(false);
      setSelectedPayment(null);
      setRemarks('');
      fetchPayments();
    } catch (error) {
      console.error('Failed to mark payment as paid:', error);
    }
  };

  const openModal = (payment: OrderPayment, action: 'verify' | 'approve' | 'markPaid' | 'view') => {
    setSelectedPayment(payment);
    setActionType(action);
    setRemarks('');
    setVerificationFiles([]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPayment(null);
    setActionType(null);
    setRemarks('');
    setVerificationFiles([]);
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return format(date, 'yyyy-MM-dd HH:mm');
    } catch {
      return '-';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'verified':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'requested':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPaymentMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'Cash':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'TT':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'ThirdParty':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Order Payments</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage customer order payments</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order number..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Statuses</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Method
            </label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Methods</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('');
                setSelectedPaymentMethod('');
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400">
            No payments found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {payments.map((payment) => {
                    const order = typeof payment.orderId === 'object' ? payment.orderId : 
                                 typeof payment.order === 'object' ? payment.order : null;
                    const customer = typeof payment.customerId === 'object' ? payment.customerId :
                                    typeof payment.customer === 'object' ? payment.customer : null;
                    const orderNo = order && typeof order === 'object' ? order.orderNo : 
                                   (typeof payment.orderId === 'string' ? payment.orderId : 
                                    typeof payment.order === 'string' ? payment.order : '');
                    const customerName = customer && typeof customer === 'object' ? customer.name :
                                        (typeof payment.customerId === 'string' ? payment.customerId :
                                         typeof payment.customer === 'string' ? payment.customer : '');
                    
                    return (
                      <tr key={payment._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {orderNo || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {customerName || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodBadgeColor(payment.paymentMethod || payment.module || '')}`}>
                            {payment.paymentMethod || payment.module || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {payment.currency} {payment.amount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(payment.status)}`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(payment.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openModal(payment, 'view')}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="View Details"
                            >
                              <i className="fas fa-eye"></i>
                            </button>
                            {payment.status === 'requested' && (
                              <button
                                onClick={() => openModal(payment, 'verify')}
                                className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                                title="Verify Payment"
                              >
                                <i className="fas fa-lock"></i>
                              </button>
                            )}
                            {payment.status === 'verify' && payment.otpVerified && (
                              <button
                                onClick={() => openModal(payment, 'approve')}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                title="Approve Payment"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                            )}
                            {payment.status === 'approved' && (
                              <button
                                onClick={() => openModal(payment, 'markPaid')}
                                className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                                title="Mark as Paid"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalDocs)} of {totalDocs} payments
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {actionType === 'view' && 'Payment Details'}
                  {actionType === 'verify' && 'Verify Payment'}
                  {actionType === 'approve' && 'Approve Payment'}
                  {actionType === 'markPaid' && 'Mark as Paid'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Payment Details */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Order Number</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {typeof selectedPayment.orderId === 'object' ? selectedPayment.orderId?.orderNo : selectedPayment.orderId}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {typeof selectedPayment.customerId === 'object' ? selectedPayment.customerId?.name : selectedPayment.customerId}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPayment.paymentMethod}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedPayment.currency} {selectedPayment.amount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(selectedPayment.status)}`}>
                      {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                    </span>
                  </div>
                  {selectedPayment.transactionRef && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Reference</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedPayment.transactionRef}</p>
                    </div>
                  )}
                </div>

                {/* Payment Details Fields */}
                {selectedPayment.paymentDetails && Object.keys(selectedPayment.paymentDetails).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Details</label>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      {Object.entries(selectedPayment.paymentDetails).map(([key, value]) => (
                        <div key={key} className="mb-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{key}:</span>{' '}
                          <span className="text-gray-900 dark:text-white">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OTP Info */}
                {selectedPayment.otp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">OTP Status</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedPayment.otpVerified ? 'Verified' : 'Pending Verification'}
                      {selectedPayment.otpVerifiedAt && ` (${formatDate(selectedPayment.otpVerifiedAt)})`}
                    </p>
                  </div>
                )}

                {/* Verification Documents */}
                {selectedPayment.verificationDocuments && selectedPayment.verificationDocuments.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Verification Documents</label>
                    <div className="space-y-2">
                      {selectedPayment.verificationDocuments.map((doc, index) => (
                        <a
                          key={index}
                          href={doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Document {index + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Forms */}
              {actionType === 'verify' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upload Verification Documents
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setVerificationFiles(Array.from(e.target.files || []))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remarks</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Add remarks..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVerifyPayment}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                    >
                      Verify & Send OTP
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'approve' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remarks</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Add remarks..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApprovePayment}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Approve Payment
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'markPaid' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remarks</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Add remarks..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMarkAsPaid}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Mark as Paid
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'view' && (
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderPayments;


