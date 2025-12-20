import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import toastHelper from '../../utils/toastHelper';
import { OrderPaymentService, OrderPayment } from '../../services/orderPayment/orderPayment.services';
import { AdminOrderService, Order } from '../../services/order/adminOrder.services';
import { handleNumericInput } from '../../utils/numericInput';
import { roundToTwoDecimals } from '../../utils/numberPrecision';
import { useDebounce } from '../../hooks/useDebounce';

const Payments: React.FC = () => {
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'approve' | 'markPaid' | 'view' | 'edit' | null>(null);
  const [verificationFiles, setVerificationFiles] = useState<File[]>([]);
  const [remarks, setRemarks] = useState<string>('');
  const [editFormData, setEditFormData] = useState<{
    status: string;
    transactionRef: string;
    remarks: string;
    amount: number;
    currency: string;
    conversionRate: number;
    calculatedAmount: number;
  }>({
    status: '',
    transactionRef: '',
    remarks: '',
    amount: 0,
    currency: '',
    conversionRate: 1,
    calculatedAmount: 0,
  });
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpValue, setOtpValue] = useState<string>('');
  const [otpVerified, setOtpVerified] = useState<boolean>(false);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [verifyingOtp, setVerifyingOtp] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const itemsPerPage = 10;

  const paymentStatuses = ['requested', 'rejected', 'verify', 'approved', 'paid'];
  const paymentMethods = ['Cash', 'TT', 'ThirdParty'];

  useEffect(() => {
    fetchPayments();
  }, [currentPage, debouncedSearchTerm, selectedStatus, selectedPaymentMethod]);

  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  // OTP countdown timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (otpCountdown > 0) {
      interval = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [otpCountdown]);

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

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await AdminOrderService.getOrderList(1, 100, orderId);
      const orders = response?.data?.docs || [];
      const order = orders.find((o: Order) => o._id === orderId);
      return order || null;
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      return null;
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
      setSelectedOrder(null);
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
      setSelectedOrder(null);
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
      setSelectedOrder(null);
      setRemarks('');
      fetchPayments();
    } catch (error) {
      console.error('Failed to mark payment as paid:', error);
    }
  };

  const handleSendOTP = async () => {
    if (!selectedPayment) return;

    try {
      setSendingOtp(true);
      await OrderPaymentService.sendOTP(selectedPayment._id!);
      setOtpSent(true);
      setOtpCountdown(30); // Start 30 second countdown
      setOtpVerified(false); // Reset verification status
      setOtpValue(''); // Clear OTP input
      toastHelper.showTost('OTP sent successfully', 'success');
    } catch (error) {
      console.error('Failed to send OTP:', error);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!selectedPayment || !otpValue) return;

    try {
      setVerifyingOtp(true);
      await OrderPaymentService.verifyOTP(selectedPayment._id!, otpValue);
      setOtpVerified(true);
      toastHelper.showTost('OTP verified successfully', 'success');
    } catch (error) {
      console.error('Failed to verify OTP:', error);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Auto-calculation is now handled in onChange handlers, this function is no longer needed

  // Helper function to check if payment is approved
  const isPaymentApproved = () => {
    return selectedPayment?.status === 'approved' || editFormData.status === 'approved';
  };

  // Validate status transition
  const validateStatusTransition = (currentStatus: string, newStatus: string): { valid: boolean; message?: string } => {
    if (!newStatus || newStatus === currentStatus) {
      return { valid: true };
    }

    // Define valid transitions
    // Note: When status is set to "approved", backend automatically converts it to "paid"
    const validTransitions: { [key: string]: string[] } = {
      'requested': ['rejected', 'verify'],
      'rejected': [], // Cannot transition from rejected to any other status
      'verify': ['approved', 'rejected'], // Can go to approved (which becomes paid) or rejected, but NOT back to requested
      'approved': ['rejected'], // Can only go to rejected (approved automatically becomes paid, so no need to show paid option)
      'paid': [], // Cannot transition from paid to any other status
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    
    if (!allowedStatuses.includes(newStatus)) {
      const statusDisplay = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return {
        valid: false,
        message: `Cannot change status from "${statusDisplay(currentStatus)}" to "${statusDisplay(newStatus)}". ${allowedStatuses.length > 0 ? `Valid transitions: ${allowedStatuses.map(s => statusDisplay(s)).join(', ')}` : 'No transitions allowed from this status.'}`
      };
    }

    return { valid: true };
  };

  const handleUpdatePayment = async () => {
    if (!selectedPayment) return;

    try {
      // If payment is approved (either original status or selected status), only allow status change
      if (isPaymentApproved()) {
        await OrderPaymentService.updatePayment(selectedPayment._id!, {
          status: editFormData.status as any,
        });
      } else {
        // Use calculated amount if available and greater than 0, otherwise use regular amount
        const finalAmount = roundToTwoDecimals(editFormData.calculatedAmount > 0 ? editFormData.calculatedAmount : editFormData.amount);
        
        await OrderPaymentService.updatePayment(selectedPayment._id!, {
          status: editFormData.status as any,
          transactionRef: editFormData.transactionRef,
          remarks: editFormData.remarks,
          amount: finalAmount,
          currency: editFormData.currency,
          conversionRate: roundToTwoDecimals(editFormData.conversionRate),
          calculatedAmount: roundToTwoDecimals(editFormData.calculatedAmount),
        });
      }
      
      setIsModalOpen(false);
      setSelectedPayment(null);
      setSelectedOrder(null);
      setEditFormData({
        status: '',
        transactionRef: '',
        remarks: '',
        amount: 0,
        currency: '',
        conversionRate: 1,
        calculatedAmount: 0,
      });
      setOtpSent(false);
      setOtpValue('');
      setOtpVerified(false);
      fetchPayments();
    } catch (error) {
      console.error('Failed to update payment:', error);
    }
  };

  const openModal = async (payment: OrderPayment, action: 'verify' | 'approve' | 'markPaid' | 'view' | 'edit') => {
    setSelectedPayment(payment);
    setActionType(action);
    setRemarks('');
    setVerificationFiles([]);
    
    // Initialize edit form data if editing
    if (action === 'edit') {
      setEditFormData({
        status: payment.status || '',
        transactionRef: payment.transactionRef || '',
        remarks: payment.remarks || '',
        amount: payment.amount || 0,
        currency: payment.currency || '',
        conversionRate: 1,
        calculatedAmount: 0,
      });
      // Check if OTP is already sent/verified
      setOtpSent(!!payment.otp);
      setOtpVerified(payment.otpVerified || false);
      setOtpValue('');
      // If OTP was already sent but not verified, start countdown
      if (payment.otp && !payment.otpVerified) {
        setOtpCountdown(30);
      } else {
        setOtpCountdown(0);
      }
    }
    
    // Fetch order details
    const orderId = typeof payment.orderId === 'object' ? payment.orderId._id : 
                    typeof payment.order === 'object' ? payment.order._id :
                    payment.orderId || payment.order || '';
    if (orderId) {
      const order = await fetchOrderDetails(orderId);
      setSelectedOrder(order);
    }
    
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPayment(null);
    setSelectedOrder(null);
    setActionType(null);
    setRemarks('');
    setVerificationFiles([]);
    setEditFormData({
      status: '',
      transactionRef: '',
      remarks: '',
      amount: 0,
      currency: '',
      conversionRate: 1,
      calculatedAmount: 0,
    });
    setOtpSent(false);
    setOtpValue('');
    setOtpVerified(false);
    setOtpCountdown(0);
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
      case 'requested':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'verify':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'approved':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 border-2 border-emerald-400';
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Payments</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage payments with order details</p>
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
                        {status === 'verify' ? 'Verify' : status.charAt(0).toUpperCase() + status.slice(1)}
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
                    const paymentMethod = payment.paymentMethod || payment.module || 'N/A';
                    const orderId = typeof payment.orderId === 'object' ? payment.orderId._id : 
                                  typeof payment.order === 'object' ? payment.order._id :
                                  payment.orderId || payment.order || '';
                    
                    const isPaid = payment.status === 'paid';
                    return (
                      <tr 
                        key={payment._id} 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          isPaid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {order?.orderNo || orderId}
                          {isPaid && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                              <i className="fas fa-check-circle mr-1"></i>
                              Payment Done
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {customer?.name || (typeof payment.customerId === 'string' ? payment.customerId : '') || 
                           (typeof payment.customer === 'string' ? payment.customer : '')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodBadgeColor(paymentMethod)}`}>
                            {paymentMethod}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
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
                            <button
                              onClick={() => openModal(payment, 'edit')}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="Edit Payment"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, totalDocs)}
                      </span>{' '}
                      of <span className="font-medium">{totalDocs}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === page
                              ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 dark:border-blue-500 text-blue-600 dark:text-blue-300'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {actionType === 'view' && 'Payment & Order Details'}
                {actionType === 'edit' && 'Edit Payment'}
                {actionType === 'verify' && 'Verify Payment'}
                {actionType === 'approve' && 'Approve Payment'}
                {actionType === 'markPaid' && 'Mark as Paid'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Payment Details Section - Show in view mode or as read-only in edit mode */}
              {actionType !== 'edit' && (
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment ID
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{selectedPayment._id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(selectedPayment.status)}`}>
                        {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Method
                      </label>
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodBadgeColor(selectedPayment.paymentMethod || selectedPayment.module || 'N/A')}`}>
                        {selectedPayment.paymentMethod || selectedPayment.module || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Amount
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {selectedPayment.currency} {selectedPayment.amount?.toLocaleString()}
                      </p>
                    </div>
                    {selectedPayment.transactionRef && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Transaction Reference
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">{selectedPayment.transactionRef}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Created At
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedPayment.createdAt)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Details Section - Show in all modes */}
              {selectedOrder && actionType !== 'edit' && (
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Order Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Order Number
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{selectedOrder.orderNo || selectedOrder._id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Order Status
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{selectedOrder.status}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Total Amount
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {selectedOrder.currency} {selectedOrder.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Customer
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {typeof selectedOrder.customerId === 'object' ? selectedOrder.customerId.name : '-'}
                      </p>
                    </div>
                    {selectedOrder.cartItems && selectedOrder.cartItems.length > 0 && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Order Items
                        </label>
                        <div className="space-y-2">
                          {selectedOrder.cartItems.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {typeof item.productId === 'object' ? item.productId.name : 'Product'} x {item.quantity}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {selectedOrder.currency} {(item.price * item.quantity).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Remarks
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter remarks..."
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
                      Verify Payment
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'approve' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Remarks
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter remarks..."
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Remarks
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter remarks..."
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

              {actionType === 'edit' && (
                <div className="space-y-6">
                  {/* Payment Info Section */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Payment ID
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">{selectedPayment._id}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Payment Method
                        </label>
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodBadgeColor(selectedPayment.paymentMethod || selectedPayment.module || 'N/A')}`}>
                          {selectedPayment.paymentMethod || selectedPayment.module || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Order Details Section */}
                  {selectedOrder && (
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Order Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Order Number
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">{selectedOrder.orderNo || selectedOrder._id}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Order Status
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">{selectedOrder.status}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Order Total Amount
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {selectedOrder.currency} {selectedOrder.totalAmount?.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Customer
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {typeof selectedOrder.customerId === 'object' ? selectedOrder.customerId.name : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Edit Form */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Payment Details</h3>
                    {isPaymentApproved() && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          <i className="fas fa-info-circle mr-2"></i>
                          This payment is approved. You can only change the status. All other fields are locked.
                        </p>
                      </div>
                    )}

                    {/* Amount, Currency, Conversion Rate Fields - Show BEFORE OTP for requested status */}
                    {selectedPayment.status === 'requested' && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4 space-y-4">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white">Payment Amount & Currency</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Amount <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editFormData.amount}
                              onChange={(e) => {
                                if (!isPaymentApproved()) {
                                  const filteredValue = handleNumericInput(e.target.value, true, false);
                                  const amount = roundToTwoDecimals(parseFloat(filteredValue) || 0);
                                  const rate = roundToTwoDecimals(editFormData.conversionRate || 1);
                                  const calculated = roundToTwoDecimals(amount * rate);
                                  setEditFormData(prev => ({ 
                                    ...prev, 
                                    amount: filteredValue === '' ? 0 : amount,
                                    calculatedAmount: calculated
                                  }));
                                }
                              }}
                              disabled={isPaymentApproved()}
                              readOnly={isPaymentApproved()}
                              className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                                isPaymentApproved() ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                              }`}
                              placeholder="Enter amount"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Currency <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={editFormData.currency}
                              onChange={(e) => {
                                if (!isPaymentApproved()) {
                                  setEditFormData({ ...editFormData, currency: e.target.value });
                                }
                              }}
                              disabled={isPaymentApproved()}
                              className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                                isPaymentApproved() ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                              }`}
                            >
                              <option value="">Select Currency</option>
                              <option value="USD">USD</option>
                              <option value="AED">AED</option>
                              <option value="HKD">HKD</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Conversion Rate
                            </label>
                            <input
                              type="text"
                              value={editFormData.conversionRate}
                              onChange={(e) => {
                                if (!isPaymentApproved()) {
                                  const filteredValue = handleNumericInput(e.target.value, true, false);
                                  const rate = roundToTwoDecimals(parseFloat(filteredValue) || 1);
                                  const amount = roundToTwoDecimals(typeof editFormData.amount === 'number' ? editFormData.amount : parseFloat(editFormData.amount) || 0);
                                  const calculated = roundToTwoDecimals(amount * rate);
                                  setEditFormData(prev => ({ 
                                    ...prev, 
                                    conversionRate: filteredValue === '' ? 1 : rate,
                                    calculatedAmount: calculated
                                  }));
                                }
                              }}
                              disabled={isPaymentApproved()}
                              readOnly={isPaymentApproved()}
                              className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                                isPaymentApproved() ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                              }`}
                              placeholder="1.0"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Calculated Amount (in Order Currency)
                          </label>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedOrder?.currency || 'HKD'} {editFormData.calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {editFormData.amount || 0} {editFormData.currency || 'USD'} × {editFormData.conversionRate || 1} = {editFormData.calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedOrder?.currency || 'HKD'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* OTP Workflow for Requested Status - Only show after amount/currency/conversion rate are set */}
                    {selectedPayment.status === 'requested' && editFormData.amount > 0 && editFormData.currency && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4 space-y-4">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white">OTP Verification</h4>
                        
                        {!otpSent && (
                          <button
                            onClick={handleSendOTP}
                            disabled={sendingOtp || !editFormData.amount || !editFormData.currency}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingOtp ? 'Sending OTP...' : 'Send OTP'}
                          </button>
                        )}

                        {otpSent && !otpVerified && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Enter OTP
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={otpValue}
                                  onChange={(e) => setOtpValue(e.target.value)}
                                  placeholder="Enter 6-digit OTP"
                                  maxLength={6}
                                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                                <button
                                  onClick={handleVerifyOTP}
                                  disabled={verifyingOtp || !otpValue || otpValue.length !== 6}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
                                </button>
                              </div>
                            </div>
                            
                            {/* Countdown timer and Resend button */}
                            <div className="flex items-center justify-between">
                              {otpCountdown > 0 ? (
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  <i className="fas fa-clock mr-2"></i>
                                  Resend OTP in {otpCountdown}s
                                </div>
                              ) : (
                                <button
                                  onClick={handleSendOTP}
                                  disabled={sendingOtp}
                                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {sendingOtp ? 'Sending...' : 'Resend OTP'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {otpVerified && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                            <p className="text-sm text-green-800 dark:text-green-300">
                              <i className="fas fa-check-circle mr-2"></i>
                              OTP verified successfully. You can now change status to verify.
                            </p>
                          </div>
                        )}
                      </div>
                    )}


                    {/* Regular Fields for Non-Requested Status */}
                    {selectedPayment.status !== 'requested' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Amount
                          </label>
                          <input
                            type="text"
                            value={editFormData.amount}
                            onChange={(e) => {
                              if (!isPaymentApproved()) {
                                const filteredValue = handleNumericInput(e.target.value, true, false);
                                const amount = roundToTwoDecimals(parseFloat(filteredValue) || 0);
                                setEditFormData(prev => ({ 
                                  ...prev, 
                                  amount: filteredValue === '' ? 0 : amount
                                }));
                              }
                            }}
                            disabled={isPaymentApproved()}
                            readOnly={isPaymentApproved()}
                            className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                              isPaymentApproved() ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Currency
                          </label>
                          <select
                            value={editFormData.currency}
                            onChange={(e) => {
                              const isApproved = selectedPayment.status === 'approved' || editFormData.status === 'approved';
                              if (!isApproved) {
                                setEditFormData({ ...editFormData, currency: e.target.value });
                              }
                            }}
                            disabled={selectedPayment.status === 'approved' || editFormData.status === 'approved'}
                            className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                              (selectedPayment.status === 'approved' || editFormData.status === 'approved') ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                            }`}
                          >
                            <option value="">Select Currency</option>
                            <option value="USD">USD</option>
                            <option value="AED">AED</option>
                            <option value="HKD">HKD</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={editFormData.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          const currentStatus = selectedPayment.status;
                          
                          // Validate status transition
                          if (newStatus) {
                            const isValidTransition = validateStatusTransition(currentStatus, newStatus);
                            if (!isValidTransition.valid) {
                              toastHelper.showTost(isValidTransition.message || 'Invalid status transition', 'error');
                              // Reset to current status
                              setEditFormData({ ...editFormData, status: currentStatus });
                              return;
                            }
                          }
                          
                          setEditFormData({ ...editFormData, status: newStatus });
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Select Status</option>
                        {paymentStatuses
                          .filter((status) => {
                            // Always show current status
                            if (status === selectedPayment.status) {
                              return true;
                            }
                            // Only show valid transitions
                            const isValid = validateStatusTransition(selectedPayment.status, status);
                            return isValid.valid;
                          })
                          .map((status) => {
                            return (
                              <option 
                                key={status} 
                                value={status}
                              >
                                {status === 'verify' ? 'Verify' : status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Transaction Reference
                      </label>
                      <input
                        type="text"
                        value={editFormData.transactionRef}
                        onChange={(e) => {
                          if (!isPaymentApproved()) {
                            setEditFormData({ ...editFormData, transactionRef: e.target.value });
                          }
                        }}
                        disabled={isPaymentApproved()}
                        readOnly={isPaymentApproved()}
                        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                          isPaymentApproved() ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                        }`}
                        placeholder="Enter transaction reference"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Remarks
                      </label>
                      <textarea
                        value={editFormData.remarks}
                        onChange={(e) => {
                          const isApproved = selectedPayment.status === 'approved' || editFormData.status === 'approved';
                          if (!isApproved) {
                            setEditFormData({ ...editFormData, remarks: e.target.value });
                          }
                        }}
                        rows={3}
                        disabled={selectedPayment.status === 'approved' || editFormData.status === 'approved'}
                        readOnly={selectedPayment.status === 'approved' || editFormData.status === 'approved'}
                        className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                          (selectedPayment.status === 'approved' || editFormData.status === 'approved') ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''
                        }`}
                        placeholder="Enter remarks..."
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={closeModal}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdatePayment}
                        disabled={!editFormData.status || (selectedPayment.status === 'requested' && (!otpVerified || !editFormData.amount || !editFormData.currency))}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Update Payment
                      </button>
                      {selectedPayment.status === 'requested' && !otpVerified && (
                        <p className="text-xs text-red-500 mt-1">
                          Please verify OTP before updating payment
                        </p>
                      )}
                      {(selectedPayment.status === 'approved' || editFormData.status === 'approved') && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                          Only status can be changed for approved payments
                        </p>
                      )}
                    </div>
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

export default Payments;


