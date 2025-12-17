import { useState, useEffect } from 'react';

import { X, MessageSquare, DollarSign, Clock, CheckCircle, User, Package, Send, BellRing, XCircle } from 'lucide-react';

import NegotiationService, { Negotiation } from '../../services/negotiation/negotiation.services';

import { useSocket } from '../../context/SocketContext';

import toastHelper from '../../utils/toastHelper';

import Swal from 'sweetalert2';



interface NegotiationGroup {

  customerId: string;

  customer: {

    _id: string;

    firstName: string;

    lastName: string;

    email: string;

    phone?: string;

  } | null;

  productId: string;

  product: {

    _id: string;

    name: string;

    price: number;

    mainImage: string;

    description?: string;

    skuFamilyId: {

      _id: string;

      name: string;

      brand?: string;

      code?: string;

      images?: string[];

      description?: string;

    } | null;

  } | null;

  negotiations: Negotiation[];

  status: 'negotiation' | 'accepted';

  acceptedBy?: 'Admin' | 'Customer';

  acceptedAt?: string;

  latestUpdate?: string;

}



interface NegotiationModalProps {

  isOpen: boolean;

  onClose: () => void;

}



const NegotiationModal = ({ isOpen, onClose }: NegotiationModalProps) => {

  const { socketService } = useSocket();

  const [activeTab, setActiveTab] = useState('active');

  const [negotiations, setNegotiations] = useState<NegotiationGroup[]>([]);

  const [acceptedNegotiations, setAcceptedNegotiations] = useState<NegotiationGroup[]>([]);

  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const [acceptedPage, setAcceptedPage] = useState(1);

  const [totalPages, setTotalPages] = useState(1);

  const [acceptedTotalPages, setAcceptedTotalPages] = useState(1);

  const [total, setTotal] = useState(0);

  const [acceptedTotal, setAcceptedTotal] = useState(0);

  const limit = 10;

  const [selectedNegotiation, setSelectedNegotiation] = useState<Negotiation | null>(null);

  const [showResponseForm, setShowResponseForm] = useState(false);

  const [responseData, setResponseData] = useState({

    action: 'counter' as 'counter' | 'accept' | 'reject',

    offerPrice: '',

    message: ''

  });

  const [notifications, setNotifications] = useState<any[]>([]);

  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const imageBaseUrl = import.meta.env.VITE_BASE_URL;



  // Group negotiations by customer and product

  const groupNegotiations = (items: Negotiation[]): NegotiationGroup[] => {

    const groupMap = new Map<string, NegotiationGroup>();



    // First pass: collect all negotiations into groups

    items.forEach((negotiation) => {

      // Get customer ID - use fromUserId for customer, toUserId for admin

      const customerId = negotiation.FromUserType === 'Customer'

        ? (typeof negotiation.fromUserId === 'object' ? negotiation.fromUserId._id : negotiation.fromUserId)

        : (typeof negotiation.toUserId === 'object' && negotiation.toUserId ? negotiation.toUserId._id : negotiation.toUserId);



      // Get product ID

      const productId = typeof negotiation.productId === 'object'

        ? (negotiation.productId as any)._id

        : negotiation.productId;



      if (!customerId || !productId) return;



      const groupKey = `${customerId}_${productId}`;



      if (!groupMap.has(groupKey)) {

        // Extract customer info

        const customer = negotiation.FromUserType === 'Customer'

          ? (typeof negotiation.fromUserId === 'object' ? negotiation.fromUserId : null)

          : (typeof negotiation.toUserId === 'object' && negotiation.toUserId ? negotiation.toUserId : null);



        // Extract product info

        const product = typeof negotiation.productId === 'object' ? (negotiation.productId as any) : null;

        const sku: any = product?.skuFamilyId ?? null;



        groupMap.set(groupKey, {

          customerId: String(customerId),

          customer: customer ? {

            _id: (customer as any)._id ? String((customer as any)._id) : String(customerId),

            firstName: (customer as any).firstName || '',

            lastName: (customer as any).lastName || '',

            email: (customer as any).email || '',

            phone: (customer as any).phone

          } : null,

          productId: String(productId),

          product: product ? {

            _id: String(product._id),

            name: String(product.name || ''),

            price: Number(product.price || 0),

            mainImage: String(product.mainImage || ''),

            description: product.description !== undefined && product.description !== null

              ? String(product.description)

              : undefined,

            skuFamilyId: sku ? {

              _id: String(sku._id ?? sku),

              name: String(sku.name ?? ''),

              brand: sku.brand

                ? String((sku.brand as any).title ?? (sku.brand as any).code ?? '')

                : undefined,

              code: sku.code !== undefined && sku.code !== null

                ? String(sku.code)

                : undefined,

              images: Array.isArray(sku.images)

                ? sku.images.map((img: any) => String(img))

                : undefined,

              description: sku.description !== undefined && sku.description !== null

                ? String(sku.description)

                : undefined

            } : null

          } : null,

          negotiations: [],

          status: 'negotiation',

          latestUpdate: negotiation.updatedAt || negotiation.createdAt

        });

      }



      const group = groupMap.get(groupKey)!;

      group.negotiations.push(negotiation);

    });



    // Second pass: determine status and accepted info for each group

    groupMap.forEach((group) => {

      // Check if any negotiation in this group is accepted

      const acceptedNegotiation = group.negotiations.find(n => n.status === 'accepted');



      if (acceptedNegotiation) {

        group.status = 'accepted';

        group.acceptedBy = acceptedNegotiation.FromUserType === 'Admin' ? 'Admin' : 'Customer';

        group.acceptedAt = acceptedNegotiation.updatedAt || acceptedNegotiation.createdAt;

      }



      // Find latest update

      const latestNegotiation = group.negotiations.reduce((latest, current) => {

        const currentDate = new Date(current.updatedAt || current.createdAt);

        const latestDate = new Date(latest.updatedAt || latest.createdAt);

        return currentDate > latestDate ? current : latest;

      });

      group.latestUpdate = latestNegotiation.updatedAt || latestNegotiation.createdAt;

    });



    return Array.from(groupMap.values());

  };



  useEffect(() => {

    if (isOpen) {

      fetchNegotiations();

      fetchAcceptedNegotiations();

      setupSocketListeners();

    }



    return () => {

      // Cleanup socket listeners when modal closes

      if (socketService) {

        socketService.removeNegotiationListeners();

      }

    };

  }, [isOpen, socketService]);



  useEffect(() => {

    if (isOpen) {

      if (activeTab === 'active') {

        fetchNegotiations();

      } else {

        fetchAcceptedNegotiations();

      }

    }

  }, [activeTab, currentPage, acceptedPage, isOpen]);



  // Setup socket listeners for real-time updates

  const setupSocketListeners = () => {

    if (!socketService) return;



    // Listen for negotiation notifications

    socketService.onNegotiationNotification((data: any) => {

      console.log('Received negotiation notification:', data);

      setNotifications(prev => [...prev, data]);

      

      // Determine toast type based on event type

      let toastType: 'success' | 'error' | 'warning' | 'info' = 'info';

      if (data.type === 'bid_accepted' || data.type === 'offer_accepted') {

        toastType = 'success';

      } else if (data.type === 'bid_rejected') {

        toastType = 'error';

      }

      

      // Show toast notification with user-friendly message

      toastHelper.showTost(data.message || '📬 New negotiation update', toastType);

      

      // Refresh negotiations if it's a relevant update

      if (data.type === 'new_bid' || data.type === 'counter_offer' || data.type === 'bid_accepted') {

        if (activeTab === 'active') {

          fetchNegotiations();

        } else {

          fetchAcceptedNegotiations();

        }

      }

    });



    // Listen for negotiation broadcasts

    socketService.onNegotiationBroadcast((data: any) => {

      console.log('Received negotiation broadcast:', data);

      setNotifications(prev => [...prev, data]);

      

      // Determine toast type based on event type

      let toastType: 'success' | 'error' | 'warning' | 'info' = 'info';

      if (data.type === 'bid_accepted') {

        toastType = 'success';

      }

      

      // Show toast notification with user-friendly message

      toastHelper.showTost(data.message || '📬 New negotiation activity', toastType);

      

      // Refresh negotiations

      if (activeTab === 'active') {

        fetchNegotiations();

      } else {

        fetchAcceptedNegotiations();

      }

    });



    // Listen for negotiation updates

    socketService.onNegotiationUpdate((data: any) => {

      console.log('Received negotiation update:', data);

      setNotifications(prev => [...prev, data]);

      

      // Determine toast type based on event type

      let toastType: 'success' | 'error' | 'warning' | 'info' = 'info';

      if (data.type === 'bid_accepted') {

        toastType = 'success';

      }

      

      // Show toast notification with user-friendly message

      toastHelper.showTost(data.message || '📝 Negotiation updated', toastType);

      

      // Refresh negotiations

      if (activeTab === 'active') {

        fetchNegotiations();

      } else {

        fetchAcceptedNegotiations();

      }

    });



    // Listen for user typing indicators

    socketService.onUserTyping((data: any) => {

      console.log('User typing:', data);

      if (data.isTyping) {

        setTypingUsers(prev => new Set([...prev, data.userId]));

      } else {

        setTypingUsers(prev => {

          const newSet = new Set(prev);

          newSet.delete(data.userId);

          return newSet;

        });

      }

    });



    // Listen for users joining/leaving negotiations

    socketService.onUserJoinedNegotiation((data: any) => {

      console.log('User joined negotiation:', data);

      toastHelper.showTost(`${data.userType} joined the negotiation`, 'info');

    });



    socketService.onUserLeftNegotiation((data: any) => {

      console.log('User left negotiation:', data);

      toastHelper.showTost(`${data.userType || 'User'} left the negotiation`, 'info');

    });

  };



  const fetchNegotiations = async () => {

    setLoading(true);

    try {

      const response = await NegotiationService.getAllNegotiations(currentPage, limit, 'negotiation');

      

      // Group negotiations by customer + product

      const grouped = groupNegotiations(response.negotiations || []);

      setNegotiations(grouped);

      setTotalPages(response.totalPages || 1);

      setTotal(response.total || 0);

    } catch (error) {

      console.error('Error fetching negotiations:', error);

    } finally {

      setLoading(false);

    }

  };



  const fetchAcceptedNegotiations = async () => {

    setLoading(true);

    try {

      const response = await NegotiationService.getAcceptedNegotiations(acceptedPage, limit);

      

      // Group negotiations by customer + product

      const grouped = groupNegotiations(response.negotiations || []);

      setAcceptedNegotiations(grouped);

      setAcceptedTotalPages(response.totalPages || 1);

      setAcceptedTotal(response.total || 0);

    } catch (error) {

      console.error('Error fetching accepted negotiations:', error);

    } finally {

      setLoading(false);

    }

  };



  const handleRespond = async () => {

    if (!selectedNegotiation || !selectedNegotiation._id) return;



    try {

      const data = {

        negotiationId: selectedNegotiation._id,

        action: responseData.action,

        offerPrice: responseData.action === 'counter' ? parseFloat(responseData.offerPrice) : undefined,

        message: responseData.message

      };



      await NegotiationService.respondToNegotiation(data);



      // Join negotiation room for real-time updates

      if (socketService && selectedNegotiation._id) {

        socketService.joinNegotiation(selectedNegotiation._id);

      }



      setShowResponseForm(false);

      setSelectedNegotiation(null);

      setResponseData({ action: 'counter', offerPrice: '', message: '' });

      fetchNegotiations();

    } catch (error) {

      console.error('Error responding to negotiation:', error);

    }

  };



  const handleRejectOffer = async (negotiation: Negotiation) => {

    if (!negotiation._id) return;



    try {

      const result = await Swal.fire({

        title: 'Reject Offer?',

        text: `Are you sure you want to reject this offer of ${formatPrice(negotiation.offerPrice)}?`,

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

        fetchNegotiations();

      }

    } catch (error) {

      console.error('Error rejecting offer:', error);

      toastHelper.showTost('Failed to reject offer', 'error');

    }

  };



  // Check if there's a newer negotiation for the same bid

  const hasNewerNegotiation = (currentNegotiation: Negotiation, negotiationGroup: NegotiationGroup) => {

    if (!negotiationGroup.negotiations || negotiationGroup.negotiations.length === 0) return false;

    

    return negotiationGroup.negotiations.some(negotiation => {

      // Same bid, different negotiation, newer timestamp

      return negotiation.bidId === currentNegotiation.bidId &&

             negotiation._id !== currentNegotiation._id &&

             new Date(negotiation.createdAt) > new Date(currentNegotiation.createdAt) &&

             negotiation.status === 'negotiation';

    });

  };



  // Check if any negotiation for the same bid has been accepted

  const hasAcceptedNegotiation = (negotiationGroup: NegotiationGroup) => {

    return negotiationGroup.status === 'accepted';

  };



  // Check if admin can make a counter offer for the entire bid group

  const canMakeCounterForBid = (negotiationGroup: NegotiationGroup) => {

    // If any negotiation for the same bid has been accepted, don't allow counter

    if (hasAcceptedNegotiation(negotiationGroup)) {

      return false;

    }



    // Admin can always make counter offers until bid is accepted

    return true;

  };



  const canAccept = (negotiation: Negotiation, negotiationGroup: NegotiationGroup) => {

    // If any negotiation for the same bid has been accepted, don't allow accepting

    if (hasAcceptedNegotiation(negotiationGroup)) {

      return false;

    }



    // If there's a newer negotiation for the same bid, don't allow accepting old ones

    if (hasNewerNegotiation(negotiation, negotiationGroup)) {

      return false;

    }



    // Admin can accept customer's offers (when admin is the receiver)

    return negotiation.FromUserType === 'Customer' && negotiation.status === 'negotiation';

  };



  const formatPrice = (price: number) => {

    return new Intl.NumberFormat('en-US', {

      style: 'currency',

      currency: 'USD'

    }).format(price);

  };



  const formatDate = (dateString: string) => {

    return new Date(dateString).toLocaleDateString('en-US', {

      year: 'numeric',

      month: 'short',

      day: 'numeric',

      hour: '2-digit',

      minute: '2-digit'

    });

  };



  const getProductImage = (product: NegotiationGroup['product']) => {

    if (!product) return '/images/placeholder.jpg';

    const images = product.skuFamilyId?.images;

    if (images && Array.isArray(images) && images.length > 0) {

      return `${imageBaseUrl}/${images[0]}`;

    }

    // Fallback to mainImage if available

    if (product.mainImage) {

      return `${imageBaseUrl}/${product.mainImage}`;

    }

    return '/images/placeholder.jpg';

  };



  const getProductName = (product: NegotiationGroup['product']) => {

    if (!product) return 'Product';

    return product.name || 'Product';

  };



  const getSKUFamilyName = (product: NegotiationGroup['product']) => {

    if (!product?.skuFamilyId) return 'N/A';

    return product.skuFamilyId.name || 'N/A';

  };



  const getCustomerName = (customer: NegotiationGroup['customer']) => {

    if (!customer) return 'Unknown Customer';

    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer';

  };



  const getCustomerEmail = (customer: NegotiationGroup['customer']) => {

    if (!customer) return 'N/A';

    return customer.email || 'N/A';

  };



  if (!isOpen) return null;



  return (

    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}

        <div className="flex items-center justify-between p-6 border-b border-gray-200">

          <div className="flex items-center space-x-3">

            <MessageSquare className="w-6 h-6 text-blue-600" />

            <h2 className="text-xl font-semibold text-gray-900">Negotiations</h2>

            {notifications.length > 0 && (

              <div className="flex items-center space-x-2">

                <BellRing className="w-5 h-5 text-orange-500" />

                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full">

                  {notifications.length} new

                </span>

              </div>

            )}

          </div>

          <div className="flex items-center space-x-2">

            {typingUsers.size > 0 && (

              <div className="flex items-center space-x-1 text-sm text-gray-500">

                <div className="flex space-x-1">

                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>

                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>

                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>

                </div>

                <span>{typingUsers.size} user{typingUsers.size > 1 ? 's' : ''} typing...</span>

              </div>

            )}

            <button

              onClick={onClose}

              className="p-2 hover:bg-gray-100 rounded-full transition-colors"

            >

              <X className="w-5 h-5 text-gray-500" />

            </button>

          </div>

        </div>



        {/* Tabs */}

        <div className="flex border-b border-gray-200">

          <button

            onClick={() => setActiveTab('active')}

            className={`px-6 py-3 font-medium text-sm transition-colors ${

              activeTab === 'active'

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

        </div>



        {/* Content */}

        <div className="p-6 overflow-y-auto min-h-[100px] max-h-[calc(90vh-200px)]">

          {loading ? (

            <div className="flex items-center justify-center py-12">

              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>

            </div>

          ) : (

            <>

              {/* No Data Message */}

              {(activeTab === 'active' ? negotiations.length === 0 : acceptedNegotiations.length === 0) && (

                <div className="flex flex-col items-center justify-center py-16 text-center">

                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">

                    <MessageSquare className="w-12 h-12 text-gray-400" />

                  </div>

                  <h3 className="text-lg font-medium text-gray-900 mb-2">

                    {activeTab === 'active' ? 'No Active Negotiations' : 'No Accepted Orders'}

                  </h3>

                  <p className="text-gray-500 max-w-md">

                    {activeTab === 'active' 

                      ? 'There are currently no active negotiations. New negotiation requests will appear here when customers make offers on your products.'

                      : 'There are no accepted orders yet. Once negotiations are accepted by either party, they will appear in this section.'

                    }

                  </p>

                </div>

              )}



              {/* Data List */}

              {(activeTab === 'active' ? negotiations.length > 0 : acceptedNegotiations.length > 0) && (

                <div className="space-y-6">

                  {(activeTab === 'active' ? negotiations : acceptedNegotiations).map((negotiationGroup: NegotiationGroup) => {

                    return (

                      <div key={`${negotiationGroup.customerId}_${negotiationGroup.productId}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">

                        {/* Group Header */}

                        <div className="flex items-start justify-between mb-4">

                          <div className="flex items-start space-x-4 flex-1">

                            <img

                              src={getProductImage(negotiationGroup.product)}

                              alt={getProductName(negotiationGroup.product)}

                              onError={(e) => {

                                (e.target as HTMLImageElement).src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSePykPxV7hbiMoufhNrCVlkEh94nvJQIMDeA&s';

                              }}

                              className="w-20 h-20 object-cover rounded-lg border border-gray-200"

                            />

                            <div className="flex-1">

                              <h3 className="font-semibold text-gray-900 text-lg mb-2">

                                {getProductName(negotiationGroup.product)}

                              </h3>

                              

                              {/* Customer Information */}

                              <div className="mb-2 p-2 bg-blue-50 rounded-lg">

                                <div className="flex items-center space-x-2 text-sm">

                                  <User className="w-4 h-4 text-blue-600" />

                                  <span className="font-medium text-gray-700">Customer:</span>

                                  <span className="text-gray-900">{getCustomerName(negotiationGroup.customer)}</span>

                                  <span className="text-gray-500">•</span>

                                  <span className="text-gray-600">{getCustomerEmail(negotiationGroup.customer)}</span>

                                </div>

                              </div>



                              {/* SKU Family Information */}

                              {negotiationGroup.product?.skuFamilyId && (

                                <div className="mb-2 p-2 bg-gray-50 rounded-lg">

                                  <div className="flex items-center space-x-2 text-sm">

                                    <Package className="w-4 h-4 text-gray-600" />

                                    <span className="font-medium text-gray-700">SKU Family:</span>

                                    <span className="text-gray-900">{getSKUFamilyName(negotiationGroup.product)}</span>

                                    {negotiationGroup.product.skuFamilyId.brand && (

                                      <>

                                        <span className="text-gray-500">•</span>

                                        <span className="text-gray-600">Brand: {negotiationGroup.product.skuFamilyId.brand}</span>

                                      </>

                                    )}

                                    {negotiationGroup.product.skuFamilyId.code && (

                                      <>

                                        <span className="text-gray-500">•</span>

                                        <span className="text-gray-600">Code: {negotiationGroup.product.skuFamilyId.code}</span>

                                      </>

                                    )}

                                  </div>

                                </div>

                              )}



                              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">

                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${

                                  negotiationGroup.status === 'accepted' 

                                    ? 'bg-green-100 text-green-800' 

                                    : 'bg-yellow-100 text-yellow-800'

                                }`}>

                                  {negotiationGroup.status === 'accepted' ? 'Accepted' : 'Negotiating'}

                                </span>

                                {negotiationGroup.status === 'accepted' && negotiationGroup.acceptedBy && (

                                  <span className="text-sm text-gray-600">

                                    Accepted by: {negotiationGroup.acceptedBy}

                                  </span>

                                )}

                              </div>

                            </div>

                          </div>

                          

                          {/* Bid-level Counter Button */}

                          <div className="flex flex-col space-y-2">

                            {canMakeCounterForBid(negotiationGroup) && (

                              <button

                                onClick={() => {

                                  // Use the latest customer negotiation for counter

                                  const latestCustomerNegotiation = negotiationGroup.negotiations

                                    .filter(n => n.FromUserType === 'Customer')

                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                                  

                                  if (latestCustomerNegotiation) {

                                    setSelectedNegotiation(latestCustomerNegotiation);

                                    setResponseData({ action: 'counter', offerPrice: '', message: '' });

                                    setShowResponseForm(true);

                                  }

                                }}

                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"

                              >

                                <Send className="w-4 h-4" />

                                <span>Make Counter Offer</span>

                              </button>

                            )}

                            {hasAcceptedNegotiation(negotiationGroup) && (

                              <div className="text-xs text-gray-500 text-center">

                                Bid accepted

                              </div>

                            )}

                          </div>

                        </div>



                        {/* Negotiation Flow */}

                        <div className="space-y-3">

                          <h4 className="text-sm font-medium text-gray-700 mb-2">Bidding Flow:</h4>

                          {negotiationGroup.negotiations

                            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

                            .map((negotiation) => (

                              <div key={negotiation._id} className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">

                                <div className="flex items-center justify-between">

                                  <div className="flex-1">

                                    <div className="flex items-center space-x-4 text-sm">

                                      <span className="font-medium text-gray-900">

                                        {negotiation.FromUserType} Offer

                                      </span>

                                      <span className="flex items-center text-green-600">

                                        <DollarSign className="w-4 h-4 mr-1" />

                                        {formatPrice(negotiation.offerPrice)}

                                      </span>

                                      <span className="flex items-center text-gray-500">

                                        <Clock className="w-4 h-4 mr-1" />

                                        {formatDate(negotiation.createdAt)}

                                      </span>

                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${

                                        negotiation.status === 'accepted' 

                                          ? 'bg-green-100 text-green-800' 

                                          : 'bg-yellow-100 text-yellow-800'

                                      }`}>

                                        {negotiation.status === 'accepted' ? 'Accepted' : 'Pending'}

                                      </span>

                                    </div>

                                    {negotiation.message && (

                                      <p className="text-sm text-gray-600 mt-2">{negotiation.message}</p>

                                    )}

                                  </div>

                                  

                                  {/* Action Buttons */}

                                  <div className="flex flex-col space-y-2 ml-4">

                                    {negotiation.status === 'negotiation' && (

                                      <>

                                        {canAccept(negotiation, negotiationGroup) && (

                                          <>

                                            <button

                                              onClick={() => {

                                                setSelectedNegotiation(negotiation);

                                                setResponseData({ action: 'accept', offerPrice: '', message: '' });

                                                setShowResponseForm(true);

                                              }}

                                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"

                                            >

                                              <CheckCircle className="w-4 h-4" />

                                              <span>Accept</span>

                                            </button>

                                            <button

                                              onClick={() => handleRejectOffer(negotiation)}

                                              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-1"

                                            >

                                              <XCircle className="w-4 h-4" />

                                              <span>Reject</span>

                                            </button>

                                          </>

                                        )}

                                        {hasAcceptedNegotiation(negotiationGroup) && (

                                          <div className="text-xs text-gray-500 text-center">

                                            Other bid accepted

                                          </div>

                                        )}

                                      </>

                                    )}

                                  </div>

                                </div>

                              </div>

                            ))}

                        </div>

                      </div>

                    );

                  })}

                </div>

              )}



              {/* Pagination */}

              {((activeTab === 'active' && totalPages > 1) || (activeTab === 'accepted' && acceptedTotalPages > 1)) && (

                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">

                  <div className="text-sm text-gray-700">

                    Showing {((activeTab === 'active' ? currentPage : acceptedPage) - 1) * limit + 1} to{' '}

                    {Math.min((activeTab === 'active' ? currentPage : acceptedPage) * limit, activeTab === 'active' ? total : acceptedTotal)} of{' '}

                    {activeTab === 'active' ? total : acceptedTotal} results

                  </div>

                  <div className="flex items-center space-x-2">

                    <button

                      onClick={() => {

                        if (activeTab === 'active') {

                          if (currentPage > 1) setCurrentPage(currentPage - 1);

                        } else {

                          if (acceptedPage > 1) setAcceptedPage(acceptedPage - 1);

                        }

                      }}

                      disabled={(activeTab === 'active' ? currentPage : acceptedPage) === 1}

                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"

                    >

                      Previous

                    </button>

                    <span className="px-3 py-2 text-sm font-medium text-gray-700">

                      Page {activeTab === 'active' ? currentPage : acceptedPage} of {activeTab === 'active' ? totalPages : acceptedTotalPages}

                    </span>

                    <button

                      onClick={() => {

                        if (activeTab === 'active') {

                          if (currentPage < totalPages) setCurrentPage(currentPage + 1);

                        } else {

                          if (acceptedPage < acceptedTotalPages) setAcceptedPage(acceptedPage + 1);

                        }

                      }}

                      disabled={(activeTab === 'active' ? currentPage : acceptedPage) >= (activeTab === 'active' ? totalPages : acceptedTotalPages)}

                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"

                    >

                      Next

                    </button>

                  </div>

                </div>

              )}

            </>

          )}

        </div>



        {/* Response Form Modal */}

        {showResponseForm && selectedNegotiation && (

          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">

            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">

              <div className="p-6">

                <div className="flex items-center justify-between mb-6">

                  <h3 className="text-lg font-semibold text-gray-900">

                    {responseData.action === 'accept' ? 'Accept Offer' : 'Make Counter Offer'}

                  </h3>

                  <button

                    onClick={() => setShowResponseForm(false)}

                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"

                  >

                    <X className="w-5 h-5 text-gray-500" />

                  </button>

                </div>



                <form onSubmit={(e) => { e.preventDefault(); handleRespond(); }} className="space-y-4">

                  {responseData.action === 'counter' && (

                    <div>

                      <label className="block text-sm font-medium text-gray-700 mb-2">

                        Counter Offer Price

                      </label>

                      <input

                        type="number"

                        step="0.01"

                        min="0"

                        value={responseData.offerPrice}

                        onChange={(e) => setResponseData({ ...responseData, offerPrice: e.target.value })}

                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                        placeholder="Enter your counter offer"

                        required

                      />

                    </div>

                  )}



                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">

                      Message

                    </label>

                    <textarea

                      value={responseData.message}

                      onChange={(e) => {

                        setResponseData({ ...responseData, message: e.target.value });

                        // Send typing indicator

                        if (socketService && selectedNegotiation._id) {

                          socketService.sendNegotiationTyping(selectedNegotiation._id, e.target.value.length > 0);

                        }

                      }}

                      onBlur={() => {

                        // Stop typing indicator when user stops typing

                        if (socketService && selectedNegotiation._id) {

                          socketService.sendNegotiationTyping(selectedNegotiation._id, false);

                        }

                      }}

                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                      rows={3}

                      placeholder="Add a message..."

                    />

                  </div>



                  <div className="flex space-x-3 pt-4">

                    <button

                      type="button"

                      onClick={() => setShowResponseForm(false)}

                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"

                    >

                      Cancel

                    </button>

                    <button

                      type="submit"

                      className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${

                        responseData.action === 'accept'

                          ? 'bg-green-600 hover:bg-green-700'

                          : 'bg-blue-600 hover:bg-blue-700'

                      }`}

                    >

                      {responseData.action === 'accept' ? 'Accept Offer' : 'Send Counter Offer'}

                    </button>

                  </div>

                </form>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>

  );

};



export default NegotiationModal;

