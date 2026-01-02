import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import toastHelper from "../../utils/toastHelper";
import SellerCategoryModal from "./SellerCategoryModal";
import { SellerCategoryService, SellerCategory } from "../../services/sellerCategory/sellerCategory.services";
import { useDebounce } from "../../hooks/useDebounce";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import { usePermissions } from "../../context/PermissionsContext";

const SellerCategoryTable: React.FC = () => {
  const { canWrite, canMarginUpdate } = useModulePermissions('/masters');
  const { permissions } = usePermissions();
  const isSuperAdmin = permissions?.role === 'superadmin';
  const [categoriesData, setCategoriesData] = useState<SellerCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editCategory, setEditCategory] = useState<SellerCategory | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const itemsPerPage = 10;
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchCategories();
  }, [currentPage, debouncedSearchTerm]);

  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await SellerCategoryService.getSellerCategoryList(
        currentPage,
        itemsPerPage,
        debouncedSearchTerm
      );

      setCategoriesData(response.data.docs);
      setTotalDocs(response.data.totalDocs || 0);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error("Failed to fetch seller categories:", error);
      setCategoriesData([]);
      setTotalPages(1);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (categoryData: any) => {
    try {
      if (editCategory && editCategory._id) {
        await SellerCategoryService.updateSellerCategory(editCategory._id, categoryData);
        toastHelper.showTost("Seller Category updated successfully!", "success");
      } else {
        await SellerCategoryService.createSellerCategory(categoryData);
        toastHelper.showTost("Seller Category added successfully!", "success");
      }
      setIsModalOpen(false);
      setEditCategory(null);
      fetchCategories();
    } catch (error) {
      console.error("Failed to save seller category:", error);
    }
  };

  const handleEdit = (category: SellerCategory) => {
    if (!canWrite) return;
    setEditCategory(category);
    setIsModalOpen(true);
  };

  const handleDelete = async (category: SellerCategory) => {
    if (!category._id) return;

    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel!",
    });

    if (confirmed.isConfirmed) {
      try {
        await SellerCategoryService.deleteSellerCategory(category._id);
        toastHelper.showTost("Seller Category deleted successfully!", "success");
        fetchCategories();
      } catch (error) {
        console.error("Failed to delete seller category:", error);
      }
    }
  };


  return (
    <div className="py-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search seller categories..."
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
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors"
              onClick={async () => {
                try {
                  await SellerCategoryService.downloadSample();
                } catch (error) {
                  console.error('Failed to download sample:', error);
                }
              }}
              title="Download Sample Excel"
            >
              <i className="fas fa-download text-xs"></i>
              Sample
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-purple-600 text-white px-4 py-2 text-sm font-medium hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 transition-colors"
              onClick={async () => {
                try {
                  await SellerCategoryService.exportToExcel();
                  fetchCategories();
                } catch (error) {
                  console.error('Failed to export:', error);
                }
              }}
              title="Export to Excel"
            >
              <i className="fas fa-file-export text-xs"></i>
              Export
            </button>
            {canWrite && (
              <>
                <label className="inline-flex items-center gap-1 rounded-lg bg-orange-600 text-white px-4 py-2 text-sm font-medium hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 transition-colors cursor-pointer">
                  <i className="fas fa-file-import text-xs"></i>
                  Import
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          await SellerCategoryService.importFromExcel(file);
                          fetchCategories();
                        } catch (error) {
                          console.error('Failed to import:', error);
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                  onClick={() => {
                    setEditCategory(null);
                    setIsModalOpen(true);
                  }}
                >
                  <i className="fas fa-plus text-xs"></i>
                  Add Category
                </button>
              </>
            )}
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Title
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Description
                </th>
                {canMarginUpdate && (
                  <>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Margin Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                      Margin
                    </th>
                  </>
                )}
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={canMarginUpdate ? 5 : 3} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Seller Categories...
                    </div>
                  </td>
                </tr>
              ) : categoriesData.length === 0 ? (
                <tr>
                  <td colSpan={canMarginUpdate ? 5 : 3} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No seller categories found
                    </div>
                  </td>
                </tr>
              ) : (
                categoriesData.map((item: SellerCategory, index: number) => (
                  <tr
                    key={item._id || index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {item.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.description || "-"}
                    </td>
                    {canMarginUpdate && (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {item.marginType || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {item.margin !== undefined && item.margin !== null 
                            ? item.marginType === 'percentage' 
                              ? `${item.margin}%` 
                              : item.margin
                            : "-"}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-sm text-center">
                      {canWrite ? (
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                            title="Edit Category"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                              title="Delete Category"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
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

        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
            Showing {categoriesData.length} of {totalDocs} items
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

      <SellerCategoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditCategory(null);
        }}
        onSave={handleSave}
        editItem={editCategory || undefined}
        allowMarginEdit={canMarginUpdate}
      />
    </div>
  );
};

export default SellerCategoryTable;

