import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import CostModuleModal from "./CostModuleModal";
import { CostModuleService } from "../../services/costModule/costModule.services";
import { useDebounce } from "../../hooks/useDebounce";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import { usePermissions } from "../../context/PermissionsContext";

// Define the interface for CostModule data
interface CostModule {
  _id?: string;
  name: string;
  name2?: string;
  countries: string[];
  remark: string;
  message?: string;
  costType: "Percentage" | "Fixed";
  costField: "product" | "delivery";
  costUnit?: "pc" | "kg" | "moq" | "order amount" | "cart quantity";
  value: number;
  minValue?: number;
  maxValue?: number;
  groupId?: string;
  isExpressDelivery?: boolean;
  isSameLocationCharge?: boolean;
  isDeleted: boolean;
}

const CostModuleTable: React.FC = () => {
  const { canWrite } = useModulePermissions('/configuration');
  const { permissions } = usePermissions();
  const isSuperAdmin = permissions?.role === 'superadmin';
  const [costModules, setCostModules] = useState<CostModule[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editItem, setEditItem] = useState<CostModule | undefined>(undefined);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [totalDocs, setTotalDocs] = useState<number>(0);

  // Fetch cost modules on component mount and when searchTerm or currentPage changes
  const fetchCostModules = async () => {
    setLoading(true);
    try {
      const response = await CostModuleService.listCostModules({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
      });
      if (response.status === 200 && response.data) {
        setCostModules(response.data.docs);
        setTotalPages(response.data.totalPages);
        setTotalDocs(response.data.totalDocs || 0);
      }
    } catch (error) {
      console.error("Error fetching cost modules:", error);
      setCostModules([]);
      setTotalPages(1);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostModules();
  }, [currentPage, debouncedSearchTerm]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const handleSave = async (newItem: CostModule) => {
    try {
      if (editItem && editItem._id) {
        // Update existing cost module
        const updates = {
          name: newItem.name,
          name2: newItem.name2,
          countries: newItem.countries,
          remark: newItem.remark,
          costType: newItem.costType,
          costField: newItem.costField,
          costUnit: newItem.costUnit,
          value: newItem.value,
          minValue: newItem.minValue,
          maxValue: newItem.maxValue,
          groupId: newItem.groupId,
          isExpressDelivery: newItem.isExpressDelivery,
          isSameLocationCharge: newItem.isSameLocationCharge,
        };
        await CostModuleService.updateCostModule(editItem._id, updates);
      } else {
        // Create new cost module
        await CostModuleService.createCostModule({
          name: newItem.name,
          name2: newItem.name2,
          countries: newItem.countries,
          remark: newItem.remark,
          costType: newItem.costType,
          costField: newItem.costField,
          costUnit: newItem.costUnit,
          value: newItem.value,
          minValue: newItem.minValue,
          maxValue: newItem.maxValue,
          groupId: newItem.groupId,
          isExpressDelivery: newItem.isExpressDelivery,
          isSameLocationCharge: newItem.isSameLocationCharge,
          isDeleted: newItem.isDeleted,
        });
      }
      // Refresh the list after save
      await fetchCostModules();
      setIsModalOpen(false);
      setEditItem(undefined);
    } catch (error) {
      console.error("Error saving cost module:", error);
    }
  };

  const handleEdit = (item: CostModule) => {
    setEditItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the cost module!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete!",
      cancelButtonText: "No, cancel!",
    });

    if (confirmed.isConfirmed) {
      try {
        await CostModuleService.deleteCostModule(id);
        // Refresh the list after delete
        await fetchCostModules();
      } catch (error) {
        console.error("Error deleting cost module:", error);
      }
    }
  };

  // Paginated data (server-side pagination)
  const paginatedData = costModules;

  return (
    <div className="p-4">
      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        {/* Table Header with Controls */}
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 w-full">
            {" "}
            {/* Changed w-[85%] to w-full */}
            {/* Search */}
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by name, remark, or country..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {canWrite && (
            <button
              className="inline-flex items-center whitespace-nowrap gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              onClick={() => {
                setEditItem(undefined);
                setIsModalOpen(true);
              }}
            >
              <i className="fas fa-plus text-xs"></i>
              Add Cost
            </button>
          )}
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Name2
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Countries
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Remark
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Cost Type
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Cost Field
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Cost Unit
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Value
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Min Value
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Max Value
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Group ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Express Delivery
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Same Location
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Cost Modules...
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No cost modules found
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item: CostModule) => (
                  <tr
                    key={item._id}
                    className={`transition-colors ${
                      item.isDeleted
                        ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.name2 || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.countries.join(", ") || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.remark}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          item.costType === "Percentage"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700"
                        }`}
                      >
                        {item.costType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="capitalize">{item.costField || "-"}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="capitalize">{item.costUnit ? item.costUnit.replace("order amount", "Order Amount") : "-"}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.value}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.minValue !== undefined ? item.minValue : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.maxValue !== undefined ? item.maxValue : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.groupId ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-700">
                          {item.groupId}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.isExpressDelivery ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700">
                          <i className="fas fa-check-circle"></i>
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.isSameLocationCharge ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700">
                          <i className="fas fa-check-circle"></i>
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {canWrite ? (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Edit Cost Module"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDelete(item._id!)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Delete Cost Module"
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

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
            Showing {paginatedData.length} of {totalDocs} items
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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

      <CostModuleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditItem(undefined);
        }}
        onSave={handleSave}
        editItem={editItem}
      />
    </div>
  );
};

export default CostModuleTable;
