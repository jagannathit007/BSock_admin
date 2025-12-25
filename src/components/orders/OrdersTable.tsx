import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { format } from "date-fns";
import toastHelper from "../../utils/toastHelper";
import { AdminOrderService, Order, TrackingItem, OrderItem } from "../../services/order/adminOrder.services";
import { OrderPaymentService } from "../../services/orderPayment/orderPayment.services";
import { LOCAL_STORAGE_KEYS } from "../../constants/localStorage";
import OrderDetailsModal from "./OrderDetailsModal";
import { useDebounce } from "../../hooks/useDebounce";
import { usePermissions } from "../../context/PermissionsContext";
import api from "../../services/api/api";
import { handleNumericInput } from "../../utils/numericInput";
import { roundToTwoDecimals } from "../../utils/numberPrecision";

const OrdersTable: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canVerifyApprove = hasPermission('/orders', 'verifyApprove');
  
  const [ordersData, setOrdersData] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentAdminId, setCurrentAdminId] = useState<string>("");
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [itemsPerPage] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [fullyPaidOrders, setFullyPaidOrders] = useState<Set<string>>(new Set());

  const allStatusOptions = ["requested", "rejected", "verify", "approved", "confirm", "waiting_for_payment", "payment_received", "packing", "ready_to_ship", "on_the_way", "ready_to_pick", "delivered", "cancelled"];
  
  // Get available status options for filter dropdown based on admin
  const getAvailableFilterStatuses = (): string[] => {
    // For now, show all statuses in filter dropdown
    // This can be customized based on specific admin requirements
    return allStatusOptions;
  };

  useEffect(() => {
    // Get current admin ID from localStorage
    // Try ADMIN_ID first, then USER_ID as fallback
    let adminId = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_ID) || "";
    if (!adminId) {
      adminId = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_ID) || "";
    }
    // Also try to get from user object if available
    if (!adminId) {
      const userStr = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          adminId = user._id || user.id || "";
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
    }
    setCurrentAdminId(adminId);
    fetchOrders();
  }, [currentPage, debouncedSearchTerm, statusFilter]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const handleExport = async () => {
    try {
      const blob = await AdminOrderService.exportOrdersExcel(statusFilter || undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toastHelper.showTost('Export started', 'success');
    } catch (e) {}
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await AdminOrderService.getOrderList(
        currentPage,
        itemsPerPage,
        debouncedSearchTerm || undefined,
        statusFilter || undefined
      );
      // Ensure ordersData is always an array
      setOrdersData(Array.isArray(response.data?.docs) ? response.data.docs : []);
      setTotalPages(response.data?.totalPages || 1);
      setTotalDocs(response.data?.totalDocs || 0);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrdersData([]);
      setTotalPages(1);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  // Get available status options based on current order and admin
  const getAvailableStatusOptions = async (order: Order): Promise<string[]> => {
    // Get current admin ID (refresh from localStorage to ensure we have latest)
    let adminId = currentAdminId;
    if (!adminId) {
      adminId = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_ID) || "";
      if (!adminId) {
        adminId = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_ID) || "";
      }
      if (!adminId) {
        const userStr = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            adminId = user._id || user.id || "";
          } catch (e) {
            console.error('Error parsing user from localStorage:', e);
          }
        }
      }
    }
    
    const currentStatus = order.status;
    
    // Get dynamic stages from backend based on order's location and currency
    let orderStages: string[] = [];
    try {
      if (order.currentLocation && order.deliveryLocation && order.currency) {
        orderStages = await AdminOrderService.getOrderStages(
          order.currentLocation,
          order.deliveryLocation,
          order.currency
        );
      } else {
        // Keep verify directly after requested; rejected is handled separately
        orderStages = ["requested", "verify", "approved", "confirm", "waiting_for_payment", "payment_received", "packing", "ready_to_ship", "on_the_way", "ready_to_pick", "delivered", "rejected"];
      }
    } catch (error) {
      console.error('Error fetching order stages:', error);
      orderStages = ["requested", "verify", "approved", "confirm", "waiting_for_payment", "payment_received", "packing", "ready_to_ship", "on_the_way", "ready_to_pick", "delivered", "rejected"];
    }
    
    // Remove cancelled entirely from options
    orderStages = orderStages.filter((s) => s !== "cancelled");
    
    const currentIndex = orderStages.indexOf(currentStatus);
    const availableStatuses: string[] = [];
    
    // Always include current status
    if (currentStatus) availableStatuses.push(currentStatus);
    
    // Include one next status if exists
    if (currentIndex >= 0 && currentIndex < orderStages.length - 1) {
      const nextStatus = orderStages[currentIndex + 1];
      if (nextStatus) availableStatuses.push(nextStatus);
    }

    // Ensure verify is available after requested (if present in stages)
    const verifyIndex = orderStages.indexOf("verify");
    if (verifyIndex > -1 && verifyIndex !== currentIndex && !availableStatuses.includes("verify")) {
      // Only offer verify if it comes after current status in the flow
      if (currentIndex === -1 || verifyIndex >= currentIndex) {
        availableStatuses.push("verify");
      }
    }
    
    // Allow rejected only before payment_received
    if (currentStatus !== "rejected") {
      const paymentReceivedIndex = orderStages.indexOf("payment_received");
      if (paymentReceivedIndex === -1 || currentIndex < paymentReceivedIndex) {
        availableStatuses.push("rejected");
      }
    }
    
    // Filter based on admin permissions
    // Extract verifiedBy and approvedBy IDs properly
    let verifiedById: string | null = null;
    let approvedById: string | null = null;
    
    // Handle verifiedBy - can be object with _id, string, or null
    if (order.verifiedBy) {
      if (typeof order.verifiedBy === 'object' && order.verifiedBy !== null) {
        // Handle both { _id: ... } and direct ID
        verifiedById = (order.verifiedBy as any)._id ? String((order.verifiedBy as any)._id) : 
                      (order.verifiedBy as any).id ? String((order.verifiedBy as any).id) : 
                      String(order.verifiedBy);
      } else if (typeof order.verifiedBy === 'string') {
        verifiedById = order.verifiedBy;
      }
    }
    
    // Handle approvedBy - can be object with _id, string, or null
    if (order.approvedBy) {
      if (typeof order.approvedBy === 'object' && order.approvedBy !== null) {
        // Handle both { _id: ... } and direct ID
        approvedById = (order.approvedBy as any)._id ? String((order.approvedBy as any)._id) : 
                       (order.approvedBy as any).id ? String((order.approvedBy as any).id) : 
                       String(order.approvedBy);
      } else if (typeof order.approvedBy === 'string') {
        approvedById = order.approvedBy;
      }
    }
    
    // Normalize currentAdminId for comparison - ensure it's a string
    // Use the adminId we just retrieved
    const normalizedCurrentAdminId = adminId ? String(adminId).trim() : '';
    
    // Normalize verifiedById and approvedById for comparison
    const normalizedVerifiedById = verifiedById ? String(verifiedById).trim() : null;
    const normalizedApprovedById = approvedById ? String(approvedById).trim() : null;
    
    // If order is already verified, don't show verify option
    if (normalizedVerifiedById) {
      const verifyIndex = availableStatuses.indexOf("verify");
      if (verifyIndex >= 0) {
        availableStatuses.splice(verifyIndex, 1);
      }
    }
    
    // If order is already approved, don't show approved option
    if (normalizedApprovedById) {
      const approvedIndex = availableStatuses.indexOf("approved");
      if (approvedIndex >= 0) {
        availableStatuses.splice(approvedIndex, 1);
      }
    }
    
    // Critical: If current admin verified the order, hide "approved" option (same admin cannot approve)
    // Compare both normalized strings
    if (normalizedVerifiedById && normalizedCurrentAdminId) {
      const isMatch = normalizedVerifiedById === normalizedCurrentAdminId;
      if (isMatch) {
        const approvedIndex = availableStatuses.indexOf("approved");
        if (approvedIndex >= 0) {
          availableStatuses.splice(approvedIndex, 1);
          console.log('✅ Removed "approved" option - Current admin verified this order', {
            currentAdminId: normalizedCurrentAdminId,
            verifiedById: normalizedVerifiedById
          });
        }
      }
    }
    
    // If current admin approved the order, hide "verify" option (same admin cannot verify)
    if (normalizedApprovedById && normalizedCurrentAdminId) {
      const isMatch = normalizedApprovedById === normalizedCurrentAdminId;
      if (isMatch) {
        const verifyIndex = availableStatuses.indexOf("verify");
        if (verifyIndex >= 0) {
          availableStatuses.splice(verifyIndex, 1);
          console.log('✅ Removed "verify" option - Current admin approved this order', {
            currentAdminId: normalizedCurrentAdminId,
            approvedById: normalizedApprovedById
          });
        }
      }
    }
    
    // IMPORTANT: Hide "verify" option if order was modified but customer hasn't confirmed yet
    // Admin can only verify AFTER customer confirms (isConfirmedByCustomer must be true)
    // Check if order was modified (has token) and customer hasn't confirmed
    if (order.modificationConfirmationToken !== null && order.modificationConfirmationToken !== undefined) {
      if (!order.isConfirmedByCustomer) {
        const verifyIndex = availableStatuses.indexOf("verify");
        if (verifyIndex >= 0) {
          availableStatuses.splice(verifyIndex, 1);
        }
      }
    }
    // Also check if quantities were modified but no token sent yet (quantitiesModified flag)
    if (order.quantitiesModified && !order.modificationConfirmationToken) {
      const verifyIndex = availableStatuses.indexOf("verify");
      if (verifyIndex >= 0) {
        availableStatuses.splice(verifyIndex, 1);
      }
    }
    
    return [...new Set(availableStatuses)];
  };

  const handleUpdateStatus = async (order: Order) => {
    try {
      // Ensure we have the latest admin ID
      let adminId = currentAdminId;
      if (!adminId) {
        adminId = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_ID) || "";
        if (!adminId) {
          adminId = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_ID) || "";
        }
        if (!adminId) {
          const userStr = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
          if (userStr) {
            try {
              const user = JSON.parse(userStr);
              adminId = user._id || user.id || "";
            } catch (e) {
              console.error('Error parsing user from localStorage:', e);
            }
          }
        }
      }
      
      const currentStatus = order.status;
      const canEditOrder = !!(order as any).canEditOrder;
      const availableStatusOptions = await getAvailableStatusOptions(order);
      
      // Check if current admin has permission to update this order's status
      const canUpdateStatus = order.verifiedBy === currentAdminId || order.approvedBy === currentAdminId;
      
      // If no options available (shouldn't happen, but safety check)
      if (availableStatusOptions.length === 0) {
        toastHelper.showTost("No status options available for this order", "warning");
        return;
      }
      
      // Check if admin has permission to update status
      // Allow updates for new orders (request status) or if admin has permission
      const isNewOrder = currentStatus === "request" && !order.verifiedBy && !order.approvedBy;
      
      // Allow status updates for all statuses in the flow
      // No need for complex permission checks since we're following the flow
      if (!isNewOrder && !canUpdateStatus && ["verified", "approved"].includes(currentStatus)) {
        // Only restrict if it's not a new order and admin doesn't have permission
        // For the flow-based approach, we'll allow updates
      }

      let selectedStatus = currentStatus;
      let editedCartItems: OrderItem[] = [...order.cartItems];
      let message = "";
      let selectedPaymentMethod: string | undefined = order.adminSelectedPaymentMethod || undefined;
      let availablePaymentMethods: string[] = [];
      let selectedOtherCharges: number | null = order.otherCharges || null;
      let selectedDiscount: number | null = order.discount || null;
      let selectedImages: File[] = [];

      // Get order stages to check if we can edit order
      let orderStages: string[] = [];
      try {
        if (order.currentLocation && order.deliveryLocation && order.currency) {
          orderStages = await AdminOrderService.getOrderStages(
            order.currentLocation,
            order.deliveryLocation,
            order.currency
          );
        }
      } catch (error) {
        console.error('Error fetching order stages:', error);
      }
      
      // Debug: Log cart items to check MOQ availability (NOT stock)
      console.log('Order cart items for MOQ check:', order.cartItems.map(item => {
        const productId = item.productId;
        const isPopulated = productId && typeof productId === 'object' && productId !== null;
        return {
          productIdType: typeof productId,
          moq: isPopulated && 'moq' in productId ? productId.moq : ((item as any).moq || 'not found'),
          stock: isPopulated && 'stock' in productId ? productId.stock : ((item as any).stock || 'not found'),
          usingMoq: isPopulated && 'moq' in productId && productId.moq != null && productId.moq > 0 ? productId.moq : 1,
        };
      }));

      // Create a simpler modal HTML structure
      const modalHtml = `
        <div style="text-align: left; padding: 20px; font-family: 'Inter', sans-serif; max-height: 600px; overflow-y: auto;">
          <div style="margin-bottom: 20px;">
            <label for="statusSelect" style="display: block; font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Select Status</label>
            <select id="statusSelect" style="width: 100%; padding: 10px; font-size: 14px; margin:0px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #F9FAFB; color: #1F2937; outline: none; transition: border-color 0.2s;">
              ${availableStatusOptions
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      status === currentStatus ? "selected" : ""
                    }>${status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}</option>`
                )
                .join("")}
            </select>
          </div>
          <div id="cartItemsContainer" style="margin-bottom: 20px; display: none;">
            <h4 style="font-size: 16px; font-weight: 600; color: #1F2937; margin-bottom: 12px;">Edit Quantities</h4>
            ${order.cartItems
              .map(
                (item, index) => {
                  // Helper function to get MOQ from item (NOT stock)
                  const getMoq = () => {
                    // Check if productId is populated object with moq
                    if (item.productId && typeof item.productId === 'object' && item.productId !== null) {
                      // Explicitly check for moq property, not stock
                      if ('moq' in item.productId && item.productId.moq != null && item.productId.moq > 0) {
                        return item.productId.moq;
                      }
                    }
                    // Check if moq is directly on item (from cart)
                    if ((item as any).moq != null && (item as any).moq > 0) {
                      return (item as any).moq;
                    }
                    // Default to 1 (NOT stock)
                    return 1;
                  };
                  
                  const moq = getMoq();
                  const itemPrice = item.price || 0;
                  
                  // Get stock from productId
                  const getStock = () => {
                    if (item.productId && typeof item.productId === 'object' && item.productId !== null) {
                      if ('stock' in item.productId && item.productId.stock != null) {
                        return item.productId.stock;
                      }
                    }
                    return null; // Stock will be fetched from backend
                  };
                  
                  const stock = getStock();
                  const productId = item.productId?._id || (item.productId && typeof item.productId === 'object' ? item.productId._id : null) || '';
                  
                  return `
                  <div style="margin-bottom: 16px; padding: 12px; background-color: #F9FAFB; border-radius: 6px; border: 1px solid #E5E7EB;" class="cart-item-container" data-product-id="${productId}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151;">
                        ${item.skuFamilyId?.name || (item.productId && typeof item.productId === 'object' ? item.productId.name : 'Product')}
                        ${moq > 1 ? `<span style="font-size: 12px; color: #6B7280; font-weight: normal;"> (MOQ: ${moq})</span>` : ''}
                      </label>
                      <span style="font-size: 14px; font-weight: 600; color: #1F2937;">Price: $${itemPrice.toFixed(2)}</span>
                    </div>
                    <input
                      type="text"
                      min="${moq}"
                      value="${item.quantity}"
                      class="quantity-input"
                      data-item-index="${index}"
                      data-moq="${moq}"
                      data-price="${itemPrice}"
                      data-product-id="${productId}"
                      data-stock="${stock || ''}"
                      style="width: 100%; margin:0px; padding: 8px; font-size: 14px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #FFFFFF; color: #1F2937; outline: none; transition: border-color 0.2s;"
                    />
                    <div class="validation-message" style="font-size: 11px; margin-top: 4px; margin-bottom: 0; min-height: 16px;"></div>
                    ${moq > 1 ? `<p style="font-size: 11px; color: #6B7280; margin-top: 4px; margin-bottom: 0;">Minimum order quantity: ${moq}</p>` : ''}
                    ${stock !== null ? `<p style="font-size: 11px; color: #6B7280; margin-top: 2px; margin-bottom: 0;">Available stock: ${stock}</p>` : ''}
                  </div>
                  `;
                }
              )
              .join("")}
            <div id="newOrderPriceContainer" style="margin-top: 16px; padding: 12px; background-color: #EFF6FF; border-radius: 6px; border: 1px solid #3B82F6; display: none;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 600; color: #1E40AF;">New Order Total:</span>
                <span id="newOrderTotal" style="font-size: 18px; font-weight: 700; color: #1E40AF;">$0.00</span>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #93C5FD;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span style="font-size: 12px; color: #6B7280;">Original Total:</span>
                  <span id="originalOrderTotal" style="font-size: 12px; color: #6B7280;">$${order.totalAmount.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-size: 12px; color: #6B7280;">Difference:</span>
                  <span id="orderDifference" style="font-size: 12px; font-weight: 600; color: #DC2626;">$0.00</span>
                </div>
              </div>
            </div>
          </div>
          <div id="sendConfirmationContainer" style="margin-bottom: 20px; display: none;">
            <div style="padding: 12px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 6px; margin-bottom: 12px;">
              <p style="margin: 0; font-size: 13px; color: #92400E; font-weight: 500;">
                <strong>⚠️ Important:</strong> Order quantities have been modified. You must send a confirmation email to the customer before you can change status to verify.
              </p>
            </div>
            <button
              type="button"
              id="sendConfirmationBtn"
              style="width: 100%; padding: 12px; background-color: #F59E0B; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
              onmouseover="this.style.backgroundColor='#D97706'"
              onmouseout="this.style.backgroundColor='#F59E0B'"
            >
              <i class="fas fa-envelope" style="margin-right: 8px;"></i>
              <span id="sendConfirmationBtnText">
                ${order.modificationConfirmationToken 
                  ? (order.modificationConfirmationExpiry && new Date(order.modificationConfirmationExpiry) < new Date()
                      ? "Resend Confirmation Email (Expired)" 
                      : "Resend Confirmation Email")
                  : "Send Confirmation Email"}
              </span>
            </button>
            ${order.isConfirmedByCustomer ? `
              <div style="margin-top: 12px; padding: 12px; background-color: #D1FAE5; border-left: 4px solid #10B981; border-radius: 6px;">
                <p style="margin: 0; font-size: 13px; color: #065F46; font-weight: 600;">
                  <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
                  ✅ Customer has confirmed the order modifications. You can now change status to verify.
                </p>
              </div>
            ` : order.modificationConfirmationToken ? `
              <div style="margin-top: 12px; padding: 12px; background-color: #FEE2E2; border-left: 4px solid #EF4444; border-radius: 6px;">
                <p style="margin: 0; font-size: 13px; color: #991B1B; font-weight: 500;">
                  <i class="fas fa-clock" style="margin-right: 8px;"></i>
                  ⏳ Waiting for customer confirmation. Verify option will be available after customer confirms.
                </p>
              </div>
            ` : ''}
          </div>
          <div id="otherChargesContainer" style="margin-bottom: 20px;">
            <label for="otherChargesInput" style="display: block; font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Other Charges</label>
            ${order.otherCharges !== null && order.otherCharges !== undefined && Number(order.otherCharges) > 0 ? `
              <div style="padding: 10px; border: 1px solid #E5E7EB; border-radius: 6px; background-color: #F9FAFB; color: #111827; font-size: 14px;">
                Added: ${Number(order.otherCharges).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p style="font-size: 12px; color: #6B7280; margin-top: 4px;">Other charges already applied to this order.</p>
            ` : `
              <input
                type="text"
                id="otherChargesInput"
                min="0"
                step="0.01"
                value="${selectedOtherCharges || ''}"
                placeholder="Enter other charges amount"
                style="width: 100%; margin:0px; padding: 10px; font-size: 14px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #F9FAFB; color: #1F2937; outline: none; transition: border-color 0.2s;"
              />
              <p style="font-size: 12px; color: #6B7280; margin-top: 4px;">Other charges will be added to the order total.</p>
            `}
          </div>
          <div id="paymentMethodContainer" style="margin-bottom: 20px; display: none;">
            <label for="paymentMethodSelect" style="display: block; font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Payment Method <span style="color: #EF4444;">*</span></label>
            <select id="paymentMethodSelect" style="width: 100%; padding: 10px; font-size: 14px; margin:0px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #F9FAFB; color: #1F2937; outline: none; transition: border-color 0.2s;">
              <option value="">Select Payment Method</option>
            </select>
            <p style="font-size: 12px; color: #6B7280; margin-top: 4px;">Select the payment method for this order. Customer will use this method to submit payment.</p>
          </div>
          <div id="discountContainer" style="margin-bottom: 20px; display: none;">
            <label for="discountInput" style="display: block; font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Discount</label>
            ${order.discount !== null && order.discount !== undefined && Number(order.discount) > 0 ? `
              <div style="padding: 10px; border: 1px solid #E5E7EB; border-radius: 6px; background-color: #F9FAFB; color: #111827; font-size: 14px;">
                Applied: ${Number(order.discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p style="font-size: 12px; color: #6B7280; margin-top: 4px;">Discount already applied to this order.</p>
            ` : `
              <input
                type="text"
                id="discountInput"
                min="0"
                step="0.01"
                value=""
                placeholder="Enter discount amount"
                style="width: 100%; margin:0px; padding: 10px; font-size: 14px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #F9FAFB; color: #1F2937; outline: none; transition: border-color 0.2s;"
              />
              <p style="font-size: 12px; color: #6B7280; margin-top: 4px;">Discount will be subtracted from the order total. Only available before waiting for payment status.</p>
            `}
          </div>
          <div id="imagesContainer" style="margin-bottom: 20px;">
            <label for="imagesInput" style="display: block; font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Upload Images (Optional)</label>
            <input
              type="file"
              id="imagesInput"
              multiple
              accept="image/*"
              style="width: 100%; margin:0px; padding: 10px; font-size: 14px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #F9FAFB; color: #1F2937; outline: none; transition: border-color 0.2s;"
            />
          </div>
          <div>
            <label for="messageInput" style="display: block; font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Message (Optional)</label>
            <textarea
              id="messageInput"
              placeholder="Enter a message for this status change"
              style="width: 100%; margin:0px; padding: 10px; font-size: 14px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #F9FAFB; color: #1F2937; min-height: 100px; resize: vertical; outline: none; transition: border-color 0.2s;"
            ></textarea>
          </div>
          <div id="deliveredWarningContainer" style="display: none; margin-top: 20px;">
            <div style="padding: 12px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 6px; margin-bottom: 12px;">
              <p style="margin: 0; font-size: 13px; color: #92400E; font-weight: 500;">
                <strong>⚠️ Important:</strong> To change status to DELIVERED, you must send and verify OTP first.
              </p>
              ${order.receiverDetails?.mobile ? `
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #92400E;">
                  <strong>Receiver Mobile:</strong> ${order.receiverDetails.mobile}
                </p>
              ` : `
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #DC2626; font-weight: 600;">
                  ❌ Receiver details not available. Customer must add receiver details first.
                </p>
              `}
            </div>
            
            ${order.receiverDetails?.mobile ? `
              <div id="otpContainer" style="margin-bottom: 12px;">
                ${!order.deliveryOTP ? `
                  <button
                    type="button"
                    id="sendOTPBtn"
                    style="width: 100%; padding: 12px; background-color: #0071E0; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
                    onmouseover="this.style.backgroundColor='#005BB5'"
                    onmouseout="this.style.backgroundColor='#0071E0'"
                  >
                    <i class="fas fa-paper-plane" style="margin-right: 8px;"></i>
                    Send OTP to ${order.receiverDetails.mobile}
                  </button>
                ` : order.deliveryOTPExpiry && new Date(order.deliveryOTPExpiry) < new Date() ? `
                  <div style="margin-bottom: 12px; padding: 12px; background-color: #FEE2E2; border-left: 4px solid #EF4444; border-radius: 6px;">
                    <p style="margin: 0; font-size: 13px; color: #991B1B; font-weight: 500;">
                      <i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i>
                      OTP has expired. Please send a new OTP.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="sendOTPBtn"
                    style="width: 100%; padding: 12px; background-color: #0071E0; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
                    onmouseover="this.style.backgroundColor='#005BB5'"
                    onmouseout="this.style.backgroundColor='#0071E0'"
                  >
                    <i class="fas fa-paper-plane" style="margin-right: 8px;"></i>
                    Resend OTP to ${order.receiverDetails.mobile}
                  </button>
                ` : order.deliveryOTPVerified ? `
                  <div style="padding: 12px; background-color: #D1FAE5; border-left: 4px solid #10B981; border-radius: 6px;">
                    <p style="margin: 0; font-size: 13px; color: #065F46; font-weight: 600;">
                      <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
                      ✅ OTP Verified - Ready to mark as delivered
                    </p>
                  </div>
                ` : `
                  <div style="margin-bottom: 12px; padding: 12px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 6px;">
                    <p style="margin: 0; font-size: 13px; color: #92400E; font-weight: 500;">
                      <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
                      OTP sent to ${order.receiverDetails.mobile}. Please enter the OTP below to verify.
                    </p>
                  </div>
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                      Enter OTP
                    </label>
                    <input
                      type="text"
                      id="otpInput"
                      maxlength="6"
                      pattern="[0-9]{6}"
                      placeholder="Enter 6-digit OTP"
                      style="width: 100%; padding: 8px; font-size: 14px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #FFFFFF; color: #1F2937; outline: none; transition: border-color 0.2s;"
                    />
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                      <button
                        type="button"
                        id="verifyOTPBtn"
                        style="flex: 1; padding: 12px; background-color: #10B981; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
                        onmouseover="this.style.backgroundColor='#059669'"
                        onmouseout="this.style.backgroundColor='#10B981'"
                      >
                        <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
                        Verify OTP
                      </button>
                      <button
                        type="button"
                        id="resendOTPBtn"
                        style="flex: 1; padding: 12px; background-color: #0071E0; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
                        onmouseover="this.style.backgroundColor='#005BB5'"
                        onmouseout="this.style.backgroundColor='#0071E0'"
                      >
                        <i class="fas fa-redo" style="margin-right: 8px;"></i>
                        Resend OTP
                      </button>
                    </div>
                  </div>
                `}
              </div>
            ` : ''}
          </div>
        </div>
      `;

      const result = await Swal.fire({
        title: `Update Status for Order`,
        html: modalHtml,
        showCancelButton: true,
        confirmButtonText: "Change Status",
        cancelButtonText: "Cancel",
        width: 600,
        allowOutsideClick: false,
        allowEscapeKey: true,
        showLoaderOnConfirm: true,
        preConfirm: async () => {
          try {
            const statusSelect = document.getElementById("statusSelect") as HTMLSelectElement;
            const quantityInputs = document.querySelectorAll(".quantity-input") as NodeListOf<HTMLInputElement>;
            const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement;
            const otherChargesInput = document.getElementById("otherChargesInput") as HTMLInputElement;
            const discountInput = document.getElementById("discountInput") as HTMLInputElement;
            const imagesInput = document.getElementById("imagesInput") as HTMLInputElement;
            const paymentMethodSelect = document.getElementById("paymentMethodSelect") as HTMLSelectElement;

            if (!statusSelect) {
              Swal.showValidationMessage('Status select element not found');
              return false;
            }

            selectedStatus = statusSelect.value;
            message = messageInput?.value || "";
            
            // Get payment method if status is waiting_for_payment
            if (selectedStatus === 'waiting_for_payment') {
              if (!paymentMethodSelect || !paymentMethodSelect.value) {
                Swal.showValidationMessage('Please select a payment method');
                return false;
              }
              selectedPaymentMethod = paymentMethodSelect.value;
            }
            
            // Get otherCharges
            if (otherChargesInput) {
              const otherChargesValue = otherChargesInput.value;
              selectedOtherCharges = otherChargesValue ? parseFloat(otherChargesValue) : null;
              if (selectedOtherCharges !== null && selectedOtherCharges < 0) {
                Swal.showValidationMessage('Other charges cannot be negative');
              return false;
              }
            }

            // Get discount
            if (discountInput) {
              const discountValue = discountInput.value;
              selectedDiscount = discountValue ? parseFloat(discountValue) : null;
              if (selectedDiscount !== null && selectedDiscount < 0) {
                Swal.showValidationMessage('Discount cannot be negative');
                return false;
              }
            }

            // Get images
            if (imagesInput && imagesInput.files) {
              selectedImages = Array.from(imagesInput.files);
            }

            // Payment method selection will be handled in a separate module
            // No validation needed here

            // Validate OTP verification for delivered status
            if (selectedStatus === "delivered") {
              if (!order.receiverDetails?.mobile) {
                Swal.showValidationMessage('Receiver mobile number is required. Customer must add receiver details first.');
                return false;
              }
              
              // Fetch latest order state to check OTP verification status
              try {
                const latestOrdersResponse = await AdminOrderService.getOrderList(1, 100, order._id);
                const latestOrder = latestOrdersResponse?.data?.docs?.find((o: Order) => o._id === order._id);
                
                if (!latestOrder) {
                  Swal.showValidationMessage('Order not found. Please refresh and try again.');
                  return false;
                }
                
                if (!latestOrder.deliveryOTPVerified) {
                  Swal.showValidationMessage('OTP must be verified before changing status to DELIVERED. Please send and verify OTP first.');
                  return false;
                }
              } catch (error) {
                console.error('Error fetching latest order state:', error);
                // Fallback to checking the original order object
                if (!order.deliveryOTPVerified) {
                  Swal.showValidationMessage('OTP must be verified before changing status to DELIVERED. Please send and verify OTP first.');
                  return false;
                }
              }
            }

            // Other charges allowed at any stage (no validation block)

            console.log('Selected Status:', selectedStatus);
            console.log('Current Status:', currentStatus);
            // Payment method removed - will be handled in separate module
            console.log('Message:', message);
            console.log('Other Charges:', selectedOtherCharges);
            console.log('Images:', selectedImages.length);

            // Cart items editing allowed only in REQUESTED status
            // Validate MOQ, stock, and total MOQ when editing quantities
            if (canEditOrder && selectedStatus === "requested" && quantityInputs && quantityInputs.length > 0) {
              // Get validation function from the modal scope
              const validateQuantities = async (): Promise<{ isValid: boolean; errors: string[] }> => {
                const errors: string[] = [];
                const productDataMap = new Map<string, { stock: number; moq: number; groupCode: string | null; totalMoq: number | null }>();
                
                // First, get ALL product IDs from the order (not just the ones with inputs)
                // This ensures we validate totalMoq for all products in grouped orders
                const allOrderProductIds: string[] = [];
                order.cartItems.forEach((item) => {
                  const productId = item.productId?._id?.toString() || 
                    (item.productId && typeof item.productId === 'object' ? item.productId._id?.toString() : '') ||
                    '';
                  if (productId) allOrderProductIds.push(productId);
                });
                
                // Also get product IDs from inputs (for products being edited)
                const inputProductIds: string[] = [];
                Array.from(quantityInputs).forEach((input) => {
                  const productId = input.getAttribute('data-product-id');
                  if (productId) inputProductIds.push(productId);
                });
                
                // Combine and deduplicate product IDs
                const allProductIds = [...new Set([...allOrderProductIds, ...inputProductIds])];
                
                if (allProductIds.length > 0) {
                  try {
                    const baseUrl = import.meta.env.VITE_BASE_URL;
                    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
                    const productPromises = allProductIds.map(async (productId: string) => {
                      try {
                        // Backend expects 'id' not 'productId'
                        const response = await api.post(`${baseUrl}/api/${adminRoute}/product/get`, { id: productId });
                        if (response.data?.status === 200 && response.data?.data) {
                          const product = response.data.data;
                          return {
                            productId,
                            stock: product.stock || 0,
                            moq: product.moq || 1,
                            groupCode: product.groupCode || null,
                            totalMoq: product.totalMoq || null
                          };
                        }
                      } catch (error) {
                        console.error(`Error fetching product ${productId}:`, error);
                      }
                      return null;
                    });
                    
                    const productDataArray = await Promise.all(productPromises);
                    productDataArray.forEach((data) => {
                      if (data) {
                        productDataMap.set(data.productId, {
                          stock: data.stock,
                          moq: data.moq,
                          groupCode: data.groupCode,
                          totalMoq: data.totalMoq
                        });
                      }
                    });
                  } catch (error) {
                    console.error('Error fetching product data:', error);
                  }
                }
                
                // Validate each quantity
                Array.from(quantityInputs).forEach((input, index) => {
                  const productId = input.getAttribute('data-product-id') || '';
                  const newQuantity = parseInt(input.value || '0', 10);
                  const moq = parseInt(input.getAttribute('data-moq') || '1', 10);
                  const productData = productDataMap.get(productId);
                  const stock = productData?.stock ?? null;
                  
                  const productName = order.cartItems[index]?.skuFamilyId?.name || 
                    (order.cartItems[index]?.productId && typeof order.cartItems[index].productId === 'object' 
                      ? order.cartItems[index].productId.name : 'Product');
                  
                  // Validate individual MOQ
                  if (isNaN(newQuantity) || newQuantity < moq) {
                    errors.push(`Quantity for "${productName}" must be at least ${moq} (MOQ)`);
                  }
                  
                  // Validate stock availability
                  if (stock !== null && newQuantity > stock) {
                    errors.push(`Insufficient stock for "${productName}". Available: ${stock}, Requested: ${newQuantity}`);
                  }
                });
                
                // Validate total MOQ for groupCode products
                // Check if order is marked as isGroupedOrder OR if any products have groupCode
                // IMPORTANT: Check ALL products in the order that belong to the same groupCode,
                // not just the ones being edited. Use new quantities for edited items, old quantities for others.
                const hasGroupCodeInProducts = Array.from(productDataMap.values()).some(p => p.groupCode && p.groupCode.trim() !== '');
                const shouldValidateTotalMoq = order.isGroupedOrder || hasGroupCodeInProducts;
                
                if (shouldValidateTotalMoq && (productDataMap.size > 0 || order.cartItems.length > 0)) {
                  const itemsByGroup = new Map<string, Array<{ productId: string; quantity: number; productName: string }>>();
                  
                  // Create a map of edited quantities for quick lookup
                  const editedQuantitiesMap = new Map<string, number>();
                  Array.from(quantityInputs).forEach((input) => {
                    const productId = input.getAttribute('data-product-id') || '';
                    const newQuantity = parseInt(input.value || '0', 10);
                    editedQuantitiesMap.set(productId, newQuantity);
                  });
                  
                  // Group ALL order items by groupCode, using new quantities for edited items and old quantities for others
                  order.cartItems.forEach((orderItem) => {
                    const productId = orderItem.productId?._id || 
                      (orderItem.productId && typeof orderItem.productId === 'object' ? orderItem.productId._id : null) || 
                      '';
                    const productIdStr = productId.toString();
                    const productData = productDataMap.get(productIdStr);
                    
                    // Try to get groupCode from productData or from orderItem's populated productId
                    let groupCode: string | null = null;
                    
                    if (productData?.groupCode) {
                      groupCode = productData.groupCode;
                    } else if (orderItem.productId && typeof orderItem.productId === 'object' && 'groupCode' in orderItem.productId) {
                      groupCode = (orderItem.productId as any).groupCode;
                    }
                    
                    if (groupCode) {
                      // Use new quantity if item is being edited, otherwise use old quantity
                      const quantity = editedQuantitiesMap.has(productIdStr) 
                        ? editedQuantitiesMap.get(productIdStr)!
                        : orderItem.quantity;
                      
                      if (!itemsByGroup.has(groupCode)) {
                        itemsByGroup.set(groupCode, []);
                      }
                      const productName = orderItem.skuFamilyId?.name || 
                        (orderItem.productId && typeof orderItem.productId === 'object' ? orderItem.productId.name : 'Product');
                      itemsByGroup.get(groupCode)!.push({
                        productId: productIdStr,
                        quantity: quantity,
                        productName: productName
                      });
                    }
                  });
                  
                  // Validate total MOQ for each group
                  itemsByGroup.forEach((items, groupCode) => {
                    // Get totalMoq from first product in the group (all products in same group should have same totalMoq)
                    const firstItem = items[0];
                    const firstProductData = productDataMap.get(firstItem.productId);
                    let totalMoq = firstProductData?.totalMoq || null;
                    
                    // If not in productDataMap, try to get from order item
                    if (!totalMoq && order.cartItems.length > 0) {
                      const firstOrderItem = order.cartItems.find(item => {
                        const itemProductId = item.productId?._id?.toString() || 
                          (item.productId && typeof item.productId === 'object' ? item.productId._id?.toString() : '');
                        return itemProductId === firstItem.productId;
                      });
                      if (firstOrderItem?.productId && typeof firstOrderItem.productId === 'object' && 'totalMoq' in firstOrderItem.productId) {
                        totalMoq = (firstOrderItem.productId as any).totalMoq;
                      }
                    }
                    
                    if (totalMoq && totalMoq > 0) {
                      const totalGroupQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                      if (totalGroupQuantity < totalMoq) {
                        const remainingQty = totalMoq - totalGroupQuantity;
                        const productNames = items.map(item => item.productName).join(', ');
                        errors.push(`Products in group "${groupCode}" (${productNames}) require a minimum total order quantity (MOQ) of ${totalMoq}. Current total: ${totalGroupQuantity}. You need to add ${remainingQty} more item(s).`);
                      }
                    }
                  });
                }
                
                return { isValid: errors.length === 0, errors };
              };
              
              // Run validation
              const validation = await validateQuantities();
              if (!validation.isValid) {
                throw new Error(validation.errors.join('; '));
              }
              
              editedCartItems = order.cartItems.map((item, index) => {
                const inputValue = quantityInputs[index]?.value;
                const newQuantity = inputValue ? parseInt(inputValue, 10) : item.quantity;
                
                return {
                  ...item,
                  quantity: newQuantity,
                };
              });
            } else {
              // For other statuses, use original cart items (no editing allowed)
              editedCartItems = order.cartItems;
            }

            return true;
          } catch (error: any) {
            console.error('Error in preConfirm:', error);
            const errorMessage = error?.message || error?.toString() || 'An error occurred while processing the form';
            Swal.showValidationMessage(errorMessage);
            return false;
          }
        },
        didOpen: () => {
          try {
            const statusSelect = document.getElementById("statusSelect") as HTMLSelectElement;
            const cartItemsContainer = document.getElementById("cartItemsContainer") as HTMLElement;
            const sendConfirmationContainer = document.getElementById("sendConfirmationContainer") as HTMLElement;
            const newOrderPriceContainer = document.getElementById("newOrderPriceContainer") as HTMLElement;

            // Function to calculate and display new order price
            const calculateNewOrderPrice = () => {
              const quantityInputs = document.querySelectorAll(".quantity-input") as NodeListOf<HTMLInputElement>;
              let newTotal = 0;
              let originalTotal = 0;
              
              quantityInputs.forEach((input) => {
                const price = roundToTwoDecimals(parseFloat(input.getAttribute('data-price') || '0'));
                const newQuantity = parseInt(input.value || '0', 10);
                const originalQuantity = parseInt(input.getAttribute('data-original-quantity') || input.value || '0', 10);
                
                newTotal += roundToTwoDecimals(price * newQuantity);
                originalTotal += roundToTwoDecimals(price * originalQuantity);
              });
              
              // Add otherCharges if present
              const otherChargesInput = document.getElementById("otherChargesInput") as HTMLInputElement;
              const otherCharges = otherChargesInput ? roundToTwoDecimals(parseFloat(otherChargesInput.value) || 0) : roundToTwoDecimals(order.otherCharges || 0);
              newTotal = roundToTwoDecimals(newTotal + otherCharges);
              originalTotal = roundToTwoDecimals(originalTotal + (order.otherCharges || 0));
              
              // Subtract discount if present
              const discountInput = document.getElementById("discountInput") as HTMLInputElement;
              const discount = discountInput ? roundToTwoDecimals(parseFloat(discountInput.value) || 0) : roundToTwoDecimals(order.discount || 0);
              newTotal = roundToTwoDecimals(Math.max(0, newTotal - discount));
              originalTotal = roundToTwoDecimals(Math.max(0, originalTotal - (order.discount || 0)));
              
              if (newOrderPriceContainer) {
                const newOrderTotal = document.getElementById("newOrderTotal") as HTMLElement;
                const originalOrderTotal = document.getElementById("originalOrderTotal") as HTMLElement;
                const orderDifference = document.getElementById("orderDifference") as HTMLElement;
                
                if (newOrderTotal) newOrderTotal.textContent = `$${roundToTwoDecimals(newTotal).toFixed(2)}`;
                if (originalOrderTotal) originalOrderTotal.textContent = `$${roundToTwoDecimals(originalTotal).toFixed(2)}`;
                
                const difference = roundToTwoDecimals(newTotal - originalTotal);
                if (orderDifference) {
                  orderDifference.textContent = `${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}`;
                  orderDifference.style.color = difference >= 0 ? '#DC2626' : '#059669';
                }
                
                // Show container if quantities changed
                const quantitiesChanged = Array.from(quantityInputs).some(input => {
                  const originalQty = parseInt(input.getAttribute('data-original-quantity') || input.value || '0', 10);
                  const newQty = parseInt(input.value || '0', 10);
                  return originalQty !== newQty;
                });
                
                newOrderPriceContainer.style.display = quantitiesChanged ? "block" : "none";
              }
            };

            if (statusSelect && cartItemsContainer) {
              // Store original quantities for comparison
              const quantityInputs = document.querySelectorAll(".quantity-input") as NodeListOf<HTMLInputElement>;
              quantityInputs.forEach((input) => {
                input.setAttribute('data-original-quantity', input.value);
              });
              
              // Validation function to check MOQ, stock, and total MOQ
              const validateQuantities = async (): Promise<{ isValid: boolean; errors: string[] }> => {
                const errors: string[] = [];
                const quantityInputs = document.querySelectorAll(".quantity-input") as NodeListOf<HTMLInputElement>;
                const productDataMap = new Map<string, { stock: number; moq: number; groupCode: string | null; totalMoq: number | null }>();
                
                // First, get ALL product IDs from the order (not just the ones with inputs)
                // This ensures we validate totalMoq for all products in grouped orders
                const allOrderProductIds: string[] = [];
                order.cartItems.forEach((item) => {
                  const productId = item.productId?._id?.toString() || 
                    (item.productId && typeof item.productId === 'object' ? item.productId._id?.toString() : '') ||
                    '';
                  if (productId) allOrderProductIds.push(productId);
                });
                
                // Also get product IDs from inputs (for products being edited)
                const inputProductIds: string[] = [];
                quantityInputs.forEach((input) => {
                  const productId = input.getAttribute('data-product-id');
                  if (productId) inputProductIds.push(productId);
                });
                
                // Combine and deduplicate product IDs
                const allProductIds = [...new Set([...allOrderProductIds, ...inputProductIds])];
                
                // Fetch product details from backend
                if (allProductIds.length > 0) {
                  try {
                    const baseUrl = import.meta.env.VITE_BASE_URL;
                    const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
                    const productPromises = allProductIds.map(async (productId: string) => {
                      try {
                        // Backend expects 'id' not 'productId'
                        const response = await api.post(`${baseUrl}/api/${adminRoute}/product/get`, { id: productId });
                        if (response.data?.status === 200 && response.data?.data) {
                          const product = response.data.data;
                          return {
                            productId,
                            stock: product.stock || 0,
                            moq: product.moq || 1,
                            groupCode: product.groupCode || null,
                            totalMoq: product.totalMoq || null
                          };
                        }
                      } catch (error) {
                        console.error(`Error fetching product ${productId}:`, error);
                      }
                      return null;
                    });
                    
                    const productDataArray = await Promise.all(productPromises);
                    productDataArray.forEach((data: any) => {
                      if (data) {
                        productDataMap.set(data.productId, {
                          stock: data.stock,
                          moq: data.moq,
                          groupCode: data.groupCode,
                          totalMoq: data.totalMoq
                        });
                      }
                    });
                  } catch (error) {
                    console.error('Error fetching product data:', error);
                  }
                }
                
                // Validate each quantity input
                quantityInputs.forEach((input, index) => {
                  const productId = input.getAttribute('data-product-id') || '';
                  const newQuantity = parseInt(input.value || '0', 10);
                  const moq = parseInt(input.getAttribute('data-moq') || '1', 10);
                  const stockAttr = input.getAttribute('data-stock');
                  const stockFromAttr = stockAttr ? parseInt(stockAttr, 10) : null;
                  
                  // Get product data from map or use attributes
                  const productData = productDataMap.get(productId);
                  const stock = productData?.stock ?? stockFromAttr ?? null;
                  
                  const productName = order.cartItems[index]?.skuFamilyId?.name || 
                    (order.cartItems[index]?.productId && typeof order.cartItems[index].productId === 'object' 
                      ? order.cartItems[index].productId.name : 'Product');
                  
                  // Validate individual MOQ
                  if (isNaN(newQuantity) || newQuantity < moq) {
                    errors.push(`Quantity for "${productName}" must be at least ${moq} (MOQ)`);
                    input.style.borderColor = '#EF4444';
                    const validationMsg = input.parentElement?.querySelector('.validation-message') as HTMLElement;
                    if (validationMsg) {
                      validationMsg.textContent = `❌ Minimum order quantity: ${moq}`;
                      validationMsg.style.color = '#DC2626';
                    }
                  } else {
                    input.style.borderColor = '#D1D5DB';
                    const validationMsg = input.parentElement?.querySelector('.validation-message') as HTMLElement;
                    if (validationMsg) {
                      validationMsg.textContent = '';
                    }
                  }
                  
                  // Validate stock availability
                  if (stock !== null && newQuantity > stock) {
                    errors.push(`Insufficient stock for "${productName}". Available: ${stock}, Requested: ${newQuantity}`);
                    input.style.borderColor = '#EF4444';
                    const validationMsg = input.parentElement?.querySelector('.validation-message') as HTMLElement;
                    if (validationMsg) {
                      const existingMsg = validationMsg.textContent || '';
                      validationMsg.textContent = existingMsg ? `${existingMsg} | ❌ Stock: ${stock}` : `❌ Available stock: ${stock}`;
                      validationMsg.style.color = '#DC2626';
                    }
                  }
                });
                
                // Validate total MOQ for groupCode products
                // Check if order is marked as isGroupedOrder OR if any products have groupCode
                // IMPORTANT: Check ALL products in the order that belong to the same groupCode,
                // not just the ones being edited. Use new quantities for edited items, old quantities for others.
                const hasGroupCodeInProducts = Array.from(productDataMap.values()).some(p => p.groupCode && p.groupCode.trim() !== '');
                const shouldValidateTotalMoq = order.isGroupedOrder || hasGroupCodeInProducts;
                
                if (shouldValidateTotalMoq && (productDataMap.size > 0 || order.cartItems.length > 0)) {
                  const itemsByGroup = new Map<string, Array<{ productId: string; quantity: number; productName: string; inputIndex?: number; totalMoq?: number | null }>>();
                  
                  // Create a map of edited quantities for quick lookup
                  const editedQuantitiesMap = new Map<string, number>();
                  quantityInputs.forEach((input) => {
                    const productId = input.getAttribute('data-product-id') || '';
                    const newQuantity = parseInt(input.value || '0', 10);
                    editedQuantitiesMap.set(productId, newQuantity);
                  });
                  
                  // If isGroupedOrder is true, treat ALL products as one group (even without groupCode)
                  if (order.isGroupedOrder) {
                    // Get totalMoq from any product that has it - check all products
                    let totalMoq: number | null = null;
                    const allGroupItems: Array<{ productId: string; quantity: number; productName: string; inputIndex?: number }> = [];
                    
                    // First pass: Collect all products and find totalMoq from any product
                    // Check both populated productId (from order) and fetched productData
                    order.cartItems.forEach((orderItem) => {
                      const productId = orderItem.productId?._id?.toString() || 
                        (orderItem.productId && typeof orderItem.productId === 'object' ? orderItem.productId._id?.toString() : '') || 
                        '';
                      const productData = productDataMap.get(productId);
                      
                      // Get totalMoq from any product that has it (check all products, not just first)
                      // Priority: 1) Fetched productData, 2) Populated productId from order
                      if (!totalMoq) {
                        // First check fetched product data (most up-to-date)
                        if (productData?.totalMoq && productData.totalMoq > 0) {
                          totalMoq = productData.totalMoq;
                        } 
                        // Fallback to populated productId from order
                        else if (orderItem.productId && typeof orderItem.productId === 'object' && 'totalMoq' in orderItem.productId) {
                          const itemTotalMoq = (orderItem.productId as any).totalMoq;
                          if (itemTotalMoq && itemTotalMoq > 0) {
                            totalMoq = itemTotalMoq;
                          }
                        }
                      }
                    });
                    
                    // Second pass: Collect all items with quantities for validation
                    order.cartItems.forEach((orderItem) => {
                      const productId = orderItem.productId?._id?.toString() || 
                        (orderItem.productId && typeof orderItem.productId === 'object' ? orderItem.productId._id?.toString() : '') || 
                        '';
                      
                      // Use new quantity if item is being edited, otherwise use old quantity
                      const quantity = editedQuantitiesMap.has(productId) 
                        ? editedQuantitiesMap.get(productId)!
                        : orderItem.quantity;
                      
                      const productName = orderItem.skuFamilyId?.name || 
                        (orderItem.productId && typeof orderItem.productId === 'object' ? orderItem.productId.name : 'Product');
                      
                      // Find the input index if this product is being edited
                      const inputIndex = Array.from(quantityInputs).findIndex(inp => inp.getAttribute('data-product-id') === productId);
                      
                      allGroupItems.push({
                        productId,
                        quantity: quantity,
                        productName,
                        inputIndex: inputIndex >= 0 ? inputIndex : undefined
                      });
                    });
                    
                    // Validate total MOQ for the entire grouped order
                    if (totalMoq && totalMoq > 0) {
                      const totalGroupQuantity = allGroupItems.reduce((sum, item) => sum + item.quantity, 0);
                      if (totalGroupQuantity < totalMoq) {
                        const remainingQty = totalMoq - totalGroupQuantity;
                        const productNames = allGroupItems.map(item => item.productName).join(', ');
                        errors.push(`This is a grouped order. All products (${productNames}) require a minimum total order quantity (MOQ) of ${totalMoq}. Current total: ${totalGroupQuantity}. You need to add ${remainingQty} more item(s).`);
                        
                        // Highlight all inputs that are being edited
                        allGroupItems.forEach((item) => {
                          if (item.inputIndex !== undefined) {
                            const input = quantityInputs[item.inputIndex];
                            if (input) {
                              input.style.borderColor = '#EF4444';
                              const validationMsg = input.parentElement?.querySelector('.validation-message') as HTMLElement;
                              if (validationMsg) {
                                const existingMsg = validationMsg.textContent || '';
                                validationMsg.textContent = existingMsg ? `${existingMsg} | ❌ Group Total MOQ: ${totalMoq}` : `❌ Group Total MOQ: ${totalMoq} (Current: ${totalGroupQuantity})`;
                                validationMsg.style.color = '#DC2626';
                              }
                            }
                          } else {
                            // Also highlight inputs that might not be in the edited list but are part of the group
                            const input = Array.from(quantityInputs).find(inp => inp.getAttribute('data-product-id') === item.productId);
                            if (input) {
                              input.style.borderColor = '#EF4444';
                              const validationMsg = input.parentElement?.querySelector('.validation-message') as HTMLElement;
                              if (validationMsg) {
                                const existingMsg = validationMsg.textContent || '';
                                validationMsg.textContent = existingMsg ? `${existingMsg} | ❌ Group Total MOQ: ${totalMoq}` : `❌ Group Total MOQ: ${totalMoq} (Current: ${totalGroupQuantity})`;
                                validationMsg.style.color = '#DC2626';
                              }
                            }
                          }
                        });
                      }
                    } else if (order.isGroupedOrder) {
                      // If isGroupedOrder is true but no totalMoq found, log a warning
                      console.warn('Grouped order detected but totalMoq not found in any product. Order ID:', order._id);
                    }
                  } else {
                    // Original logic: Group by groupCode when products have groupCode
                    // Group ALL order items by groupCode, using new quantities for edited items and old quantities for others
                    order.cartItems.forEach((orderItem) => {
                      const productId = orderItem.productId?._id?.toString() || 
                        (orderItem.productId && typeof orderItem.productId === 'object' ? orderItem.productId._id?.toString() : '') || 
                        '';
                      const productData = productDataMap.get(productId);
                      
                      // Try to get groupCode from productData or from orderItem's populated productId
                      let groupCode: string | null = null;
                      
                      if (productData?.groupCode) {
                        groupCode = productData.groupCode;
                      } else if (orderItem.productId && typeof orderItem.productId === 'object' && 'groupCode' in orderItem.productId) {
                        groupCode = (orderItem.productId as any).groupCode;
                      }
                      
                      if (groupCode) {
                        // Use new quantity if item is being edited, otherwise use old quantity
                        const quantity = editedQuantitiesMap.has(productId) 
                          ? editedQuantitiesMap.get(productId)!
                          : orderItem.quantity;
                        
                        if (!itemsByGroup.has(groupCode)) {
                          itemsByGroup.set(groupCode, []);
                        }
                        const productName = orderItem.skuFamilyId?.name || 
                          (orderItem.productId && typeof orderItem.productId === 'object' ? orderItem.productId.name : 'Product');
                        
                        // Find the input index if this product is being edited
                        const inputIndex = Array.from(quantityInputs).findIndex(inp => inp.getAttribute('data-product-id') === productId);
                        
                        itemsByGroup.get(groupCode)!.push({
                          productId,
                          quantity: quantity,
                          productName,
                          inputIndex: inputIndex >= 0 ? inputIndex : undefined
                        });
                      }
                    });
                    
                    // Validate total MOQ for each group
                    itemsByGroup.forEach((items, groupCode) => {
                      // Get totalMoq from first product in the group
                      const firstItem = items[0];
                      const firstProductData = productDataMap.get(firstItem.productId);
                      let totalMoq = firstProductData?.totalMoq || null;
                      
                      // If not in productDataMap, try to get from order item
                      if (!totalMoq && order.cartItems.length > 0) {
                        const firstOrderItem = order.cartItems.find(item => {
                          const itemProductId = item.productId?._id?.toString() || 
                            (item.productId && typeof item.productId === 'object' ? item.productId._id?.toString() : '');
                          return itemProductId === firstItem.productId;
                        });
                        if (firstOrderItem?.productId && typeof firstOrderItem.productId === 'object' && 'totalMoq' in firstOrderItem.productId) {
                          totalMoq = (firstOrderItem.productId as any).totalMoq;
                        }
                      }
                      
                      if (totalMoq && totalMoq > 0) {
                        const totalGroupQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                        if (totalGroupQuantity < totalMoq) {
                          const remainingQty = totalMoq - totalGroupQuantity;
                          const productNames = items.map(item => item.productName).join(', ');
                          errors.push(`Products in group "${groupCode}" (${productNames}) require a minimum total order quantity (MOQ) of ${totalMoq}. Current total: ${totalGroupQuantity}. You need to add ${remainingQty} more item(s).`);
                          
                          // Highlight all inputs in this group that are being edited
                          items.forEach((item) => {
                            if (item.inputIndex !== undefined) {
                              const input = quantityInputs[item.inputIndex];
                              if (input) {
                                input.style.borderColor = '#EF4444';
                                const validationMsg = input.parentElement?.querySelector('.validation-message') as HTMLElement;
                                if (validationMsg) {
                                  const existingMsg = validationMsg.textContent || '';
                                  validationMsg.textContent = existingMsg ? `${existingMsg} | ❌ Group MOQ: ${totalMoq}` : `❌ Group total MOQ: ${totalMoq} (Current: ${totalGroupQuantity})`;
                                  validationMsg.style.color = '#DC2626';
                                }
                              }
                            }
                          });
                        }
                      }
                    });
                  }
                }
                
                return { isValid: errors.length === 0, errors };
              };
              
              // Function to check if quantities changed and show/hide send confirmation button
              const checkAndShowConfirmationButton = async () => {
                if (sendConfirmationContainer) {
                  const statusSelect = document.getElementById("statusSelect") as HTMLSelectElement;
                  const currentModalStatus = statusSelect ? statusSelect.value : currentStatus;
                  
                  // Only show for requested or verify status
                  if (currentModalStatus === "requested" || currentModalStatus === "verify") {
                    const quantitiesChanged = Array.from(quantityInputs).some(input => {
                      const originalQty = parseInt(input.getAttribute('data-original-quantity') || input.value || '0', 10);
                      const newQty = parseInt(input.value || '0', 10);
                      return originalQty !== newQty;
                    });
                    
                    // Validate quantities before enabling button
                    const validation = await validateQuantities();
                    const sendConfirmationBtn = document.getElementById("sendConfirmationBtn") as HTMLButtonElement;
                    
                    // Show button if quantities changed in modal OR quantities were already modified (from previous edit)
                    // AND customer hasn't confirmed yet
                    const shouldShow = (quantitiesChanged || order.quantitiesModified) && !order.isConfirmedByCustomer;
                    sendConfirmationContainer.style.display = shouldShow ? "block" : "none";
                    
                    // Enable/disable button based on validation
                    if (sendConfirmationBtn && shouldShow) {
                      if (validation.isValid) {
                        sendConfirmationBtn.disabled = false;
                        sendConfirmationBtn.style.opacity = '1';
                        sendConfirmationBtn.style.cursor = 'pointer';
                        sendConfirmationBtn.style.backgroundColor = '#F59E0B';
                      } else {
                        sendConfirmationBtn.disabled = true;
                        sendConfirmationBtn.style.opacity = '0.6';
                        sendConfirmationBtn.style.cursor = 'not-allowed';
                        sendConfirmationBtn.style.backgroundColor = '#9CA3AF';
                      }
                    }
                  } else {
                    sendConfirmationContainer.style.display = "none";
                  }
                }
              };
              
              // Set initial visibility based on current status - allow editing only in REQUESTED stage
              if (cartItemsContainer) {
                const allowByStatus = currentStatus === "requested";
                cartItemsContainer.style.display = canEditOrder && allowByStatus ? "block" : "none";
              }
              
              // Set initial visibility for payment method container - show when status is waiting_for_payment
              const paymentMethodContainer = document.getElementById("paymentMethodContainer") as HTMLElement;
              const paymentMethodSelect = document.getElementById("paymentMethodSelect") as HTMLSelectElement;
              
              // Function to fetch and populate payment methods
              const fetchAndPopulatePaymentMethods = async () => {
                if (!paymentMethodSelect) return;
                
                // Show loading state
                paymentMethodSelect.disabled = true;
                paymentMethodSelect.innerHTML = '<option value="">Loading payment methods...</option>';
                
                try {
                  // Call backend to get available payment methods
                  // Backend will return availablePaymentMethods when status is waiting_for_payment without paymentMethod
                  const baseUrl = import.meta.env.VITE_BASE_URL;
                  const adminRoute = import.meta.env.VITE_ADMIN_ROUTE;
                  const url = `${baseUrl}/api/${adminRoute}/order/update-status`;
                  
                  const formData = new FormData();
                  formData.append('orderId', order._id);
                  formData.append('status', 'waiting_for_payment');
                  // Don't include paymentMethod - this will make backend return available methods without updating status
                  
                  try {
                    const response = await api.post(url, formData);
                    
                    // Check if backend returned available payment methods
                    if (response.data && response.data.data && response.data.data.availablePaymentMethods) {
                      availablePaymentMethods = response.data.data.availablePaymentMethods;
                    } else if (response.data && response.data.availablePaymentMethods) {
                      availablePaymentMethods = response.data.availablePaymentMethods;
                    } else {
                      // Fallback: use default payment methods
                      availablePaymentMethods = ['Cash', 'TT', 'ThirdParty'];
                    }
                  } catch (error: any) {
                    console.error('Error fetching payment methods:', error);
                    // Check if error response contains payment methods
                    if (error?.response?.data?.data?.availablePaymentMethods) {
                      availablePaymentMethods = error.response.data.data.availablePaymentMethods;
                    } else if (error?.response?.data?.availablePaymentMethods) {
                      availablePaymentMethods = error.response.data.availablePaymentMethods;
                    } else {
                      // Fallback: use default payment methods
                      availablePaymentMethods = ['Cash', 'TT', 'ThirdParty'];
                    }
                  }
                } catch (error: any) {
                  console.error('Error fetching payment methods:', error);
                  // Fallback: use default payment methods
                  availablePaymentMethods = ['Cash', 'TT', 'ThirdParty'];
                }
                
                // Populate dropdown
                paymentMethodSelect.innerHTML = '<option value="">Select Payment Method</option>';
                availablePaymentMethods.forEach((method: string) => {
                  const option = document.createElement('option');
                  option.value = method;
                  option.textContent = method;
                  if (order.adminSelectedPaymentMethod === method) {
                    option.selected = true;
                  }
                  paymentMethodSelect.appendChild(option);
                });
                
                paymentMethodSelect.disabled = false;
              };
              
              // Function to show/hide payment method container
              const updatePaymentMethodVisibility = () => {
                if (paymentMethodContainer && statusSelect) {
                  const currentModalStatus = statusSelect.value;
                  if (currentModalStatus === 'waiting_for_payment') {
                    paymentMethodContainer.style.display = 'block';
                    // Fetch payment methods when showing
                    fetchAndPopulatePaymentMethods();
                  } else {
                    paymentMethodContainer.style.display = 'none';
                  }
                }
              };
              
              // Set initial visibility
              if (paymentMethodContainer) {
                updatePaymentMethodVisibility();
              }
              
              // Add event listener to status select to show/hide payment method
              if (statusSelect) {
                statusSelect.addEventListener('change', updatePaymentMethodVisibility);
              }
              
              // Set initial visibility for discount container - only before waiting_for_payment
              const discountContainer = document.getElementById("discountContainer") as HTMLElement;
              if (discountContainer) {
                const waitingForPaymentIndex = orderStages.indexOf('waiting_for_payment');
                const currentStatusIndex = orderStages.indexOf(currentStatus);
                const canShowDiscount = (waitingForPaymentIndex !== -1 && 
                  currentStatusIndex !== -1 && currentStatusIndex < waitingForPaymentIndex);
                discountContainer.style.display = canShowDiscount ? "block" : "none";
              }
              
              // Show/hide send confirmation container based on status and quantities modified
              // Initial check - will be updated dynamically when quantities change
              checkAndShowConfirmationButton();
              
              // Handle send confirmation button click
              const sendConfirmationBtn = document.getElementById("sendConfirmationBtn") as HTMLButtonElement;
              if (sendConfirmationBtn) {
                sendConfirmationBtn.addEventListener("click", async () => {
                  try {
                    // First, validate quantities (MOQ, stock, and totalMOQ) before proceeding
                    const validation = await validateQuantities();
                    if (!validation.isValid) {
                      const errorMessage = validation.errors.join('\n');
                      toastHelper.showTost(errorMessage, 'error');
                      // Show validation errors in a more detailed way
                      await Swal.fire({
                        icon: 'error',
                        title: 'Validation Failed',
                        html: `<div style="text-align: left;"><strong>Please fix the following issues before sending the confirmation email:</strong><br/><br/>${validation.errors.map(err => `• ${err}`).join('<br/>')}</div>`,
                        confirmButtonText: 'OK',
                        width: '600px'
                      });
                      return;
                    }
                    
                    // First, save the order with modified quantities if any changes were made
                    const quantityInputs = document.querySelectorAll(".quantity-input") as NodeListOf<HTMLInputElement>;
                    const otherChargesInput = document.getElementById("otherChargesInput") as HTMLInputElement;
                    
                    // Check if quantities were changed
                    const quantitiesChanged = Array.from(quantityInputs).some(input => {
                      const originalQty = parseInt(input.getAttribute('data-original-quantity') || input.value || '0', 10);
                      const newQty = parseInt(input.value || '0', 10);
                      return originalQty !== newQty;
                    });
                    
                    // Get other charges value
                    const otherChargesValue = otherChargesInput ? (parseFloat(otherChargesInput.value) || 0) : (order.otherCharges || 0);
                    const otherChargesChanged = otherChargesValue !== (order.otherCharges || 0);
                    
                    // If quantities or other charges were modified, save the order first
                    if (quantitiesChanged || otherChargesChanged) {
                      // Prepare edited cart items
                      const editedCartItems = order.cartItems.map((item, index) => {
                        const inputValue = quantityInputs[index]?.value;
                        const newQuantity = inputValue ? parseInt(inputValue, 10) : item.quantity;
                        return {
                          ...item,
                          quantity: newQuantity,
                        };
                      });
                      
                      // Save the order with updated quantities and other charges
                      // The backend will also validate MOQ, stock, and totalMOQ
                      await AdminOrderService.updateOrderStatus(
                        order._id,
                        order.status, // Keep current status
                        editedCartItems,
                        undefined, // No message
                        undefined, // No payment method
                        otherChargesValue > 0 ? otherChargesValue : undefined,
                        undefined // No images
                      );
                      
                      // Wait a bit for the order to be saved
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    // Now send the confirmation email (order is already saved with new values)
                    await AdminOrderService.resendModificationConfirmation(order._id);
                    toastHelper.showTost(
                      order.modificationConfirmationToken 
                        ? 'Order updated and confirmation email resent successfully!' 
                        : 'Order updated and confirmation email sent successfully!',
                      'success'
                    );
                    // Close modal and refresh orders
                    Swal.close();
                    fetchOrders();
                  } catch (error: any) {
                    console.error('Error sending confirmation email:', error);
                    const errorMessage = error?.response?.data?.message || error?.message || 'Failed to send confirmation email';
                    toastHelper.showTost(errorMessage, 'error');
                  }
                });
              }
              
              // Add event listeners to quantity inputs for price calculation and confirmation button
              quantityInputs.forEach((input) => {
                input.addEventListener("input", async (e) => {
                  const target = e.target as HTMLInputElement;
                  const filteredValue = handleNumericInput(target.value, false, false);
                  target.value = filteredValue;
                  calculateNewOrderPrice();
                  // Validate and update button state
                  await checkAndShowConfirmationButton();
                });
                input.addEventListener("change", async () => {
                  calculateNewOrderPrice();
                  // Validate and update button state
                  await checkAndShowConfirmationButton();
                });
              });
              
              // Add event listener to otherCharges input
              const otherChargesInput = document.getElementById("otherChargesInput") as HTMLInputElement;
              if (otherChargesInput) {
                otherChargesInput.addEventListener("input", (e) => {
                  const target = e.target as HTMLInputElement;
                  const filteredValue = handleNumericInput(target.value, true, false);
                  target.value = filteredValue;
                  calculateNewOrderPrice();
                });
                otherChargesInput.addEventListener("change", calculateNewOrderPrice);
              }
              // Add event listener to discount input
              const discountInput = document.getElementById("discountInput") as HTMLInputElement;
              if (discountInput) {
                discountInput.addEventListener("input", (e) => {
                  const target = e.target as HTMLInputElement;
                  const filteredValue = handleNumericInput(target.value, true, false);
                  target.value = filteredValue;
                  calculateNewOrderPrice();
                });
                discountInput.addEventListener("change", calculateNewOrderPrice);
              }
              
              statusSelect.addEventListener("change", () => {
                const newStatus = statusSelect.value;
                // Show cart items editing only for REQUESTED status
                if (cartItemsContainer) {
                  const allowByStatus = newStatus === "requested";
                  cartItemsContainer.style.display = canEditOrder && allowByStatus ? "block" : "none";
                }
                
                // Show/hide send confirmation container - check dynamically
                checkAndShowConfirmationButton();
                
                // Show/hide otherCharges based on stage
                const otherChargesContainer = document.getElementById("otherChargesContainer") as HTMLElement;
                if (otherChargesContainer) {
                  const waitingForPaymentIndex = orderStages.indexOf('waiting_for_payment');
                  const newStatusIndex = orderStages.indexOf(newStatus);
                  if (waitingForPaymentIndex !== -1 && newStatusIndex >= waitingForPaymentIndex) {
                    otherChargesContainer.style.display = "none";
                  } else {
                    otherChargesContainer.style.display = "block";
                  }
                }
                // Show/hide discount container - only before waiting_for_payment
                const discountContainer = document.getElementById("discountContainer") as HTMLElement;
                if (discountContainer) {
                  const waitingForPaymentIndex = orderStages.indexOf('waiting_for_payment');
                  const newStatusIndex = orderStages.indexOf(newStatus);
                  const currentStatusIndex = orderStages.indexOf(currentStatus);
                  // Show discount only if current or new status is before waiting_for_payment
                  const canShowDiscount = (waitingForPaymentIndex !== -1 && 
                    ((newStatusIndex !== -1 && newStatusIndex < waitingForPaymentIndex) ||
                     (currentStatusIndex !== -1 && currentStatusIndex < waitingForPaymentIndex)));
                  discountContainer.style.display = canShowDiscount ? "block" : "none";
                }
                // Show/hide delivered warning and OTP container
                // Only show warning if status is "delivered" but OTP is not yet verified
                const deliveredWarningContainer = document.getElementById("deliveredWarningContainer") as HTMLElement;
                if (deliveredWarningContainer) {
                  const shouldShowWarning = newStatus === "delivered" && !order.deliveryOTPVerified;
                  deliveredWarningContainer.style.display = shouldShowWarning ? "block" : "none";
                }
                
                // Update OTP container visibility when status changes
                // Only show OTP container if status is "delivered" but OTP is not yet verified
                const otpContainer = document.getElementById("otpContainer") as HTMLElement;
                if (otpContainer) {
                  const shouldShowOTP = newStatus === "delivered" && 
                                        order.receiverDetails?.mobile && 
                                        !order.deliveryOTPVerified;
                  otpContainer.style.display = shouldShowOTP ? "block" : "none";
                }
              });
              
              // Set initial visibility for delivered warning and OTP container
              // Only show warning if status is "delivered" but OTP is not yet verified
              const deliveredWarningContainer = document.getElementById("deliveredWarningContainer") as HTMLElement;
              if (deliveredWarningContainer) {
                const shouldShowWarning = currentStatus === "delivered" && !order.deliveryOTPVerified;
                deliveredWarningContainer.style.display = shouldShowWarning ? "block" : "none";
              }
              
              // Set initial visibility for OTP container
              // Only show OTP container if status is "delivered" but OTP is not yet verified
              // If status is already "delivered" and OTP is verified, don't show the container
              const otpContainer = document.getElementById("otpContainer") as HTMLElement;
              if (otpContainer) {
                const shouldShowOTP = currentStatus === "delivered" && 
                                      order.receiverDetails?.mobile && 
                                      !order.deliveryOTPVerified;
                otpContainer.style.display = shouldShowOTP ? "block" : "none";
              }

              // Handle OTP send button click
              const sendOTPBtn = document.getElementById("sendOTPBtn") as HTMLButtonElement;
              if (sendOTPBtn) {
                sendOTPBtn.addEventListener("click", async () => {
                  try {
                    sendOTPBtn.disabled = true;
                    sendOTPBtn.style.opacity = '0.6';
                    sendOTPBtn.style.cursor = 'not-allowed';
                    
                    await AdminOrderService.sendDeliveryOTP(order._id);
                    toastHelper.showTost('OTP sent successfully!', 'success');
                    
                    // Refresh orders to get updated OTP status
                    await fetchOrders();
                    
                    // Get updated order from the refreshed list using search by order ID
                    const updatedOrdersResponse = await AdminOrderService.getOrderList(1, 100, order._id);
                    const updatedOrder = updatedOrdersResponse?.data?.docs?.find((o: Order) => o._id === order._id);
                    
                    if (updatedOrder) {
                      // Check if order status is already "delivered" - if so, don't reopen modal
                      if (updatedOrder.status === 'delivered' && updatedOrder.deliveryOTPVerified) {
                        // Order is already delivered and OTP verified, just close modal and refresh
                        Swal.close();
                        fetchOrders();
                      } else {
                        // Close current modal and reopen with updated order
                        Swal.close();
                        setTimeout(() => {
                          handleUpdateStatus(updatedOrder);
                        }, 300);
                      }
                    } else {
                      // If order not found, just refresh
                      Swal.close();
                      fetchOrders();
                    }
                  } catch (error: any) {
                    console.error('Error sending OTP:', error);
                    const errorMessage = error?.response?.data?.message || error?.message || 'Failed to send OTP';
                    toastHelper.showTost(errorMessage, 'error');
                    if (sendOTPBtn) {
                      sendOTPBtn.disabled = false;
                      sendOTPBtn.style.opacity = '1';
                      sendOTPBtn.style.cursor = 'pointer';
                    }
                  }
                });
              }

              // Handle OTP verify button click
              const verifyOTPBtn = document.getElementById("verifyOTPBtn") as HTMLButtonElement;
              if (verifyOTPBtn) {
                verifyOTPBtn.addEventListener("click", async () => {
                  try {
                    const otpInput = document.getElementById("otpInput") as HTMLInputElement;
                    const otp = otpInput?.value?.trim();
                    
                    if (!otp) {
                      toastHelper.showTost('Please enter the OTP', 'error');
                      return;
                    }
                    
                    if (!/^\d{6}$/.test(otp)) {
                      toastHelper.showTost('OTP must be 6 digits', 'error');
                      return;
                    }

                    verifyOTPBtn.disabled = true;
                    verifyOTPBtn.style.opacity = '0.6';
                    verifyOTPBtn.style.cursor = 'not-allowed';
                    
                    const verifyResponse = await AdminOrderService.verifyDeliveryOTP(order._id, otp);
                    toastHelper.showTost('OTP verified successfully!', 'success');
                    
                    // Refresh orders to get updated OTP status
                    await fetchOrders();
                    
                    // Get updated order from the refreshed list using search by order ID
                    const updatedOrdersResponse = await AdminOrderService.getOrderList(1, 100, order._id);
                    const updatedOrder = updatedOrdersResponse?.data?.docs?.find((o: Order) => o._id === order._id);
                    
                    if (updatedOrder) {
                      // Check if order status is already "delivered" - if so, don't reopen modal
                      if (updatedOrder.status === 'delivered') {
                        // Order status was automatically changed to delivered, just close modal and refresh
                        Swal.close();
                        toastHelper.showTost('Order status has been automatically changed to delivered!', 'success');
                        fetchOrders();
                      } else {
                        // Close current modal and reopen with updated order (status not yet delivered)
                        Swal.close();
                        setTimeout(() => {
                          handleUpdateStatus(updatedOrder);
                        }, 300);
                      }
                    } else {
                      // If order not found, just refresh
                      Swal.close();
                      fetchOrders();
                    }
                  } catch (error: any) {
                    console.error('Error verifying OTP:', error);
                    const errorMessage = error?.response?.data?.message || error?.message || 'Failed to verify OTP';
                    toastHelper.showTost(errorMessage, 'error');
                    if (verifyOTPBtn) {
                      verifyOTPBtn.disabled = false;
                      verifyOTPBtn.style.opacity = '1';
                      verifyOTPBtn.style.cursor = 'pointer';
                    }
                  }
                });
              }

              // Handle OTP resend button click
              const resendOTPBtn = document.getElementById("resendOTPBtn") as HTMLButtonElement;
              if (resendOTPBtn) {
                resendOTPBtn.addEventListener("click", async () => {
                  try {
                    resendOTPBtn.disabled = true;
                    resendOTPBtn.style.opacity = '0.6';
                    resendOTPBtn.style.cursor = 'not-allowed';
                    
                    await AdminOrderService.sendDeliveryOTP(order._id);
                    toastHelper.showTost('OTP resent successfully!', 'success');
                    
                    // Refresh orders to get updated OTP status
                    await fetchOrders();
                    
                    // Get updated order from the refreshed list using search by order ID
                    const updatedOrdersResponse = await AdminOrderService.getOrderList(1, 100, order._id);
                    const updatedOrder = updatedOrdersResponse?.data?.docs?.find((o: Order) => o._id === order._id);
                    
                    if (updatedOrder) {
                      // Check if order status is already "delivered" - if so, don't reopen modal
                      if (updatedOrder.status === 'delivered' && updatedOrder.deliveryOTPVerified) {
                        // Order is already delivered and OTP verified, just close modal and refresh
                        Swal.close();
                        fetchOrders();
                      } else {
                        // Close current modal and reopen with updated order
                        Swal.close();
                        setTimeout(() => {
                          handleUpdateStatus(updatedOrder);
                        }, 300);
                      }
                    } else {
                      // If order not found, just refresh
                      Swal.close();
                      fetchOrders();
                    }
                  } catch (error: any) {
                    console.error('Error resending OTP:', error);
                    const errorMessage = error?.response?.data?.message || error?.message || 'Failed to resend OTP';
                    toastHelper.showTost(errorMessage, 'error');
                    if (resendOTPBtn) {
                      resendOTPBtn.disabled = false;
                      resendOTPBtn.style.opacity = '1';
                      resendOTPBtn.style.cursor = 'pointer';
                    }
                  }
                });
              }

              // Add focus styles for inputs
              const inputs = document.querySelectorAll("input, select, textarea");
              inputs.forEach((input) => {
                input.addEventListener("focus", () => {
                  (input as HTMLElement).style.borderColor = "#3B82F6";
                  (input as HTMLElement).style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                });
                input.addEventListener("blur", () => {
                  (input as HTMLElement).style.borderColor = "#D1D5DB";
                  (input as HTMLElement).style.boxShadow = "none";
                });
              });
            }
          } catch (error) {
            console.error('Error in didOpen:', error);
          }
        },
      });

      if (result.isConfirmed) {
        // Check if status actually changed
        if (selectedStatus === currentStatus && !message) {
          toastHelper.showTost("No changes made to the order status", "info");
          return;
        }

        try {
          // Don't send cart items for cancelled status
          // Allow editing only when status is REQUESTED
          // Cart items editing allowed only for REQUESTED status
          // Send edited cart items when status is REQUESTED
          const cartItemsToSend = selectedStatus === "requested" && editedCartItems ? editedCartItems : undefined;

          console.log('Updating order status:', {
            orderId: order._id,
            selectedStatus,
            cartItemsToSend,
            message
          });

          const response = await AdminOrderService.updateOrderStatus(
            order._id,
            selectedStatus,
            cartItemsToSend,
            message || undefined,
            selectedPaymentMethod, // Payment method for waiting_for_payment status
            selectedOtherCharges !== null ? selectedOtherCharges : undefined,
            selectedImages.length > 0 ? selectedImages : undefined,
            selectedDiscount !== null ? selectedDiscount : undefined
          );
          
          // Check if backend requires payment method selection
          if (response && response.data && response.data.requiresPaymentMethodSelection) {
            // Backend returned available payment methods - show error and don't close modal
            availablePaymentMethods = response.data.availablePaymentMethods || [];
            Swal.showValidationMessage('Please select a payment method before proceeding');
            return; // Don't proceed, let user select payment method
          }

          console.log('Update response:', response);

          if (response !== false) {
            // Success message is already shown in the service
            fetchOrders();
            Swal.close(); // Close the modal on success
          } else {
            // Error message is already shown in the service
            throw new Error('Failed to update order status');
          }
        } catch (error: any) {
          console.error("Failed to update order status:", error);
          const errorMessage = error?.response?.data?.message || error?.message || "Failed to update order status";
          toastHelper.showTost(errorMessage, "error");
          // Don't close the modal on error so user can retry
        }
      }
    } catch (error) {
      console.error("Error in handleUpdateStatus:", error);
      toastHelper.showTost("Failed to open status update modal", "error");
    }
  };

  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  // Removed unused functions - these are now handled in OrderDetailsModal:
  // - handleSendConfirmation (confirmation email)
  // - handleSendDeliveryOTP (OTP sending)
  // - handleVerifyDeliveryOTP (OTP verification)

  const handleViewTracking = async (orderId: string, initialPage: number = 1) => {
    try {
      const limit = 10; // Items per page
      let currentPage = initialPage;
      
      const loadTrackingPage = async (page: number): Promise<{ html: string; pagination: any } | null> => {
        const response = await AdminOrderService.getOrderTracking(orderId, page, limit);
        const trackingData = response.data;
        const trackingItems: TrackingItem[] = trackingData.docs || [];

        if (trackingItems.length === 0 && page === 1) {
          await Swal.fire({
            title: "No Tracking Information",
            text: "No tracking details are available for this order.",
            icon: "info",
            confirmButtonText: "OK",
          });
          return null;
        }

        const baseUrl = import.meta.env.VITE_BASE_URL || '';
        
        // Build pagination controls HTML
        const paginationHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 12px; background-color: #f9fafb; border-radius: 4px; border: 1px solid #e5e7eb;">
            <div style="font-size: 14px; color: #6b7280; font-weight: 500;">
              Showing ${((trackingData.page - 1) * trackingData.limit) + 1} to ${Math.min(trackingData.page * trackingData.limit, trackingData.totalDocs)} of ${trackingData.totalDocs} entries
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button id="prevPageBtn" 
                      style="padding: 6px 12px; background-color: ${!trackingData.hasPrevPage ? '#d1d5db' : '#3b82f6'}; color: white; border: none; border-radius: 4px; cursor: ${!trackingData.hasPrevPage ? 'not-allowed' : 'pointer'}; font-size: 14px;"
                      ${!trackingData.hasPrevPage ? 'disabled' : ''}>
                Previous
              </button>
              <span style="font-size: 14px; color: #374151; padding: 0 12px; font-weight: 500;">
                Page ${trackingData.page} of ${trackingData.totalPages}
              </span>
              <button id="nextPageBtn"
                      style="padding: 6px 12px; background-color: ${!trackingData.hasNextPage ? '#d1d5db' : '#3b82f6'}; color: white; border: none; border-radius: 4px; cursor: ${!trackingData.hasNextPage ? 'not-allowed' : 'pointer'}; font-size: 14px;"
                      ${!trackingData.hasNextPage ? 'disabled' : ''}>
                Next
              </button>
            </div>
          </div>
        `;

        const trackingHtml = `
          <div style="text-align: left;">
            <h3 style="margin-bottom: 16px; color: #1f2937;">Tracking Details for Order ${orderId}</h3>
            <div style="max-height: 500px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead style="position: sticky; top: 0; background-color: #f4f4f4; z-index: 10;">
                  <tr>
                    <th style="padding: 10px; border: 1px solid #ddd; background-color: #f9fafb; font-weight: 600;">Status</th>
                    <th style="padding: 10px; border: 1px solid #ddd; background-color: #f9fafb; font-weight: 600;">Changed By</th>
                    <th style="padding: 10px; border: 1px solid #ddd; background-color: #f9fafb; font-weight: 600;">User Type</th>
                    <th style="padding: 10px; border: 1px solid #ddd; background-color: #f9fafb; font-weight: 600;">Changed At</th>
                    <th style="padding: 10px; border: 1px solid #ddd; background-color: #f9fafb; font-weight: 600;">Message</th>
                    <th style="padding: 10px; border: 1px solid #ddd; background-color: #f9fafb; font-weight: 600;">Images</th>
                  </tr>
                </thead>
                <tbody>
                  ${trackingItems
                    .map(
                      (item) => {
                        // Ensure images is an array
                        const images = Array.isArray(item.images) ? item.images : (item.images ? [item.images] : []);
                        
                        return `
                        <tr>
                          <td style="padding: 8px; border: 1px solid #ddd;">
                            ${item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_/g, ' ')}
                          </td>
                          <td style="padding: 8px; border: 1px solid #ddd;">
                            ${item?.changedBy?.name || "-"}
                          </td>
                          <td style="padding: 8px; border: 1px solid #ddd;">
                            ${item.userType}
                          </td>
                          <td style="padding: 8px; border: 1px solid #ddd;">
                            ${format(new Date(item.changedAt), "yyyy-MM-dd HH:mm")}
                          </td>
                          <td style="padding: 8px; border: 1px solid #ddd;">
                            ${item.message || "-"}
                          </td>
                          <td style="padding: 8px; border: 1px solid #ddd;">
                            ${images.length > 0 
                              ? images.map((img: string, idx: number) => {
                                  // Ensure image path is correct - handle both relative and absolute paths
                                  let imageUrl = img;
                                  if (!img || typeof img !== 'string') {
                                    console.warn('Invalid image path:', img);
                                    return '';
                                  }
                                  
                                  // Normalize the path
                                  if (!img.startsWith('http')) {
                                    // If path starts with uploads/, prepend /
                                    if (img.startsWith('uploads/')) {
                                      imageUrl = `/${img}`;
                                    } else if (!img.startsWith('/')) {
                                      // If path doesn't start with /, prepend /uploads/
                                      imageUrl = `/uploads/${img}`;
                                    } else {
                                      imageUrl = img;
                                    }
                                  }
                                  
                                  // Construct full URL
                                  const fullImageUrl = imageUrl.startsWith('http') 
                                    ? imageUrl 
                                    : `${baseUrl}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
                                  
                                  return `<a href="${fullImageUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-right: 8px; margin-bottom: 4px;">
                                    <img src="${fullImageUrl}" alt="Image ${idx + 1}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; cursor: pointer;" 
                                         onerror="this.onerror=null; this.src='https://via.placeholder.com/50?text=Error'; console.error('Image failed to load:', '${fullImageUrl}');" />
                                  </a>`;
                                }).filter(img => img !== '').join('')
                              : "-"}
                          </td>
                        </tr>
                      `;
                      }
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            ${paginationHtml}
          </div>
        `;

        return { html: trackingHtml, pagination: trackingData };
      };

      // Load initial page
      const initialData = await loadTrackingPage(currentPage);
      if (!initialData) return;

      // Show modal with pagination
      let currentPagination = initialData.pagination;

      const showTrackingModal = async (page: number) => {
        const pageData = await loadTrackingPage(page);
        if (!pageData) return;

        currentPagination = pageData.pagination;

        await Swal.fire({
          title: "Order Tracking",
          html: pageData.html,
          width: 950,
          showConfirmButton: true,
          confirmButtonText: "Close",
          didOpen: () => {
            // Add event listeners for pagination buttons
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');

            if (prevBtn && currentPagination.hasPrevPage) {
              prevBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (currentPagination.hasPrevPage) {
                  Swal.close();
                  await showTrackingModal(currentPagination.prevPage || 1);
                }
              };
            }

            if (nextBtn && currentPagination.hasNextPage) {
              nextBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (currentPagination.hasNextPage) {
                  Swal.close();
                  await showTrackingModal(currentPagination.nextPage || 1);
                }
              };
            }
          }
        });
      };

      await showTrackingModal(currentPage);

    } catch (error) {
      console.error("Failed to fetch tracking:", error);
      toastHelper.showTost("Failed to fetch tracking details", "error");
    }
  };

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

  // Check if an order is fully paid
  const checkIfOrderFullyPaid = async (order: Order) => {
    try {
      // Check paymentIds (array of ObjectIds)
      const paymentIds = Array.isArray(order.paymentIds) 
        ? order.paymentIds 
        : order.paymentIds 
          ? [order.paymentIds] 
          : [];

      console.log(`Checking payments for order ${order._id}, paymentIds:`, order.paymentIds, 'resolved paymentIds:', paymentIds);

      // If no payment IDs, check by orderId
      if (paymentIds.length === 0) {
        console.log(`No payment IDs found for order ${order._id}, checking by orderId`);
        // Fetch all payments for this order by orderId
        const paymentsResponse = await OrderPaymentService.listPayments(
          1,
          100,
          order._id,
          undefined,
          undefined
        );
        const payments = paymentsResponse?.data?.docs || [];
        
        if (payments.length === 0) {
          console.log(`No payments found for order ${order._id}`);
          return false;
        }

        return checkPaymentsStatus(payments, order);
      }

      // Fetch payments by their IDs
      const paymentsPromises = paymentIds.map((paymentId: string) => 
        OrderPaymentService.getPayment(paymentId)
          .then((res: any) => res?.data?.data || res?.data || null)
          .catch(() => null)
      );
      
      const payments = (await Promise.all(paymentsPromises))
        .filter((payment: any) => payment !== null);

      console.log(`Found ${payments.length} payments for order ${order._id} by IDs:`, payments.map((p: any) => ({ id: p._id, status: p.status, amount: p.amount, calculatedAmount: p.calculatedAmount })));

      if (payments.length === 0) {
        console.log(`No payments found for order ${order._id} by payment IDs`);
        return false;
      }

      return checkPaymentsStatus(payments, order);
    } catch (error) {
      console.error(`Error checking if order ${order._id} is fully paid:`, error);
      return false;
    }
  };

  // Helper function to check payments status and amounts
  const checkPaymentsStatus = (payments: any[], order: Order): boolean => {
    // Check if all payments are paid
    const allPaid = payments.every((payment: any) => payment.status === 'paid');
    console.log(`All payments paid for order ${order._id}:`, allPaid);
    if (!allPaid) {
      return false;
    }

    // Calculate total paid amount
    const totalPaid = payments.reduce((sum: number, payment: any) => {
      // Use calculatedAmount if available, otherwise use amount
      const paymentAmount = payment.calculatedAmount || payment.amount || 0;
      const amountValue = typeof paymentAmount === 'number' ? paymentAmount : parseFloat(String(paymentAmount)) || 0;
      console.log(`Payment ${payment._id}: amount=${paymentAmount}, amountValue=${amountValue}`);
      return sum + amountValue;
    }, 0);

    // Compare with order total amount (with tolerance for floating point)
    const orderTotal = typeof order.totalAmount === 'number' ? order.totalAmount : parseFloat(String(order.totalAmount || '0'));
    const isFullyPaid = Math.abs(totalPaid - orderTotal) < 0.01; // Tolerance of 1 cent

    console.log(`Order ${order._id}: totalPaid=${totalPaid}, orderTotal=${orderTotal}, difference=${Math.abs(totalPaid - orderTotal)}, isFullyPaid=${isFullyPaid}`);

    return isFullyPaid;
  };

  // Check all orders for fully paid status
  useEffect(() => {
    const checkFullyPaidOrders = async () => {
      const paidOrderIds = new Set<string>();
      
      console.log('Checking fully paid orders, total orders:', ordersData?.length || 0);
      
      // Check all orders, not just those with paymentIds
      // This ensures we check orders even if paymentIds field is not populated
      if (!ordersData || !Array.isArray(ordersData)) {
        return;
      }
      for (const order of ordersData) {
        console.log(`Checking order ${order._id}, paymentIds:`, order.paymentIds);
        const isFullyPaid = await checkIfOrderFullyPaid(order);
        console.log(`Order ${order._id} is fully paid:`, isFullyPaid);
        if (isFullyPaid) {
          paidOrderIds.add(order._id);
        }
      }
      
      console.log('Fully paid order IDs:', Array.from(paidOrderIds));
      setFullyPaidOrders(paidOrderIds);
    };

    if (ordersData && ordersData.length > 0) {
      checkFullyPaidOrders();
    } else {
      setFullyPaidOrders(new Set());
    }
  }, [ordersData]);

  // Combined status function that merges status and verification into one message
  const getCombinedStatusBadge = (order: Order) => {
    const status = order.status?.toLowerCase() || 'request';
    const orderTrackingStatus = order.orderTrackingStatus?.toLowerCase();

    // Handle cancellation flow
    if (orderTrackingStatus === "cancel" && status === "cancel") {
      return {
        message: "Cancelled",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
        dotColor: "bg-red-500",
      };
    }
    if (orderTrackingStatus === "verified" && status === "cancel") {
      return {
        message: "Cancelled",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
        dotColor: "bg-red-500",
      };
    }

    // Handle different status combinations
    let statusMessage = "";
    let bgColor = "";
    let textColor = "";
    let borderColor = "";
    let dotColor = "";

    switch (status) {
      case "requested":
        statusMessage = "Requested";
        bgColor = "bg-yellow-50";
        textColor = "text-yellow-700";
        borderColor = "border-yellow-200";
        dotColor = "bg-yellow-500";
        break;

      case "rejected":
        statusMessage = "Rejected";
        bgColor = "bg-red-50";
        textColor = "text-red-700";
        borderColor = "border-red-200";
        dotColor = "bg-red-500";
        break;

      case "verify":
        statusMessage = "Verify";
        bgColor = "bg-blue-50";
        textColor = "text-blue-700";
        borderColor = "border-blue-200";
        dotColor = "bg-blue-500";
        break;

      case "approved":
        statusMessage = "Approved";
        bgColor = "bg-indigo-50";
        textColor = "text-indigo-700";
        borderColor = "border-indigo-200";
        dotColor = "bg-indigo-500";
        break;

      case "confirm":
        statusMessage = "Confirm";
        bgColor = "bg-green-50";
        textColor = "text-green-700";
        borderColor = "border-green-200";
        dotColor = "bg-green-500";
        break;

      case "waiting_for_payment":
        statusMessage = "Waiting for Payment";
        bgColor = "bg-orange-50";
        textColor = "text-orange-700";
        borderColor = "border-orange-200";
        dotColor = "bg-orange-500";
        break;

      case "payment_received":
        statusMessage = "Payment Received";
        bgColor = "bg-emerald-50";
        textColor = "text-emerald-700";
        borderColor = "border-emerald-200";
        dotColor = "bg-emerald-500";
        break;

      case "packing":
        statusMessage = "Packing";
        bgColor = "bg-cyan-50";
        textColor = "text-cyan-700";
        borderColor = "border-cyan-200";
        dotColor = "bg-cyan-500";
        break;

      case "ready_to_ship":
        statusMessage = "Ready to Ship";
        bgColor = "bg-blue-50";
        textColor = "text-blue-700";
        borderColor = "border-blue-200";
        dotColor = "bg-blue-500";
        break;

      case "on_the_way":
        statusMessage = "On the Way";
        bgColor = "bg-purple-50";
        textColor = "text-purple-700";
        borderColor = "border-purple-200";
        dotColor = "bg-purple-500";
        break;

      case "ready_to_pick":
        statusMessage = "Ready to Pick";
        bgColor = "bg-purple-50";
        textColor = "text-purple-700";
        borderColor = "border-purple-200";
        dotColor = "bg-purple-500";
        break;

      case "delivered":
        statusMessage = "Delivered";
        bgColor = "bg-teal-50";
        textColor = "text-teal-700";
        borderColor = "border-teal-200";
        dotColor = "bg-teal-500";
        break;

      case "cancelled":
        statusMessage = "Cancelled";
        bgColor = "bg-red-50";
        textColor = "text-red-700";
        borderColor = "border-red-200";
        dotColor = "bg-red-500";
        break;

      default:
        const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
        statusMessage = capitalizedStatus;
        bgColor = "bg-gray-50";
        textColor = "text-gray-700";
        borderColor = "border-gray-200";
        dotColor = "bg-gray-500";
    }

    return {
      message: statusMessage,
      bgColor: bgColor,
      textColor: textColor,
      borderColor: borderColor,
      dotColor: dotColor,
    };
  };

  return (
    <div className="p-4">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by Customer Name or other..."
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
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none cursor-pointer"
            >
              <option value="">All Status</option>
              {getAvailableFilterStatuses().map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
            </div>
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
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pending
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Orders...
                    </div>
                  </td>
                </tr>
              ) : !ordersData || ordersData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No orders found
                    </div>
                  </td>
                </tr>
              ) : (
                ordersData.map((order: Order) => {
                  const isFullyPaid = fullyPaidOrders.has(order._id);
                  const isPaymentComplete = order.pendingAmount !== undefined && order.pendingAmount === 0;
                  console.log(`Rendering order ${order._id}, isFullyPaid:`, isFullyPaid, 'pendingAmount:', order.pendingAmount);
                  return (
                  <tr
                    key={order._id}
                    className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      isPaymentComplete || isFullyPaid
                        ? "bg-green-50/30 dark:bg-green-900/5"
                        : order.isConfirmedByCustomer && order.quantitiesModified
                        ? "bg-blue-50/30 dark:bg-blue-900/5"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <div className="font-medium">{order?.customerId?.name || order?.customerId?.email || order?.customerId?._id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      <div className="space-y-0.5">
                        {order.cartItems.map((item, idx) => (
                          <div key={item?.productId?._id || idx} className="text-sm">
                            {item?.skuFamilyId?.name || item?.productId?.name} <span className="text-gray-500">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {order.isConfirmedByCustomer && order.quantitiesModified && (
                        <div className="mt-1.5 text-xs text-green-600 dark:text-green-400">
                          ✓ Confirmed
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">${formatPrice(order.totalAmount)}</div>
                      {order.isConfirmedByCustomer && order.quantitiesModified && (
                        <div className="mt-0.5 text-xs text-green-600 dark:text-green-400">Updated</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {order.pendingAmount !== undefined && order.pendingAmount !== null ? (
                        <div>
                          <div className={`font-medium ${
                            order.pendingAmount === 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            ${formatPrice(order.pendingAmount)}
                          </div>
                          {order.pendingAmount === 0 && (
                            <div className="mt-0.5 text-xs text-green-600 dark:text-green-400">Paid</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {order.shippingAddress?.country ? (
                        <span>{order.shippingAddress.country.charAt(0).toUpperCase() + order.shippingAddress.country.slice(1)}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const statusInfo = getCombinedStatusBadge(order);
                        return (
                          <div className="space-y-1.5">
                            {/* Main Status Badge */}
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor} ${statusInfo.borderColor} border`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}></span>
                              <span>{statusInfo.message}</span>
                            </div>
                            
                            {/* Additional Status Info */}
                            <div className="space-y-0.5">
                              {order.isConfirmedByCustomer && order.quantitiesModified && (
                                <div className="text-[10px] text-green-600 dark:text-green-500 font-medium">
                                  ✓ Customer Confirmed
                                </div>
                              )}
                              {isFullyPaid && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">
                                  ✓ Payment Done
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="inline-flex items-center gap-3">
                        {canVerifyApprove && (
                          <button
                            onClick={() => handleUpdateStatus(order)}
                            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                            title="Update Status"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        )}
                        {/* Email button removed from actions column - now shown inside the modal */}
                        {/* Show confirmation badge if customer has confirmed */}
                        {order.isConfirmedByCustomer && order.quantitiesModified && (
                          <span
                            className="text-green-600 dark:text-green-400"
                            title="Order modifications confirmed by customer"
                          >
                            <i className="fas fa-check-circle"></i>
                          </span>
                        )}
                        {/* OTP buttons removed from actions column - now shown inside the modal when status is delivered */}
                        {/* Download Invoice button - only show for confirmed orders */}
                        {['confirm', 'waiting_for_payment', 'payment_received', 'packing', 'ready_to_ship', 'on_the_way', 'ready_to_pick', 'delivered'].includes(order.status) && (
                          <button
                            onClick={async () => {
                              try {
                                await AdminOrderService.downloadInvoice(order._id);
                              } catch (error) {
                                console.error('Error downloading invoice:', error);
                              }
                            }}
                            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                            title="Download Invoice"
                          >
                            <i className="fas fa-file-invoice"></i>
                          </button>
                        )}
                        <button
                          onClick={() => handleViewOrderDetails(order)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          title="View Order Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button
                          onClick={() => handleViewTracking(order._id)}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                          title="View Tracking"
                        >
                          <i className="fas fa-route"></i>
                        </button>
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
            Showing {ordersData?.length || 0} of {totalDocs} orders
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
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
      />
    </div>
  );
};

export default OrdersTable;
