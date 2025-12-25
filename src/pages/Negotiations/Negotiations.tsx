import { useState, useEffect } from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import NegotiationService, { Negotiation } from '../../services/negotiation/negotiation.services';
import { 
  ChevronRight, 
  ChevronDown, 
  User, 
  // Package, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  ShoppingCart,
  MessageSquare,
  Send,
  Handshake
} from 'lucide-react';
import toastHelper from '../../utils/toastHelper';
import Swal from 'sweetalert2';
import { handleNumericInput } from '../../utils/numericInput';

interface CustomerGroup {
  customerId: string;
  customer: any;
  products: ProductGroup[];
}

interface ProductGroup {
  productId: string;
  product: any;
  negotiations: Negotiation[];
}

const Negotiations = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'accepted' | 'rejected'>('all');
  const [loading, setLoading] = useState(false);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [acceptedNegotiations, setAcceptedNegotiations] = useState<Negotiation[]>([]);
  const [rejectedNegotiations, setRejectedNegotiations] = useState<Negotiation[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedNegotiations, setExpandedNegotiations] = useState<Set<string>>(new Set());
  const [counterOfferModal, setCounterOfferModal] = useState<{ open: boolean; negotiation: Negotiation | null }>({ open: false, negotiation: null });
  const [counterOfferPrice, setCounterOfferPrice] = useState<string>('');
  const [counterOfferMessage, setCounterOfferMessage] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'all') {
        const response = await NegotiationService.getAllNegotiations(1, 100);
        const activeNegotiations = (response.negotiations || []).filter(n => n.status === 'negotiation');
        groupNegotiationsByCustomer(activeNegotiations);
      } else if (activeTab === 'accepted') {
        const response = await NegotiationService.getAcceptedNegotiations(1, 100);
        setAcceptedNegotiations(response.negotiations || []);
      } else if (activeTab === 'rejected') {
        const response = await NegotiationService.getRejectedNegotiations(1, 100);
        setRejectedNegotiations(response.negotiations || []);
      }
    } catch (error) {
      console.error('Error fetching negotiations:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupNegotiationsByCustomer = (negotiations: Negotiation[]) => {
    const customerMap = new Map<string, CustomerGroup>();

    negotiations.forEach(negotiation => {
      // Get customer ID - could be fromUserId or toUserId depending on who initiated
      // For customer-initiated negotiations, fromUserId is the customer
      // For admin counter offers, toUserId is the customer
      let customerId: string;
      let customer: any;
      
      if (negotiation.FromUserType === 'Customer') {
        customerId = typeof negotiation.fromUserId === 'object' && negotiation.fromUserId?._id 
          ? negotiation.fromUserId._id.toString()
          : typeof negotiation.fromUserId === 'string' 
          ? negotiation.fromUserId 
          : 'unknown';
        customer = negotiation.fromUserId;
      } else {
        // Admin initiated, customer is in toUserId
        customerId = typeof negotiation.toUserId === 'object' && negotiation.toUserId?._id 
          ? negotiation.toUserId._id.toString()
          : typeof negotiation.toUserId === 'string' 
          ? negotiation.toUserId 
          : 'unknown';
        customer = negotiation.toUserId;
      }
      
      // Fallback: if customerId is still unknown, try fromUserId
      if (customerId === 'unknown' || !customerId) {
        customerId = typeof negotiation.fromUserId === 'object' && negotiation.fromUserId?._id 
          ? negotiation.fromUserId._id.toString()
          : typeof negotiation.fromUserId === 'string' 
          ? negotiation.fromUserId 
          : 'unknown';
        customer = negotiation.fromUserId;
      }

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customer,
          products: []
        });
      }

      const customerGroup = customerMap.get(customerId)!;
      const productId = typeof negotiation.productId === 'string' 
        ? negotiation.productId 
        : negotiation.productId?._id || 'unknown';
      const product = negotiation.productId;

      let productGroup = customerGroup.products.find(p => p.productId === productId);
      if (!productGroup) {
        productGroup = {
          productId,
          product,
          negotiations: []
        };
        customerGroup.products.push(productGroup);
      }

      productGroup.negotiations.push(negotiation);
    });

    // Sort negotiations by date within each product group
    customerMap.forEach(customerGroup => {
      customerGroup.products.forEach(productGroup => {
        productGroup.negotiations.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    });

    setCustomerGroups(Array.from(customerMap.values()));
  };

  const toggleCustomer = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const toggleProduct = (productKey: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productKey)) {
      newExpanded.delete(productKey);
    } else {
      newExpanded.add(productKey);
    }
    setExpandedProducts(newExpanded);
  };

  const toggleNegotiation = (negotiationId: string) => {
    const newExpanded = new Set(expandedNegotiations);
    if (newExpanded.has(negotiationId)) {
      newExpanded.delete(negotiationId);
    } else {
      newExpanded.add(negotiationId);
    }
    setExpandedNegotiations(newExpanded);
  };

  const handlePlaceOrder = async (negotiation: Negotiation) => {
    if (!negotiation._id) return;

    try {
      const result = await NegotiationService.placeOrderFromNegotiation(negotiation._id);
      if (result) {
        // Check if email was sent or order was placed
        if (result.emailSent) {
          toastHelper.showTost('Confirmation email has been sent to customer. Order will be placed automatically after customer confirms.', 'success');
        } else {
          toastHelper.showTost('Order placed successfully!', 'success');
        }
        fetchData(); // Refresh data
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to process order';
      toastHelper.showTost(errorMessage, 'error');
      console.error('Error placing order:', error);
    }
  };

  const handleAcceptOffer = async (negotiation: Negotiation) => {
    if (!negotiation._id) return;

    const result = await Swal.fire({
      title: 'Accept Offer?',
      text: `Are you sure you want to accept this offer of ${formatPrice(negotiation.offerPrice, negotiation.currency)}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Accept',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        const response = await NegotiationService.respondToNegotiation({
          negotiationId: negotiation._id,
          action: 'accept'
        });
        if (response) {
          toastHelper.showTost('Offer accepted successfully!', 'success');
          fetchData(); // Refresh data
        }
      } catch (error) {
        console.error('Error accepting offer:', error);
      }
    }
  };

  const handleRejectOffer = async (negotiation: Negotiation) => {
    if (!negotiation._id) return;

    try {
      const result = await Swal.fire({
        title: 'Reject Offer?',
        text: `Are you sure you want to reject this offer of ${formatPrice(negotiation.offerPrice, negotiation.currency)}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, Reject',
        cancelButtonText: 'Cancel',
        input: 'textarea',
        inputPlaceholder: 'Optional rejection message...',
        inputAttributes: {
          'aria-label': 'Rejection message'
        },
        showLoaderOnConfirm: true,
        preConfirm: async (message) => {
          try {
            const response = await NegotiationService.respondToNegotiation({
              negotiationId: negotiation._id!,
              action: 'reject',
              message: message && message.trim() ? message.trim() : undefined
            });
            return response;
          } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to reject offer';
            Swal.showValidationMessage(errorMessage);
            return false;
          }
        },
        allowOutsideClick: () => !Swal.isLoading()
      });

      if (result.isConfirmed && result.value !== false) {
        toastHelper.showTost('Offer rejected successfully!', 'success');
        fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Error rejecting offer:', error);
      toastHelper.showTost('Failed to reject offer', 'error');
    }
  };

  const handleOpenCounterOffer = (negotiation: Negotiation) => {
    if (!negotiation._id) return;
    setCounterOfferPrice(negotiation.offerPrice.toString());
    setCounterOfferMessage('');
    setCounterOfferModal({ open: true, negotiation });
  };

  const handleCloseCounterOffer = () => {
    setCounterOfferModal({ open: false, negotiation: null });
    setCounterOfferPrice('');
    setCounterOfferMessage('');
  };

  const handleSubmitCounterOffer = async () => {
    if (!counterOfferModal.negotiation?._id) return;

    const price = parseFloat(counterOfferPrice);
    if (isNaN(price) || price <= 0) {
      toastHelper.showTost('Please enter a valid price', 'error');
      return;
    }

    try {
      const response = await NegotiationService.respondToNegotiation({
        negotiationId: counterOfferModal.negotiation._id,
        action: 'counter',
        offerPrice: price,
        message: counterOfferMessage || undefined
      });
      if (response) {
        toastHelper.showTost('Counter offer sent successfully!', 'success');
        handleCloseCounterOffer();
        fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Error sending counter offer:', error);
    }
  };

  const getProductName = (product: any) => {
    if (typeof product === 'string') return 'Product';
    return product?.name || 'Product';
  };

const getSkuBadge = (product: any) => {
  if (typeof product === 'string') return 'SKU';
  const family = product?.skuFamilyId;
  if (!family) return 'SKU';
  return family.name || family.code || 'SKU';
};

const getSkuDetail = (product: any) => {
  if (typeof product === 'string') return '';
  const family = product?.skuFamilyId;
  const parts: string[] = [];
  if (family?.name) parts.push(family.name);
  if (family?.brand?.title) parts.push(family.brand.title);
  if (product?.specification) parts.push(product.specification);
  if (product?.storage) parts.push(product.storage);
  if (product?.ram) parts.push(product.ram);
  if (product?.color) parts.push(product.color);
  return parts.join(' • ');
};

  const getCustomerName = (customer: any) => {
    if (typeof customer === 'string') return 'Customer';
    return `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || customer?.email || 'Customer';
  };

const getCustomerDetails = (customer: any) => {
  if (typeof customer === 'string') return '';
  const parts: string[] = [];
  if (customer?.email) parts.push(customer.email);
  if (customer?.phone) parts.push(customer.phone);
  return parts.join(' • ');
};

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(price);
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderAllNegotiations = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (customerGroups.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No negotiations found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {customerGroups.map(customerGroup => {
          const isCustomerExpanded = expandedCustomers.has(customerGroup.customerId);
          return (
            <div key={customerGroup.customerId} className="bg-white border border-gray-200 rounded-lg shadow-sm">
              {/* Customer Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => toggleCustomer(customerGroup.customerId)}
              >
                <div className="flex items-center space-x-3">
                  {isCustomerExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {getCustomerName(customerGroup.customer)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getCustomerDetails(customerGroup.customer)}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {customerGroup.products.length} product{customerGroup.products.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Products List */}
              {isCustomerExpanded && (
                <div className="border-t border-gray-200">
                  {customerGroup.products.map(productGroup => {
                    const productKey = `${customerGroup.customerId}-${productGroup.productId}`;
                    const isProductExpanded = expandedProducts.has(productKey);
                    return (
                      <div key={productGroup.productId} className="border-b border-gray-100 last:border-b-0">
                        {/* Product Header */}
                        <div 
                          className="p-4 pl-12 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                          onClick={() => toggleProduct(productKey)}
                        >
                          <div className="flex items-center space-x-3">
                            {isProductExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] font-medium text-gray-600 px-1 text-center">
                              {getSkuBadge(productGroup.product)}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {getProductName(productGroup.product)}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {productGroup.negotiations.length} negotiation{productGroup.negotiations.length !== 1 ? 's' : ''}
                              </p>
                              {getSkuDetail(productGroup.product) && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {getSkuDetail(productGroup.product)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500"></div>
                        </div>

                        {/* Negotiations History */}
                        {isProductExpanded && (
                          <div className="bg-gray-50 pl-16 pr-4 py-3">
                            <div className="space-y-3">
                              {productGroup.negotiations.map((negotiation, index) => {
                                // const _isNegotiationExpanded = expandedNegotiations.has(negotiation._id || '');
                                const isActive = negotiation.status === 'negotiation';
                                const isLatest = index === productGroup.negotiations.length - 1;
                                const canRespond = isActive && negotiation.FromUserType === 'Customer';
                                
                                return (
                                  <div 
                                    key={negotiation._id} 
                                    className={`bg-white rounded-lg p-3 border ${
                                      isLatest ? 'border-blue-300 shadow-md' : 'border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div 
                                        className="flex items-center space-x-3 flex-1 cursor-pointer"
                                        onClick={() => negotiation._id && toggleNegotiation(negotiation._id)}
                                      >
                                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                                          negotiation.FromUserType === 'Admin' 
                                            ? 'bg-purple-100 text-purple-700' 
                                            : 'bg-blue-100 text-blue-700'
                                        }`}>
                                          {negotiation.FromUserType}
                                        </div>
                                        <div className="flex items-center space-x-3">
                                          <div className="flex items-center space-x-2">
                                            {negotiation.previousOfferPrice && (
                                              <div className="flex items-center space-x-1 text-gray-400 text-xs line-through">
                                                <DollarSign className="w-3 h-3" />
                                                <span>{formatPrice(negotiation.previousOfferPrice, negotiation.currency)}</span>
                                              </div>
                                            )}
                                            <div className="flex items-center space-x-1 text-green-600 font-semibold">
                                              <DollarSign className="w-4 h-4" />
                                              {formatPrice(negotiation.offerPrice, negotiation.currency)}
                                            </div>
                                          </div>
                                          {negotiation.quantity && (
                                            <div className="flex items-center space-x-2">
                                              {negotiation.previousQuantity && (
                                                <span className="text-xs text-gray-400 line-through px-2 py-1 bg-gray-50 rounded">
                                                  Qty: {negotiation.previousQuantity}
                                                </span>
                                              )}
                                              <span className="text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded">
                                                Qty: {negotiation.quantity}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-1 text-gray-500 text-xs">
                                          <Clock className="w-3 h-3" />
                                          {formatDate(negotiation.createdAt)}
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                                          negotiation.status === 'accepted' 
                                            ? 'bg-green-100 text-green-700' 
                                            : negotiation.status === 'rejected'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {negotiation.status}
                                        </div>
                                        {isLatest && (
                                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                            Latest
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Action Buttons - Only show for active negotiations from customers */}
                                      {canRespond && (
                                        <div className="flex items-center space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            onClick={() => handleAcceptOffer(negotiation)}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1 transition-colors"
                                          >
                                            <CheckCircle className="w-3 h-3" />
                                            <span>Accept</span>
                                          </button>
                                          <button
                                            onClick={() => handleOpenCounterOffer(negotiation)}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1 transition-colors"
                                          >
                                            <Handshake className="w-3 h-3" />
                                            <span>Counter</span>
                                          </button>
                                          <button
                                            onClick={() => handleRejectOffer(negotiation)}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1 transition-colors"
                                          >
                                            <XCircle className="w-3 h-3" />
                                            <span>Reject</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Expanded Details */}
                                    {/* {isNegotiationExpanded && (
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        {(negotiation.previousOfferPrice || negotiation.previousQuantity) && (
                                          <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                                            <p className="text-xs font-medium text-blue-800 mb-2">Previous Values:</p>
                                            <div className="space-y-1">
                                              {negotiation.previousOfferPrice && (
                                                <div className="flex items-center justify-between text-xs">
                                                  <span className="text-gray-600">Previous Price:</span>
                                                  <span className="text-gray-700 line-through font-medium">
                                                    {formatPrice(negotiation.previousOfferPrice, negotiation.currency)}
                                                  </span>
                                                </div>
                                              )}
                                              {negotiation.previousQuantity && (
                                                <div className="flex items-center justify-between text-xs">
                                                  <span className="text-gray-600">Previous Quantity:</span>
                                                  <span className="text-gray-700 line-through font-medium">
                                                    {negotiation.previousQuantity}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {negotiation.message && (
                                          <div className="mb-2">
                                            <p className="text-xs text-gray-500 mb-1">Message:</p>
                                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{negotiation.message}</p>
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-500">
                                          <p>Offer ID: {negotiation._id}</p>
                                          <p>Bid ID: {negotiation.bidId}</p>
                                        </div>
                                      </div>
                                    )} */}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderAcceptedOrders = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (acceptedNegotiations.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No accepted orders found</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {acceptedNegotiations.map(negotiation => {
          const product = negotiation.productId;
          // Get customer - could be fromUserId or toUserId depending on who initiated
          const customer = negotiation.FromUserType === 'Customer' 
            ? negotiation.fromUserId 
            : (negotiation.toUserType === 'Customer' ? negotiation.toUserId : negotiation.fromUserId);
          return (
            <div key={negotiation._id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-16 h-16 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-700 px-2 text-center">
                  {getSkuBadge(product)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {getProductName(product)}
                  </h3>
                  {getSkuDetail(product) && (
                    <p className="text-xs text-gray-600 mt-1">
                      {getSkuDetail(product)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-sm">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">{getCustomerName(customer)}</span>
                </div>
                {getCustomerDetails(customer) && (
                  <p className="text-xs text-gray-500 pl-6">{getCustomerDetails(customer)}</p>
                )}
                <div className="flex items-center space-x-2 text-sm">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-600">
                    {formatPrice(negotiation.offerPrice, negotiation.currency)}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(negotiation.createdAt)}</span>
                </div>
                {negotiation.message && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-2">
                    {negotiation.message}
                  </p>
                )}
                {/* Confirmation Status */}
                <div className="mt-2">
                  {negotiation.isConfirmedByCustomer ? (
                    <div className="flex items-center space-x-2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                      <CheckCircle className="w-3 h-3" />
                      <span>Confirmed by Customer</span>
                      {negotiation.confirmedAt && (
                        <span className="text-gray-500">
                          ({formatDate(negotiation.confirmedAt)})
                        </span>
                      )}
                    </div>
                  ) : negotiation.confirmationToken ? (
                    <div className="flex items-center space-x-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      <Clock className="w-3 h-3" />
                      <span>Confirmation Email Sent - Waiting for Customer</span>
                      {negotiation.confirmationExpiry && new Date(negotiation.confirmationExpiry) < new Date() && (
                        <span className="text-red-600">(Expired)</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded">
                      <span>Ready to Place Order</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handlePlaceOrder(negotiation)}
                disabled={negotiation.isPlacedOrder && negotiation.isConfirmedByCustomer}
                className={`w-full py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                  negotiation.isPlacedOrder && negotiation.isConfirmedByCustomer
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {negotiation.isPlacedOrder && negotiation.isConfirmedByCustomer
                    ? 'Order Already Placed'
                    : negotiation.isConfirmedByCustomer && !negotiation.isPlacedOrder
                    ? 'Place Order'
                    : negotiation.isConfirmedByCustomer && negotiation.isPlacedOrder
                    ? 'Place Order Again'
                    : negotiation.confirmationToken
                    ? 'Resend Confirmation Email'
                    : 'Send Confirmation Email'}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRejected = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (rejectedNegotiations.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No rejected negotiations found</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rejectedNegotiations.map(negotiation => {
          const product = negotiation.productId;
          // Get customer - could be fromUserId or toUserId depending on who initiated
          const customer = negotiation.FromUserType === 'Customer' 
            ? negotiation.fromUserId 
            : (negotiation.toUserType === 'Customer' ? negotiation.toUserId : negotiation.fromUserId);
          return (
            <div key={negotiation._id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-16 h-16 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-700 px-2 text-center">
                  {getSkuBadge(product)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {getProductName(product)}
                  </h3>
                  {getSkuDetail(product) && (
                    <p className="text-xs text-gray-600 mt-1">
                      {getSkuDetail(product)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">{getCustomerName(customer)}</span>
                </div>
                {getCustomerDetails(customer) && (
                  <p className="text-xs text-gray-500 pl-6">{getCustomerDetails(customer)}</p>
                )}
                <div className="flex items-center space-x-2 text-sm">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-gray-600">
                    {formatPrice(negotiation.offerPrice, negotiation.currency)}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(negotiation.createdAt)}</span>
                </div>
                {negotiation.message && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-2">
                    {negotiation.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <PageBreadcrumb pageTitle="Negotiations" />
      <div className="space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'all'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Negotiations
            </button>
            <button
              onClick={() => setActiveTab('accepted')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'accepted'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Accepted Orders
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'rejected'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Rejected
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'all' && renderAllNegotiations()}
            {activeTab === 'accepted' && renderAcceptedOrders()}
            {activeTab === 'rejected' && renderRejected()}
          </div>
        </div>
      </div>

      {/* Counter Offer Modal */}
      {counterOfferModal.open && counterOfferModal.negotiation && (
        <div className="fixed inset-0 bg-black/60 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Make Counter Offer</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Offer
                  </label>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatPrice(counterOfferModal.negotiation.offerPrice, counterOfferModal.negotiation.currency)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Counter Offer Price *
                  </label>
                  <input
                    type="text"
                    value={counterOfferPrice}
                    onChange={(e) => {
                      const filteredValue = handleNumericInput(e.target.value, true, false);
                      setCounterOfferPrice(filteredValue);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter counter offer price"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message (Optional)
                  </label>
                  <textarea
                    value={counterOfferMessage}
                    onChange={(e) => setCounterOfferMessage(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add a message to your counter offer..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {counterOfferMessage.length}/500 characters
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseCounterOffer}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitCounterOffer}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Counter Offer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Negotiations;

