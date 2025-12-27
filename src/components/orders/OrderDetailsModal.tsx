import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Order, TrackingItem, AdminOrderService } from "../../services/order/adminOrder.services";

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

interface Payment {
  _id: string;
  orderId: string;
  customerId: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: string;
  paymentDetails?: any;
  createdAt: string;
  verifiedBy?: any;
  approvedBy?: any;
  verifiedAt?: string;
  approvedAt?: string;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const [trackingData, setTrackingData] = useState<TrackingItem[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (isOpen && order?._id) {
      fetchTrackingData();
      fetchPaymentDetails();
    }
  }, [isOpen, order?._id]);

  const fetchTrackingData = async () => {
    if (!order?._id) return;
    
    try {
      setLoadingTracking(true);
      const response = await AdminOrderService.getOrderTracking(order._id);
      if (response?.data?.docs) {
        setTrackingData(response.data.docs);
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setLoadingTracking(false);
    }
  };

  const fetchPaymentDetails = async () => {
    if (!order?._id) return;
    
    try {
      setLoadingPayments(true);
      const response = await AdminOrderService.getOrderWithPaymentDetails(order._id);
      if (response?.data?.docs) {
        setPayments(response.data.docs);
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  if (!isOpen || !order) return null;

  const formatPrice = (price: number | string): string => {
    if (typeof price === "string") {
      const num = parseFloat(price);
      return isNaN(num) ? "0.00" : num.toFixed(2);
    }
    return price.toFixed(2);
  };

  const formatDate = (date: string): string => {
    if (!date) return "-";
    try {
      return format(new Date(date), "yyyy-MM-dd HH:mm");
    } catch {
      return "-";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: string } = {
      requested: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700",
      verify: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700",
      approved: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700",
      confirm: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700",
      waiting_for_payment: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700",
      payment_received: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700",
      packing: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-700",
      ready_to_ship: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700",
      on_the_way: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-700",
      ready_to_pick: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700",
      delivered: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-700",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700",
    };

    const style = statusStyles[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-200 dark:border-gray-700";
    
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${style}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl 2xl:max-w-7xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Order Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Order ID & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Order ID
              </label>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                {order._id}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <div>{getStatusBadge(order.status)}</div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {order.customerId?.name || "-"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {order.customerId?.email || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Order Items
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      Product/SKU
                    </th>
                    <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      Price
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.cartItems && order.cartItems.length > 0 ? (
                    order.cartItems.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {item.skuFamilyId?.name || item.productId?.name || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-center text-gray-900 dark:text-gray-100">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                          ${formatPrice(item.price)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100 font-semibold">
                          ${formatPrice(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  {order.otherCharges && order.otherCharges > 0 && (
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-700 dark:text-gray-300">
                        Other Charges:
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                        ${formatPrice(order.otherCharges)}
                      </td>
                    </tr>
                  )}
                  {order.discount && order.discount > 0 && (
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-700 dark:text-gray-300">
                        Discount:
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-green-600 dark:text-green-400 font-medium">
                        -${formatPrice(order.discount)}
                      </td>
                    </tr>
                  )}
                  {order.appliedCharges && order.appliedCharges.length > 0 && (
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-700 dark:text-gray-300">
                        Applied Charges:
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                        ${formatPrice(order.appliedCharges.reduce((sum: number, charge: any) => sum + (charge.calculatedAmount || 0), 0))}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-50 dark:bg-gray-700 font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                      Total Amount:
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                      ${formatPrice(order.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Admin Selected Payment Method */}
          {order.adminSelectedPaymentMethod && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Payment Method (Selected by Admin)
              </h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                  {order.adminSelectedPaymentMethod}
                </p>
              </div>
            </div>
          )}

          {/* Billing Address */}
          {order.billingAddress && order.billingAddress.address && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Billing Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {order.billingAddress?.address || "-"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {order.billingAddress?.city || "-"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Postal Code
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {order.billingAddress?.postalCode || "-"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {order.billingAddress?.country || "-"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Shipping Address */}
          {order.shippingAddress && (order.shippingAddress.address || order.shippingAddress.country) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Shipping Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {order.shippingAddress?.address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {order.shippingAddress.address}
                    </p>
                  </div>
                )}
                {order.shippingAddress?.city && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      City
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {order.shippingAddress.city}
                    </p>
                  </div>
                )}
                {order.shippingAddress?.postalCode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Postal Code
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {order.shippingAddress.postalCode}
                    </p>
                  </div>
                )}
                {order.shippingAddress?.country && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Country
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {order.shippingAddress.country.charAt(0).toUpperCase() + order.shippingAddress.country.slice(1)}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Details */}
          {order.paymentDetails && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Payment Details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.paymentDetails.module && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Module
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {order.paymentDetails.module}
                      </p>
                    </div>
                  )}
                  {order.paymentDetails.currency && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Currency
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {order.paymentDetails.currency}
                      </p>
                    </div>
                  )}
                  {order.paymentDetails.acceptedTerms !== undefined && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Accepted Terms
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {order.paymentDetails.acceptedTerms ? "Yes" : "No"}
                      </p>
                    </div>
                  )}
                  {order.paymentDetails.transactionRef && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Transaction Reference
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {order.paymentDetails.transactionRef}
                      </p>
                    </div>
                  )}
                  {order.paymentDetails.status && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Status
                      </label>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        order.paymentDetails.status === 'approved' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : order.paymentDetails.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : order.paymentDetails.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {order.paymentDetails.status.charAt(0).toUpperCase() + order.paymentDetails.status.slice(1)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dynamic Fields */}
                {order.paymentDetails.fields && Object.keys(order.paymentDetails.fields).length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Additional Fields
                    </label>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                      {Object.entries(order.paymentDetails.fields).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 border-b border-gray-200 dark:border-gray-600 pb-2 last:border-0 last:pb-0">
                          <div className="font-medium text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </div>
                          <div className="md:col-span-2 text-sm text-gray-900 dark:text-gray-100 break-words">
                            {typeof value === 'string' && (value.startsWith('http') || value.startsWith('/')) ? (
                              <a 
                                href={value} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {value}
                              </a>
                            ) : (
                              String(value || '-')
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploaded Files */}
                {/* {order.paymentDetails.uploadedFiles && order.paymentDetails.uploadedFiles.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Uploaded Files
                    </label>
                    <div className="space-y-2">
                      {order.paymentDetails.uploadedFiles.map((filePath, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                          <i className="fas fa-file text-gray-400"></i>
                          <a 
                            href={filePath} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex-1 truncate"
                          >
                            {filePath.split('/').pop() || filePath}
                          </a>
                          <a
                            href={filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            title="Download"
                          >
                            <i className="fas fa-download"></i>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )} */}

                {/* Remarks */}
                {order.paymentDetails.remarks && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Remarks
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      {order.paymentDetails.remarks}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Receiver Details */}
          {order.receiverDetails && (order.receiverDetails.name || order.receiverDetails.mobile) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Receiver Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {order.receiverDetails.name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Receiver Name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {order.receiverDetails.name}
                    </p>
                  </div>
                )}
                {order.receiverDetails.mobile && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Receiver Mobile
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {order.receiverDetails.mobile}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payments List */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Payments
            </h3>
            {loadingPayments ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading payments...</p>
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-4">
                {payments.map((payment, index) => (
                  <div key={payment._id || index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Payment Method
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                          {payment.paymentMethod || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Status
                        </label>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          payment.status === 'approved' || payment.status === 'paid'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : payment.status === 'rejected'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : payment.status === 'verify' || payment.status === 'verified'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1) || '-'}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Amount
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                          {payment.currency || 'USD'} {formatPrice(payment.amount || 0)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Payment Date
                        </label>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(payment.createdAt)}
                        </p>
                      </div>
                      {/* {payment.verifiedBy && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Verified By
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {typeof payment.verifiedBy === 'object' 
                              ? payment.verifiedBy.name || payment.verifiedBy.email || '-'
                              : payment.verifiedBy || '-'}
                            {payment.verifiedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                ({formatDate(payment.verifiedAt)})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                      {payment.approvedBy && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Approved By
                          </label>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {typeof payment.approvedBy === 'object' 
                              ? payment.approvedBy.name || payment.approvedBy.email || '-'
                              : payment.approvedBy || '-'}
                            {payment.approvedAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                ({formatDate(payment.approvedAt)})
                              </span>
                            )}
                          </p>
                        </div>
                      )} */}
                    </div>
                    {/* Payment Details Fields */}
                    {/* {payment.paymentDetails && typeof payment.paymentDetails === 'object' && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Payment Information
                        </label>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
                          {Object.entries(payment.paymentDetails).map(([key, value]) => (
                            <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                              <div className="font-medium text-sm text-gray-700 dark:text-gray-300 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}:
                              </div>
                              <div className="md:col-span-2 text-sm text-gray-900 dark:text-gray-100 break-words">
                                {typeof value === 'string' && (value.startsWith('http') || value.startsWith('/')) ? (
                                  <a 
                                    href={value} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {value}
                                  </a>
                                ) : (
                                  String(value || '-')
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )} */}
                  </div>
                ))}
                {/* Payment Summary */}
                {payments.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 2xl:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Total Paid
                        </label>
                        <p className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                          {order.currency || 'USD'} {formatPrice(
                            payments
                              .filter(p => ['requested', 'verify', 'verified', 'approved', 'paid'].includes(p.status))
                              .reduce((sum, p) => sum + (p.amount || 0), 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Remaining Balance
                        </label>
                        <p className="text-lg font-semibold text-orange-800 dark:text-orange-300">
                          {order.currency || 'USD'} {formatPrice(
                            order.totalAmount - payments
                              .filter(p => ['requested', 'verify', 'verified', 'approved', 'paid'].includes(p.status))
                              .reduce((sum, p) => sum + (p.amount || 0), 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Total Amount
                        </label>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {order.currency || 'USD'} {formatPrice(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                No payments found
              </div>
            )}
          </div>

          {/* Applied Charges */}
          {order.appliedCharges && order.appliedCharges.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Applied Charges
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                        Cost Type
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                        Value
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                        Calculated Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.appliedCharges.map((charge: any, index: number) => (
                      <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {charge.type || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                          {charge.costType || "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                          {charge.value ? `${charge.value}${charge.costType === 'Percentage' ? '%' : ''}` : "-"}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100 font-semibold">
                          ${formatPrice(charge.calculatedAmount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Location & Currency */}
          {(order.currentLocation || order.deliveryLocation || order.currency) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Location & Currency
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {order.currentLocation && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Current Location
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {order.currentLocation === 'HK' ? 'Hong Kong' : 'Dubai'}
                    </p>
                  </div>
                )}
                {order.deliveryLocation && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Delivery Location
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {order.deliveryLocation === 'HK' ? 'Hong Kong' : 'Dubai'}
                    </p>
                  </div>
                )}
                {order.currency && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Currency
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      {order.currency}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other Charges */}
          {order.otherCharges && order.otherCharges > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Other Charges
              </h3>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <p className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">
                  ${formatPrice(order.otherCharges)}
                </p>
              </div>
            </div>
          )}

          {/* Order Tracking Images */}
          {loadingTracking ? (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading tracking images...</p>
              </div>
            </div>
          ) : trackingData && trackingData.length > 0 && trackingData.some(track => track.images && track.images.length > 0) ? (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Tracking Images
              </h3>
              <div className="space-y-4">
                {trackingData.map((track: TrackingItem, trackIndex: number) => {
                  if (!track.images || track.images.length === 0) return null;
                  
                  return (
                    <div key={trackIndex} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {track.status?.charAt(0).toUpperCase() + track.status?.slice(1).replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({formatDate(track.changedAt)})
                        </span>
                        {track.userType && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            by {track.userType}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {track.images.map((img: string, imgIndex: number) => {
                          const baseUrl = import.meta.env.VITE_BASE_URL || '';
                          // Handle different path formats
                          let imageUrl = img;
                          if (!img.startsWith('http')) {
                            if (img.startsWith('uploads/')) {
                              imageUrl = `/${img}`;
                            } else if (!img.startsWith('/')) {
                              imageUrl = `/uploads/${img}`;
                            } else {
                              imageUrl = img;
                            }
                          }
                          const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;
                          
                          return (
                            <div key={imgIndex} className="relative group">
                              <a
                                href={fullImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={fullImageUrl}
                                  alt={`Tracking image ${imgIndex + 1}`}
                                  className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=Image+Not+Found';
                                  }}
                                />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Order Information */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Order Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Created At
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              {order.verifiedBy && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Verified By
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {typeof order.verifiedBy === 'object' ? order.verifiedBy.name || order.verifiedBy.email : order.verifiedBy}
                  </p>
                </div>
              )}
              {order.approvedBy && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Approved By
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {typeof order.approvedBy === 'object' ? order.approvedBy.name || order.approvedBy.email : order.approvedBy}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;

