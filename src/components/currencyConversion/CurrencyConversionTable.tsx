import React, { useState, useEffect } from 'react';
// import Swal from 'sweetalert2';
import { CurrencyConversionService, CurrencyConversion } from '../../services/currencyConversion/currencyConversion.services';
import toastHelper from '../../utils/toastHelper';
import CurrencyConversionModal from './CurrencyConversionModal.tsx';
import { useDebounce } from '../../hooks/useDebounce';
import { useModulePermissions } from '../../hooks/useModulePermissions';
import { FaEdit } from 'react-icons/fa';

const CurrencyConversionTable: React.FC = () => {
  const { canWrite } = useModulePermissions('/currency-conversion');
  const [currencyConversions, setCurrencyConversions] = useState<CurrencyConversion[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, [currentPage, debouncedSearchTerm]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await CurrencyConversionService.listCurrencyConversions({
        page: currentPage,
        limit: itemsPerPage,
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      });
      
      if (response.data?.docs) {
        console.log("Fetched Currency Conversion data:", response.data.docs);
        setCurrencyConversions(response.data.docs);
        setTotalDocs(response.data.totalDocs || 0);
      } else {
        console.log("No currency conversion data received");
        setCurrencyConversions([]);
        setTotalDocs(0);
      }
    } catch (err: any) {
      console.error("Error fetching currency conversions:", err);
      
      if (err.message?.includes('Authentication required')) {
        toastHelper.showTost("Please login to access currency conversions", "error");
      } else if (err.message?.includes('API endpoint not found')) {
        toastHelper.showTost("Currency conversion feature is not available. Please contact administrator.", "error");
      } else {
        toastHelper.showTost("Failed to fetch currency conversions", "error");
      }
      
      setCurrencyConversions([]);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (editId) {
        await CurrencyConversionService.updateCurrencyConversion(editId, formData);
      } else {
        await CurrencyConversionService.createCurrencyConversion(formData);
      }
      fetchData();
      setIsModalOpen(false);
      setEditId(null);
    } catch (err: any) {
      console.error("Error saving currency conversion:", err);
      
      // Error message is already shown by the service, but we can add additional handling if needed
      if (err.message?.includes('Authentication required')) {
        toastHelper.showTost("Please login to save currency conversions", "error");
      } else if (err.message?.includes('API endpoint not found')) {
        toastHelper.showTost("Currency conversion feature is not available. Please contact administrator.", "error");
      } else if (err.message) {
        // Service already shows the error toast, so we don't need to show it again
        // Just log it for debugging
      } else {
        toastHelper.showTost("Failed to save currency conversion", "error");
      }
    }
  };

  const handleEdit = (id: string) => {
    console.log("HandleEdit called with ID:", id);
    const selectedItem = currencyConversions.find((item) => item._id === id);
    console.log("Selected item for edit:", selectedItem);
    
    setIsModalOpen(false);
    setEditId(null);
    
    setTimeout(() => {
      setEditId(id);
      setIsModalOpen(true);
    }, 50);
  };

  // Note: Currency conversions cannot be deleted according to the service
  // Delete functionality has been removed from the service

  const totalPages = Math.ceil(totalDocs / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getEditItem = () => {
    if (!editId) return null;
    return currencyConversions.find((item) => item._id === editId) || null;
  };

  return (
    <div className="py-4">
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
                placeholder="Search by currency code..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Currency Code
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Rate
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Updated At
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Currency Conversions...
                    </div>
                  </td>
                </tr>
              ) : currencyConversions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No currency conversions found
                    </div>
                  </td>
                </tr>
              ) : (
                currencyConversions.map((conversion, index) => (
                  <tr
                    key={conversion._id || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      {conversion.currencyCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {typeof conversion.rate === 'number' ? conversion.rate.toFixed(4) : parseFloat(conversion.rate || '0').toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {
  conversion.updatedAt
    ? new Date(conversion.updatedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-'
}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {canWrite ? (
                        <button
                          onClick={() => handleEdit(conversion._id!)}
                          className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                          title="Edit Currency Conversion"
                        >
                          {/* <i className="fas fa-edit"></i> */}
                          <FaEdit className="w-[16px] h-[16px]"/>
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">View Only</span>
                      )}
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

      {/* Modal */}
      <CurrencyConversionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditId(null);
        }}
        onSave={handleSave}
        editItem={getEditItem()}
      />
    </div>
  );
};

export default CurrencyConversionTable;
