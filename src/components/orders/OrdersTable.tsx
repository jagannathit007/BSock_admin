import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { format } from "date-fns";
import toastHelper from "../../utils/toastHelper";
import { AdminOrderService, Order, TrackingItem, OrderItem } from "../../services/order/adminOrder.services";
import { LOCAL_STORAGE_KEYS } from "../../constants/localStorage";
import OrderDetailsModal from "./OrderDetailsModal";
import { useDebounce } from "../../hooks/useDebounce";
import { usePermissions } from "../../context/PermissionsContext";

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
      setOrdersData(response.data.docs);
      setTotalPages(response.data.totalPages);
      setTotalDocs(response.data.totalDocs || 0);
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
      // Payment method removed - will be handled in separate module
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
                  
                  return `
                  <div style="margin-bottom: 16px; padding: 12px; background-color: #F9FAFB; border-radius: 6px; border: 1px solid #E5E7EB;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <label style="display: block; font-size: 14px; font-weight: 500; color: #374151;">
                        ${item.skuFamilyId?.name || (item.productId && typeof item.productId === 'object' ? item.productId.name : 'Product')}
                        ${moq > 1 ? `<span style="font-size: 12px; color: #6B7280; font-weight: normal;"> (MOQ: ${moq})</span>` : ''}
                      </label>
                      <span style="font-size: 14px; font-weight: 600; color: #1F2937;">Price: $${itemPrice.toFixed(2)}</span>
                    </div>
                    <input
                      type="number"
                      min="${moq}"
                      value="${item.quantity}"
                      class="quantity-input"
                      data-item-index="${index}"
                      data-moq="${moq}"
                      data-price="${itemPrice}"
                      style="width: 100%; margin:0px; padding: 8px; font-size: 14px; border: 1px solid #D1D5DB; border-radius: 6px; background-color: #FFFFFF; color: #1F2937; outline: none; transition: border-color 0.2s;"
                    />
                    ${moq > 1 ? `<p style="font-size: 11px; color: #6B7280; margin-top: 4px; margin-bottom: 0;">Minimum order quantity: ${moq}</p>` : ''}
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
                type="number"
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
          <div id="discountContainer" style="margin-bottom: 20px; display: none;">
            <label for="discountInput" style="display: block; font-size: 14px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Discount</label>
            ${order.discount !== null && order.discount !== undefined && Number(order.discount) > 0 ? `
              <div style="padding: 10px; border: 1px solid #E5E7EB; border-radius: 6px; background-color: #F9FAFB; color: #111827; font-size: 14px;">
                Applied: ${Number(order.discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p style="font-size: 12px; color: #6B7280; margin-top: 4px;">Discount already applied to this order.</p>
            ` : `
              <input
                type="number"
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

            if (!statusSelect) {
              Swal.showValidationMessage('Status select element not found');
              return false;
            }

            selectedStatus = statusSelect.value;
            message = messageInput?.value || "";
            // Payment method removed - will be handled in separate module
            
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
            // Validate MOQ when editing quantities
            if (canEditOrder && selectedStatus === "requested" && quantityInputs && quantityInputs.length > 0) {
              editedCartItems = order.cartItems.map((item, index) => {
                const inputValue = quantityInputs[index]?.value;
                const newQuantity = inputValue ? parseInt(inputValue, 10) : item.quantity;
                // Get MOQ from data attribute (set from productId.moq or item.moq)
                const moq = parseInt(quantityInputs[index]?.getAttribute('data-moq') || '1', 10);
                
                if (isNaN(newQuantity) || newQuantity < moq) {
                  const productName = item.skuFamilyId?.name || 
                    (item.productId && typeof item.productId === 'object' ? item.productId.name : 'Product');
                  throw new Error(`Quantity for "${productName}" must be at least ${moq} (MOQ)`);
                }
                
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
                const price = parseFloat(input.getAttribute('data-price') || '0');
                const newQuantity = parseInt(input.value || '0', 10);
                const originalQuantity = parseInt(input.getAttribute('data-original-quantity') || input.value || '0', 10);
                
                newTotal += price * newQuantity;
                originalTotal += price * originalQuantity;
              });
              
              // Add otherCharges if present
              const otherChargesInput = document.getElementById("otherChargesInput") as HTMLInputElement;
              const otherCharges = otherChargesInput ? (parseFloat(otherChargesInput.value) || 0) : (order.otherCharges || 0);
              newTotal += otherCharges;
              originalTotal += (order.otherCharges || 0);
              
              // Subtract discount if present
              const discountInput = document.getElementById("discountInput") as HTMLInputElement;
              const discount = discountInput ? (parseFloat(discountInput.value) || 0) : (order.discount || 0);
              newTotal = Math.max(0, newTotal - discount);
              originalTotal = Math.max(0, originalTotal - (order.discount || 0));
              
              if (newOrderPriceContainer) {
                const newOrderTotal = document.getElementById("newOrderTotal") as HTMLElement;
                const originalOrderTotal = document.getElementById("originalOrderTotal") as HTMLElement;
                const orderDifference = document.getElementById("orderDifference") as HTMLElement;
                
                if (newOrderTotal) newOrderTotal.textContent = `$${newTotal.toFixed(2)}`;
                if (originalOrderTotal) originalOrderTotal.textContent = `$${originalTotal.toFixed(2)}`;
                
                const difference = newTotal - originalTotal;
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
              
              // Function to check if quantities changed and show/hide send confirmation button
              const checkAndShowConfirmationButton = () => {
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
                    // Show button if quantities changed in modal OR quantities were already modified (from previous edit)
                    // AND customer hasn't confirmed yet
                    const shouldShow = (quantitiesChanged || order.quantitiesModified) && !order.isConfirmedByCustomer;
                    sendConfirmationContainer.style.display = shouldShow ? "block" : "none";
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
                input.addEventListener("input", () => {
                  calculateNewOrderPrice();
                  checkAndShowConfirmationButton();
                });
                input.addEventListener("change", () => {
                  calculateNewOrderPrice();
                  checkAndShowConfirmationButton();
                });
              });
              
              // Add event listener to otherCharges input
              const otherChargesInput = document.getElementById("otherChargesInput") as HTMLInputElement;
              if (otherChargesInput) {
                otherChargesInput.addEventListener("input", calculateNewOrderPrice);
                otherChargesInput.addEventListener("change", calculateNewOrderPrice);
              }
              // Add event listener to discount input
              const discountInput = document.getElementById("discountInput") as HTMLInputElement;
              if (discountInput) {
                discountInput.addEventListener("input", calculateNewOrderPrice);
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
                const deliveredWarningContainer = document.getElementById("deliveredWarningContainer") as HTMLElement;
                if (deliveredWarningContainer) {
                  deliveredWarningContainer.style.display = newStatus === "delivered" ? "block" : "none";
                }
                
                // Update OTP container visibility when status changes
                const otpContainer = document.getElementById("otpContainer") as HTMLElement;
                if (otpContainer && newStatus === "delivered" && order.receiverDetails?.mobile) {
                  otpContainer.style.display = "block";
                } else if (otpContainer) {
                  otpContainer.style.display = "none";
                }
              });
              
              // Set initial visibility for delivered warning and OTP container
              const deliveredWarningContainer = document.getElementById("deliveredWarningContainer") as HTMLElement;
              if (deliveredWarningContainer) {
                deliveredWarningContainer.style.display = currentStatus === "delivered" ? "block" : "none";
              }
              
              // Set initial visibility for OTP container
              const otpContainer = document.getElementById("otpContainer") as HTMLElement;
              if (otpContainer) {
                otpContainer.style.display = (currentStatus === "delivered" && order.receiverDetails?.mobile) ? "block" : "none";
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
                      // Close current modal and reopen with updated order
                      Swal.close();
                      setTimeout(() => {
                        handleUpdateStatus(updatedOrder);
                      }, 300);
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
                    
                    await AdminOrderService.verifyDeliveryOTP(order._id, otp);
                    toastHelper.showTost('OTP verified successfully!', 'success');
                    
                    // Refresh orders to get updated OTP status
                    await fetchOrders();
                    
                    // Get updated order from the refreshed list using search by order ID
                    const updatedOrdersResponse = await AdminOrderService.getOrderList(1, 100, order._id);
                    const updatedOrder = updatedOrdersResponse?.data?.docs?.find((o: Order) => o._id === order._id);
                    
                    if (updatedOrder) {
                      // Close current modal and reopen with updated order
                      Swal.close();
                      setTimeout(() => {
                        handleUpdateStatus(updatedOrder);
                      }, 300);
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
                      // Close current modal and reopen with updated order
                      Swal.close();
                      setTimeout(() => {
                        handleUpdateStatus(updatedOrder);
                      }, 300);
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
            undefined, // Payment method removed - will be handled in separate module
            selectedOtherCharges !== null ? selectedOtherCharges : undefined,
            selectedImages.length > 0 ? selectedImages : undefined,
            selectedDiscount !== null ? selectedDiscount : undefined
          );

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

  // Combined status function that merges status and verification into one message
  const getCombinedStatusBadge = (order: Order) => {
    const status = order.status?.toLowerCase() || 'request';
    const orderTrackingStatus = order.orderTrackingStatus?.toLowerCase();

    // Handle cancellation flow
    if (orderTrackingStatus === "cancel" && status === "cancel") {
      return {
        message: "cancel",
        style: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700",
      };
    }
    if (orderTrackingStatus === "verified" && status === "cancel") {
      return {
        message: "Request is cancelled",
        style: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700",
      };
    }

    // Handle different status combinations
    let statusMessage = "";
    let statusStyle = "";

    // Status flow: requested → approved → accepted → ready_to_pickup → out_for_delivery → delivered
    
    switch (status) {
      case "requested":
        statusMessage = "Requested";
        statusStyle = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700";
        break;

      case "rejected":
        statusMessage = "Rejected";
        statusStyle = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700";
        break;

      case "verify":
        statusMessage = "Verify";
        statusStyle = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700";
        break;

      case "approved":
        statusMessage = "Approved";
        statusStyle = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700";
        break;

      case "confirm":
        statusMessage = "Confirm";
        statusStyle = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700";
        break;

      case "waiting_for_payment":
        statusMessage = "Waiting for Payment";
        statusStyle = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700";
        break;

      case "payment_received":
        statusMessage = "Payment Received";
        statusStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700";
        break;

      case "packing":
        statusMessage = "Packing";
        statusStyle = "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-700";
        break;

      case "ready_to_ship":
        statusMessage = "Ready to Ship";
        statusStyle = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700";
        break;

      case "on_the_way":
        statusMessage = "On the Way";
        statusStyle = "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-700";
        break;

      case "ready_to_pick":
        statusMessage = "Ready to Pick";
        statusStyle = "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700";
        break;

      case "delivered":
        statusMessage = "Delivered";
        statusStyle = "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-700";
        break;

      case "cancelled":
        statusMessage = "Cancelled";
        statusStyle = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700";
        break;

      default:
        // Fallback for any other status
        const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
        statusMessage = `Request is ${capitalizedStatus}`;
        statusStyle = "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-200 dark:border-gray-700";
    }

    return {
      message: statusMessage,
      style: statusStyle,
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
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Items
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Shipping Country
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Date
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Orders...
                    </div>
                  </td>
                </tr>
              ) : ordersData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No orders found
                    </div>
                  </td>
                </tr>
              ) : (
                ordersData.map((order: Order) => (
                  <tr
                    key={order._id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      order.isConfirmedByCustomer && order.quantitiesModified
                        ? "bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {order?.customerId?.name || order?.customerId?.email || order?.customerId?._id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="space-y-1">
                        {order.cartItems.map((item) => (
                          <div key={item?.productId?._id}>
                            {item?.skuFamilyId?.name || item?.productId?.name} (x{item.quantity})
                          </div>
                        ))}
                        {order.isConfirmedByCustomer && order.quantitiesModified && (
                          <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                            <i className="fas fa-check-circle mr-1"></i>
                            Quantities confirmed by customer
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <span>${formatPrice(order.totalAmount)}</span>
                        {order.isConfirmedByCustomer && order.quantitiesModified && (
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700"
                            title="Order amount updated after customer confirmation"
                          >
                            <i className="fas fa-check-circle mr-1"></i>
                            Updated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {order.shippingAddress?.country ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {order.shippingAddress.country.charAt(0).toUpperCase() + order.shippingAddress.country.slice(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {(() => {
                        const statusInfo = getCombinedStatusBadge(order);
                        return (
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${statusInfo.style}`}
                            >
                              {statusInfo.message}
                            </span>
                            {order.isConfirmedByCustomer && order.quantitiesModified && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700">
                                <i className="fas fa-check-circle mr-1"></i>
                                Confirmed by Customer
                              </span>
                            )}
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
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
            Showing {ordersData.length} of {totalDocs} orders
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
