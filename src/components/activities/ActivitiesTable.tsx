import React, { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import Swal from 'sweetalert2'
import VersionProductService, { ProductVersionHistoryQuery, ProductsWithCountsQuery } from '../../services/versioning/versionProduct.services'
import VersionOrderService, { OrderVersionHistoryQuery, OrdersWithCountsQuery } from '../../services/versioning/versionOrder.services'
// import placeholderImage from '../../../public/images/product/noimage.jpg'
import toastHelper from '../../utils/toastHelper'
import { AdminOrderService, TrackingItem } from '../../services/order/adminOrder.services'
import { LOCAL_STORAGE_KEYS } from '../../constants/localStorage'
import { useDebounce } from '../../hooks/useDebounce'

interface VersionRowItem {
	_id?: string
	productId: string
	version: number
	data: any 
	status?: string
}

const ActivitiesTable = () => {
  const [items, setItems] = useState<VersionRowItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [page, setPage] = useState<number>(1)
  const [limit] = useState<number>(10)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const debouncedSearchTerm = useDebounce(searchTerm, 1000)
  const [totalDocs, setTotalDocs] = useState<number>(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalDocs / limit)), [totalDocs, limit])
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')
  const [currentAdminId, setCurrentAdminId] = useState<string>('')

  useEffect(() => {
    const adminId = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_ID) || ''
    setCurrentAdminId(adminId)
  }, [])


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        if (activeTab === 'products') {
        const countsBody: ProductsWithCountsQuery = { page: 1, limit: 1, search: debouncedSearchTerm || undefined }
        const countsRes = await VersionProductService.fetchProductsWithCounts(countsBody)
        const countsPayload = countsRes?.data?.data || countsRes?.data
        const firstProduct = countsPayload?.docs?.[0]
        const productId: string | undefined = firstProduct?._id || firstProduct?.productId

        if (!productId) {
          setItems([])
          setTotalDocs(0)
          return
        }

        const historyBody: ProductVersionHistoryQuery = { productId, page, limit }
        const res = await VersionProductService.fetchHistory(historyBody)
        const payload = res?.data?.data || res?.data
        const docs = payload?.docs || []
        setItems(docs)
        setTotalDocs(payload?.totalDocs || docs.length)
        } else {
          // Step 1: Find an orderId to query history for, honoring the search term if any
          const countsBody: OrdersWithCountsQuery = { page: 1, limit: 100 }
          const countsRes = await VersionOrderService.fetchOrdersWithCounts(countsBody)
          const countsPayload = countsRes?.data?.data || countsRes?.data
          const firstOrder = countsPayload?.docs?.[0]
          const orderId: string | undefined = firstOrder?._id || firstOrder?.orderId

          if (!orderId) {
            setItems([])
            setTotalDocs(0)
            return
          }

          // Step 2: Fetch order version history for the discovered orderId
          const historyBody: OrderVersionHistoryQuery = { orderId, page, limit }
          const res = await VersionOrderService.fetchHistory(historyBody)
          const payload = res?.data?.data || res?.data
          const docs = payload?.docs || []
          setItems(docs)
          setTotalDocs(payload?.totalDocs || docs.length)
        }
      } catch (err: any) {
        setItems([])
        setTotalDocs(0)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [page, limit, debouncedSearchTerm, activeTab])

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setPage(1);
    }
  }, [debouncedSearchTerm])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setPage(1)
  }

  const formatExpiryTime = (iso?: string) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return '—'
      return format(d, 'dd MMM yyyy, HH:mm')
    } catch {
      return '—'
    }
  }

  const handleView = async (row: any) => {
    try {
      const productId = row?.productId || row?._id || row?.data?._id
      const rawVersion = row?.version ?? row?.data?.version
      const version = typeof rawVersion === 'string' ? parseInt(rawVersion, 10) : rawVersion
      let data = row?.productData || row?.data || row
      if (productId && typeof version === 'number') {
        // Try to fetch exact snapshot for accuracy
        const res = await VersionProductService.fetchVersion({ productId, version })
        // APIs in this module return payload under `data` key (res.data.data)
        data = res?.data?.data || data
      }
      const createdAt = row?.createdAt
      setSelectedItem(createdAt ? { ...data, __createdAt: createdAt } : data)
      setIsViewOpen(true)
    } catch {
      // toast already handled in service on error
    }
  }

  const handleRestore = async (row: any) => {
    try {
      const productId = row?.productId || row?._id || row?.data?._id
      const rawVersion = row?.version ?? row?.data?.version
      const version = typeof rawVersion === 'string' ? parseInt(rawVersion, 10) : rawVersion
      if (!productId || typeof version !== 'number') {
        toastHelper.showTost('Missing product or version', 'error')
        return
      }
      const result = await Swal.fire({
        title: 'Restore this version?',
        text: 'This will replace the current product with the selected version.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, restore',
        cancelButtonText: 'No, cancel',
      })

      if (result.isConfirmed) {
        const reason = 'Admin restore'
        await VersionProductService.restoreVersion({ productId, version, changeReason: reason })
        toastHelper.showTost('Version restored successfully', 'success')
        // Refresh list after restore
        setPage(1)
      }
    } catch {
      // errors toasted in service
    }
  }

  const handleOrderRestore = async (row: any) => {
    try {
      const orderId = row?.orderId || row?._id || row?.data?._id
      const rawVersion = row?.version ?? row?.data?.version
      const version = typeof rawVersion === 'string' ? parseInt(rawVersion, 10) : rawVersion
      if (!orderId || typeof version !== 'number') {
        toastHelper.showTost('Missing order or version', 'error')
        return
      }
      const result = await Swal.fire({
        title: 'Restore this version?',
        text: 'This will replace the current order with the selected version.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, restore',
        cancelButtonText: 'No, cancel',
      })

      if (result.isConfirmed) {
        const reason = 'Admin restore'
        await VersionOrderService.restoreVersion({ orderId, version, changeReason: reason })
        toastHelper.showTost('Version restored successfully', 'success')
        setPage(1)
      }
    } catch {
      // errors toasted in service
    }
  }

  const handleViewTracking = async (orderId: string) => {
    try {
      const response = await AdminOrderService.getOrderTracking(orderId)
      const trackingItems: TrackingItem[] = response.data.docs

      if (trackingItems.length === 0) {
        await Swal.fire({
          title: 'No Tracking Information',
          text: 'No tracking details are available for this order.',
          icon: 'info',
          confirmButtonText: 'OK',
        })
        return
      }

      const trackingHtml = `
        <div style="text-align: left;">
          <h3 style="margin-bottom: 16px;">Tracking Details for Order ${orderId}</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f4f4f4;">
                <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Changed By</th>
                <th style="padding: 8px; border: 1px solid #ddd;">User Type</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Changed At</th>
                <th style="padding: 8px; border: 1px solid #ddd;">Message</th>
              </tr>
            </thead>
            <tbody>
              ${trackingItems
                .map(
                  (item) => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;">
                        ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </td>
                      <td style="padding: 8px; border: 1px solid #ddd;">
                        ${item?.changedBy?.name || '-'}
                      </td>
                      <td style="padding: 8px; border: 1px solid #ddd;">
                        ${item.userType}
                      </td>
                      <td style="padding: 8px; border: 1px solid #ddd;">
                        ${format(new Date(item.changedAt), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td style="padding: 8px; border: 1px solid #ddd;">
                        ${item.message || '-'}
                      </td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `

      await Swal.fire({
        title: 'Order Tracking',
        html: trackingHtml,
        width: 800,
        showConfirmButton: true,
        confirmButtonText: 'Close',
      })
    } catch (error) {
      console.error('Failed to fetch tracking:', error)
      toastHelper.showTost('Failed to fetch tracking details', 'error')
    }
  }

  const getStatusBadge = (order: any) => {
    const statusStyles: { [key: string]: string } = {
      request: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700',
      verified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700',
      approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700',
      shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-700',
      delivered: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-700',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700',
      accepted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700',
      cancel: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700',
    }

    const statusIcons: { [key: string]: string } = {
      request: 'fa-clock',
      verified: 'fa-check',
      approved: 'fa-check-circle',
      shipped: 'fa-truck',
      delivered: 'fa-box',
      cancelled: 'fa-times',
      accepted: 'fa-handshake',
      cancel: 'fa-exclamation-triangle',
    }

    let displayStatus = order?.status

    if (order?.orderTrackingStatus === 'cancel') {
      if (order?.verifiedBy && order?.approvedBy) {
        displayStatus = 'cancel'
      } else if (order?.verifiedBy) {
        displayStatus = 'verified'
      } else {
        displayStatus = 'cancel'
      }
    } else {
      if (order?.approvedBy) {
        displayStatus = 'approved'
      } else if (order?.verifiedBy) {
        displayStatus = 'verified'
      } else {
        displayStatus = order?.status
      }
    }

    const isVerifiedByOtherAdmin = order?.orderTrackingStatus === 'verified' && order?.verifiedBy !== currentAdminId
    const isInCancellationFlow = order?.orderTrackingStatus === 'cancel'
    const showOnlyIcons = isInCancellationFlow && (order?.verifiedBy || order?.approvedBy)

    return (
      <span className="inline-flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${
            statusStyles[displayStatus] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
          }`}
        >
          <i className={`fas ${statusIcons[displayStatus] || 'fa-info-circle'} text-xs`}></i>
          {!showOnlyIcons && displayStatus?.charAt(0).toUpperCase() + displayStatus?.slice(1)}
        </span>
        {isInCancellationFlow && (
          <>
            {order?.verifiedBy && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 border border-blue-200" title="Verified by admin">
                <i className="fas fa-check text-xs"></i>
              </span>
            )}
            {order?.approvedBy && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200" title="Approved by admin">
                <i className="fas fa-check-circle text-xs"></i>
              </span>
            )}
          </>
        )}
        {isVerifiedByOtherAdmin && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200" title="This order has been verified by another admin">
            <i className="fas fa-info-circle text-xs"></i>
            Verified
          </span>
        )}
      </span>
    )
  }

  return (
    <>
    <div className="p-4">
      {/* Professional Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'products'
                  ? 'border-[#0071E0] text-[#0071E0] dark:text-[#0071E0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('products')}
            >
              Products
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === 'orders'
                  ? 'border-[#0071E0] text-[#0071E0] dark:text-[#0071E0]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('orders')}
            >
              Orders
            </button>
          </nav>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">

        {activeTab === 'products' ? (
          <>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1">
                  <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    placeholder="Search by SKU Family Name or other..."
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3"></div>
            </div>

            <div className="max-w-full overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-100 dark:bg-gray-900">
                  <tr>
                    {/* <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Image
                    </th> */}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Sub Sku Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      SIM Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Color
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      RAM
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Storage
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Created At
                    </th>
                    {/* <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Status
                    </th> */}
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center">
                        <div className="text-gray-500 dark:text-gray-400 text-lg">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                          Loading Products...
                        </div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center">
                        <div className="text-gray-500 dark:text-gray-400 text-lg">
                          No items to display
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any, index: number) => {
                      const product = item?.productData || item?.data || item
                      const skuFamily = product?.skuFamilyId
                      const subSkuFamily = product?.subSkuFamilyId
                      // const images: string[] = (skuFamily?.images || product?.images || []) as string[]
                      // const imageUrl = images?.[0] || placeholderImage
                      return (
                        <tr key={`${item.productId || item._id}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          {/* <td className="px-6 py-4 align-middle">
                            <img src={imageUrl} alt="Product" className="h-10 w-10 object-cover rounded" />
                          </td> */}
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">
                            {skuFamily?.name || product?.name || '—'}
                          </td>
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">
                            {subSkuFamily?.name || '—'}
                          </td>
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">{product?.simType || '—'}</td>
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">{product?.color || '—'}</td>
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">{product?.ram || '—'}</td>
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">{product?.storage || '—'}</td>
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">{product?.price ?? '—'}</td>
                          <td className="px-6 py-4 align-middle text-sm text-gray-700 dark:text-gray-200">{formatExpiryTime(item?.createdAt)}</td>
                          {/* <td className="px-6 py-4 align-middle text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${product?.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                              {product?.status || '—'}
                            </span>
                          </td> */}
                          <td className="px-6 py-4 align-middle text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                title="View"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => handleView(item)}
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              <button
                                title="Restore"
                                className="text-amber-600 hover:text-amber-700"
                                onClick={() => handleRestore(item)}
                              >
                                <i className="fas fa-rotate-left"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-300">Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className={`px-3 py-1 rounded border text-sm ${page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}>Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={`px-3 py-1 rounded border text-sm ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1">
                  <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    placeholder="Search by order Name or customer..."
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
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
                      <td colSpan={6} className="p-12 text-center">
                        <div className="text-gray-500 dark:text-gray-400 text-lg">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                          Loading Orders...
                        </div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <div className="text-gray-500 dark:text-gray-400 text-lg">
                          No orders found
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any, index: number) => {
                      const order = item?.orderData || item?.data || item
                      return (
                        <tr key={`${order?._id || item?._id}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {order?.customerId?.name || order?.customerId?.email || order?.customerId?._id}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {(order?.cartItems || []).map((ci: any) => (
                              <div key={ci?.productId?._id}>
                                {ci?.skuFamilyId?.name || ci?.productId?.name} (x{ci?.quantity})
                              </div>
                            ))}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            ${typeof order?.totalAmount === 'number' ? order.totalAmount.toFixed(2) : (parseFloat(order?.totalAmount || '0') || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {item?.createdAt
                              ? format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm')
                              : order?.createdAt
                              ? format(new Date(order.createdAt), 'dd MMM yyyy, HH:mm')
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            {getStatusBadge(order)}
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => handleViewTracking(order?._id || item?.orderId || item?._id)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                title="View Tracking"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              <button
                                title="Restore"
                                className="text-amber-600 hover:text-amber-700"
                                onClick={() => handleOrderRestore(item)}
                              >
                                <i className="fas fa-rotate-left"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-300">Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className={`px-3 py-1 rounded border text-sm ${page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}>Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={`px-3 py-1 rounded border text-sm ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}>Next</button>
              </div>
          </div>
          </>
        )}
      </div>
    </div>
    {isViewOpen && selectedItem && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => setIsViewOpen(false)}></div>
        <div className="relative z-10 w-full max-w-3xl mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Product Details (Version View)</h3>
            <button onClick={() => setIsViewOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-300">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center gap-4">
              {/* <img
                src={(selectedItem?.skuFamilyId?.images?.[0] || selectedItem?.images?.[0] || placeholderImage) as string}
                alt="Product"
                className="h-16 w-16 rounded object-cover"
              /> */}
              <div>
                <div className="text-sm text-gray-700 dark:text-gray-300">Created At</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedItem?.__createdAt ? format(new Date(selectedItem.__createdAt), 'dd MMM yyyy, HH:mm') : '—'}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.skuFamilyId?.name || selectedItem?.name || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sub Sku Name</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.subSkuFamilyId?.name || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SIM Type</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.simType || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.color || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RAM</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.ram || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Storage</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.storage || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.price ?? '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{selectedItem?.country || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">{formatExpiryTime(selectedItem?.expiryTime)}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setIsViewOpen(false)} className="px-4 py-2 rounded border text-sm">Close</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default ActivitiesTable
