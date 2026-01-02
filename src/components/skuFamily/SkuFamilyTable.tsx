// SkuFamilyTable.tsx
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { SkuFamilyService } from "../../services/skuFamily/skuFamily.services";
import { SubSkuFamilyService } from "../../services/skuFamily/subSkuFamily.services";
import toastHelper from "../../utils/toastHelper";
import SkuFamilyModal from "./SkuFamilyModal";
import SubSkuFamilyModal from "./SubSkuFamilyModal";
import placeholderImage from "../../../public/images/product/noimage.jpg";
import { SkuFamily } from "./types";
import { useDebounce } from "../../hooks/useDebounce";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import { usePermissions } from "../../context/PermissionsContext";

const SkuFamilyTable: React.FC = () => {
  const { canWrite } = useModulePermissions('/sku-family');
  const { permissions } = usePermissions();
  const isSuperAdmin = permissions?.role === 'superadmin';
  const [skuFamilyData, setSkuFamilyData] = useState<SkuFamily[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  // Removed dropdown state since inline actions are used
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedSkuFamily, setSelectedSkuFamily] = useState<SkuFamily | null>(
    null
  );
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [editingSequenceValue, setEditingSequenceValue] = useState<string>("");
  const [editingSubSequenceId, setEditingSubSequenceId] = useState<string | null>(null);
  const [editingSubSequenceValue, setEditingSubSequenceValue] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [subSkuFamilyModalOpen, setSubSkuFamilyModalOpen] = useState<boolean>(false);
  const [selectedSkuFamilyForSub, setSelectedSkuFamilyForSub] = useState<string | null>(null);
  const [editingSubSkuFamilyId, setEditingSubSkuFamilyId] = useState<string | null>(null);
  const [editingSubSkuFamily, setEditingSubSkuFamily] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const itemsPerPage = 10;
  
  // Sub SKU Family pagination state - stores pagination info per SKU Family
  const [subSkuFamilyData, setSubSkuFamilyData] = useState<Record<string, {
    docs: any[];
    totalDocs: number;
    totalPages: number;
    currentPage: number;
    loading: boolean;
  }>>({});
  const [subSkuFamilySearch, setSubSkuFamilySearch] = useState<Record<string, string>>({});
  const debouncedSubSkuFamilySearch = useDebounce(subSkuFamilySearch, 500);
  const subSkuFamilyItemsPerPage = 5;

  // Helper function to get video URL
  const getVideoUrl = (path: string): string => {
    if (!path) return "";
    const base = (import.meta as any).env?.VITE_BASE_URL || "";
    const isAbsolute = /^https?:\/\//i.test(path);
    return isAbsolute
      ? path
      : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, debouncedSearchTerm]);

  // Fetch sub SKU families when a row is expanded
  useEffect(() => {
    expandedRows.forEach((skuFamilyId) => {
      if (skuFamilyId && !subSkuFamilyData[skuFamilyId]) {
        fetchSubSkuFamilies(skuFamilyId, 1);
      }
    });
  }, [expandedRows]);

  // Handle debounced search for sub SKU families
  useEffect(() => {
    Object.keys(debouncedSubSkuFamilySearch).forEach((skuFamilyId) => {
      if (expandedRows.has(skuFamilyId)) {
        const searchTerm = debouncedSubSkuFamilySearch[skuFamilyId] || '';
        fetchSubSkuFamilies(skuFamilyId, 1, searchTerm);
      }
    });
  }, [debouncedSubSkuFamilySearch]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target) return;
      if (!(event.target as HTMLElement).closest(".dropdown-container")) {
        setOpenDropdownId(null);
      }
    };

    const handleResize = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      window.removeEventListener("resize", handleResize);
    };
  }, [openDropdownId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await SkuFamilyService.getSkuFamilyList(
        currentPage,
        itemsPerPage,
        debouncedSearchTerm.trim()
      );
      if (response.data?.docs) {
        console.log("Fetched SKU Family data:", response.data.docs); // Debug log
        setSkuFamilyData(response.data.docs);
        setTotalDocs(response.data.totalDocs || 0);
      } else {
        setSkuFamilyData([]);
        setTotalDocs(0);
      }
    } catch (err: any) {
      console.error("Error fetching SKU families:", err);
      toastHelper.showTost("Failed to fetch SKU families", "error");
      setSkuFamilyData([]);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubSkuFamilies = async (skuFamilyId: string, page: number, search?: string) => {
    // Set loading state for this specific SKU Family
    setSubSkuFamilyData(prev => ({
      ...prev,
      [skuFamilyId]: {
        ...prev[skuFamilyId],
        loading: true,
      }
    }));

    try {
      const searchTerm = search !== undefined ? search : (subSkuFamilySearch[skuFamilyId] || '');
      const response = await SubSkuFamilyService.getSubSkuFamilyList(
        page,
        subSkuFamilyItemsPerPage,
        skuFamilyId,
        searchTerm.trim()
      );
      
      if (response.data?.docs) {
        setSubSkuFamilyData(prev => ({
          ...prev,
          [skuFamilyId]: {
            docs: response.data.docs,
            totalDocs: response.data.totalDocs || 0,
            totalPages: response.data.totalPages || 1,
            currentPage: response.data.page || 1,
            loading: false,
          }
        }));
      } else {
        setSubSkuFamilyData(prev => ({
          ...prev,
          [skuFamilyId]: {
            docs: [],
            totalDocs: 0,
            totalPages: 1,
            currentPage: 1,
            loading: false,
          }
        }));
      }
    } catch (err: any) {
      console.error("Error fetching Sub SKU families:", err);
      toastHelper.showTost("Failed to fetch Sub SKU families", "error");
      setSubSkuFamilyData(prev => ({
        ...prev,
        [skuFamilyId]: {
          ...prev[skuFamilyId],
          loading: false,
        }
      }));
    }
  };


  const handleSave = async (formData: FormData) => {
    try {
      let response;
      if (editId) {
        response = await SkuFamilyService.updateSkuFamily(editId, formData);
      } else {
        response = await SkuFamilyService.createSkuFamily(formData);
      }
      fetchData();
      setIsModalOpen(false);
      setEditId(null);
      return response; // Return response so modal can get the created ID
    } catch (err: any) {
      console.error("Error saving SKU family:", err);
      toastHelper.showTost("Failed to save SKU family", "error");
      throw err; // Re-throw to let modal handle it
    }
  };

  const handleEdit = (id: string) => {
    console.log("HandleEdit called with ID:", id);
    const selectedItem = skuFamilyData.find((item) => item._id === id);
    console.log("Selected item for edit:", selectedItem); // Debug log

    // Close modal first to reset state
    setIsModalOpen(false);
    setEditId(null);

    // Use setTimeout to ensure state is reset before opening again
    setTimeout(() => {
      setEditId(id);
      setIsModalOpen(true);
    }, 50);
    setOpenDropdownId(null);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete the SKU Family!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel!",
    });

    if (confirmed.isConfirmed) {
      try {
        await SkuFamilyService.deleteSkuFamily(id);
        fetchData();
      } catch (err: any) {
        console.error("Error deleting SKU family:", err);
        toastHelper.showTost("Failed to delete SKU family", "error");
      }
    }
    setOpenDropdownId(null);
  };

  const handleSequenceSave = async (item: SkuFamily) => {
    if (!item._id) return;
    const sequence = parseInt(editingSequenceValue);
    if (isNaN(sequence) || sequence < 1) {
      toastHelper.showTost("Sequence must be a valid number (0 or higher)", "error");
      setEditingSequenceId(null);
      setEditingSequenceValue("");
      return;
    }
    try {
      await SkuFamilyService.updateSequence(item._id, sequence);
      setEditingSequenceId(null);
      setEditingSequenceValue("");
      fetchData();
    } catch (err: any) {
      console.error("Error updating sequence:", err);
      setEditingSequenceId(null);
      setEditingSequenceValue("");
    }
  };

  const handleView = (skuFamily: SkuFamily) => {
    setSelectedSkuFamily(skuFamily);
    setOpenDropdownId(null);
  };

  const handleAddSubSkuFamily = (skuFamilyId: string) => {
    setSelectedSkuFamilyForSub(skuFamilyId);
    setEditingSubSkuFamilyId(null);
    setEditingSubSkuFamily(null);
    setSubSkuFamilyModalOpen(true);
  };

  const handleEditSubSkuFamily = (skuFamilyId: string, subSkuFamily: any) => {
    setSelectedSkuFamilyForSub(skuFamilyId);
    setEditingSubSkuFamilyId(subSkuFamily._id);
    setEditingSubSkuFamily(subSkuFamily);
    setSubSkuFamilyModalOpen(true);
  };

  const handleSaveSubSkuFamily = async (formData: FormData) => {
    try {
      if (!selectedSkuFamilyForSub) return;
      
      if (editingSubSkuFamilyId && editingSubSkuFamily) {
        await SkuFamilyService.updateSubSkuFamily(selectedSkuFamilyForSub, editingSubSkuFamilyId, formData);
      } else {
        await SkuFamilyService.addSubSkuFamily(selectedSkuFamilyForSub, formData);
      }
      fetchData();
      // Refresh sub SKU families for the current SKU Family
      if (selectedSkuFamilyForSub && subSkuFamilyData[selectedSkuFamilyForSub]) {
        const currentPage = subSkuFamilyData[selectedSkuFamilyForSub].currentPage;
        fetchSubSkuFamilies(selectedSkuFamilyForSub, currentPage);
      }
      setSubSkuFamilyModalOpen(false);
      setSelectedSkuFamilyForSub(null);
      setEditingSubSkuFamilyId(null);
      setEditingSubSkuFamily(null);
    } catch (err: any) {
      console.error("Error saving Sub SKU family:", err);
      toastHelper.showTost("Failed to save Sub SKU family", "error");
      throw err; // Re-throw to let modal handle it
    }
  };

  const handleDeleteSubSkuFamily = async (skuFamilyId: string, subSkuFamilyId: string) => {
    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete the Sub SKU Family!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel!",
    });

    if (confirmed.isConfirmed) {
      try {
        await SkuFamilyService.deleteSubSkuFamily(skuFamilyId, subSkuFamilyId);
        fetchData();
        // Refresh sub SKU families for the current SKU Family
        if (subSkuFamilyData[skuFamilyId]) {
          const currentPage = subSkuFamilyData[skuFamilyId].currentPage;
          fetchSubSkuFamilies(skuFamilyId, currentPage);
        }
      } catch (err: any) {
        console.error("Error deleting Sub SKU family:", err);
        toastHelper.showTost("Failed to delete Sub SKU family", "error");
      }
    }
  };

  const handleSubSequenceSave = async (skuFamilyId: string, subSkuFamilyId: string, sequence: number) => {
    if (!skuFamilyId || !subSkuFamilyId) return;
    if (isNaN(sequence) || sequence < 1) {
      toastHelper.showTost("Sequence must be a valid number (1 or higher)", "error");
      setEditingSubSequenceId(null);
      setEditingSubSequenceValue("");
      return;
    }
    try {
      await SkuFamilyService.updateSubSkuFamilySequence(skuFamilyId, subSkuFamilyId, sequence);
      setEditingSubSequenceId(null);
      setEditingSubSequenceValue("");
      fetchData();
      // Refresh sub SKU families for the current SKU Family
      if (subSkuFamilyData[skuFamilyId]) {
        const currentPage = subSkuFamilyData[skuFamilyId].currentPage;
        fetchSubSkuFamilies(skuFamilyId, currentPage);
      }
    } catch (err: any) {
      console.error("Error updating sub sequence:", err);
      setEditingSubSequenceId(null);
      setEditingSubSequenceValue("");
    }
  };

  const totalPages = Math.ceil(totalDocs / itemsPerPage);

  // const placeholderImage =
  //   "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMmyTPv4M5fFPvYLrMzMQcPD_VO34ByNjouQ&s";

  return (
    <div className="py-4">
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
                placeholder="Search by name, code, brand, category, condition, or sub SKU..."
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
                  await SkuFamilyService.downloadSample();
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
                  await SkuFamilyService.exportToExcel();
                  fetchData();
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
                          await SkuFamilyService.importFromExcel(file);
                          fetchData();
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
                    setEditId(null);
                    setIsModalOpen(true);
                  }}
                >
                  <i className="fas fa-plus text-xs"></i>
                  Add SKU Family
                </button>
              </>
            )}
          </div>
        </div>
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="w-12 px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <i className="fas fa-expand-arrows-alt text-gray-500"></i>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Brand
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Condition Category
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Sequence
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading SKU Families...
                    </div>
                  </td>
                </tr>
              ) : !skuFamilyData || skuFamilyData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <i className="fas fa-box-open text-4xl text-gray-400 dark:text-gray-500"></i>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                          No SKU Families Found
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                          {searchTerm.trim() 
                            ? `No SKU families match your search "${searchTerm}". Try searching by name, code, brand, category, condition, or sub SKU name.`
                            : canWrite
                            ? "There are no SKU families available at the moment. Click the 'Add SKU Family' button to create your first SKU family."
                            : "There are no SKU families available at the moment."}
                        </p>
                      </div>
                      {!searchTerm.trim() && canWrite && (
                        <button
                          onClick={() => {
                            setEditId(null);
                            setIsModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#0071E0] text-white px-6 py-2.5 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors mt-4"
                        >
                          <i className="fas fa-plus text-xs"></i>
                          Add SKU Family
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                skuFamilyData.map((item: SkuFamily, index: number) => {
                  const isExpanded = expandedRows.has(item._id || '');
                  return (
                    <React.Fragment key={item._id || index}>
                      {/* Main Row */}
                      <tr
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer border-b border-gray-200 dark:border-gray-700"
                        onClick={() => {
                          if (item._id) {
                            const newExpanded = new Set(expandedRows);
                            if (newExpanded.has(item._id)) {
                              newExpanded.delete(item._id);
                            } else {
                              newExpanded.add(item._id);
                              // Fetch sub SKU families when expanding
                              if (!subSkuFamilyData[item._id]) {
                                fetchSubSkuFamilies(item._id, 1);
                              }
                            }
                            setExpandedRows(newExpanded);
                          }
                        }}
                      >
                        <td className="w-12 px-3 py-3 text-center">
                          <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-gray-500 text-sm`}></i>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-900 dark:text-white">
                          {item.code || "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-900 dark:text-white">
                          {item.name || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                          {typeof item.brand === 'object' ? item.brand?.title || "N/A" : item.brand || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                          {typeof item.productcategoriesId === 'object' ? item.productcategoriesId?.title || "N/A" : item.productcategoriesId || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                          {typeof item.conditionCategoryId === 'object' ? item.conditionCategoryId?.title || "N/A" : item.conditionCategoryId || "N/A"}
                        </td>
                      <td className="px-4 py-3 text-center">
                        {canWrite ? (
                          <input
                            type="number"
                            min="1"
                            value={editingSequenceId === item._id ? editingSequenceValue : (item.sequence ?? 1)}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (editingSequenceId !== item._id) {
                                setEditingSequenceId(item._id || null);
                              }
                              if (value === "" || /^\d+$/.test(value)) {
                                setEditingSequenceValue(value);
                              }
                            }}
                            onBlur={() => {
                              if (editingSequenceId === item._id && editingSequenceValue !== "") {
                                handleSequenceSave(item);
                              } else if (editingSequenceId === item._id) {
                                setEditingSequenceId(null);
                                setEditingSequenceValue("");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingSequenceId === item._id) {
                                handleSequenceSave(item);
                              } else if (e.key === "Escape" && editingSequenceId === item._id) {
                                setEditingSequenceId(null);
                                setEditingSequenceValue("");
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-12 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                            placeholder="1"
                          />
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {item.sequence ?? 1}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {canWrite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item._id) {
                                  handleAddSubSkuFamily(item._id);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-1"
                              title="Add Sub SKU Family"
                            >
                              <i className="fas fa-plus text-sm"></i>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(item);
                            }}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-1"
                            title="View"
                          >
                            <i className="fas fa-eye text-sm"></i>
                          </button>
                          {canWrite && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item._id) {
                                    handleEdit(item._id);
                                  }
                                }}
                                className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors p-1"
                                title="Edit"
                              >
                                <i className="fas fa-edit text-sm"></i>
                              </button>
                              {isSuperAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item._id) {
                                      handleDelete(item._id);
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1"
                                  title="Delete"
                                >
                                  <i className="fas fa-trash text-sm"></i>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Sub SKU Families Row */}
                    {isExpanded && item._id && (
                      <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                        <td colSpan={8} className="px-0 py-0">
                          <div className="px-6 py-4">
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                              {/* Sub SKU Family Search */}
                              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                                <div className="flex items-center gap-3">
                                  <div className="relative flex-1">
                                    <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
                                    <input
                                      type="text"
                                      placeholder="Search sub SKU families..."
                                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                                      value={subSkuFamilySearch[item._id] || ''}
                                      onChange={(e) => {
                                        setSubSkuFamilySearch(prev => ({
                                          ...prev,
                                          [item._id!]: e.target.value
                                        }));
                                      }}
                                    />
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSubSkuFamilySearch(prev => ({
                                        ...prev,
                                        [item._id!]: ''
                                      }));
                                      fetchSubSkuFamilies(item._id!, 1, '');
                                    }}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                              
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                                  <tr>
                                    <th className="w-10 px-3 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                                      <i className="fas fa-grip-vertical text-gray-400"></i>
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Code</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Name</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Storage</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">RAM</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Color</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">Sequence</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                  {subSkuFamilyData[item._id]?.loading ? (
                                    <tr>
                                      <td colSpan={8} className="p-8 text-center">
                                        <div className="text-gray-500 dark:text-gray-400 text-sm">
                                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600 mx-auto mb-2"></div>
                                          Loading Sub SKU Families...
                                        </div>
                                      </td>
                                    </tr>
                                  ) : subSkuFamilyData[item._id]?.docs && subSkuFamilyData[item._id].docs.length > 0 ? (
                                    subSkuFamilyData[item._id].docs
                                      .sort((a: any, b: any) => (a.subSkuSequence || 1) - (b.subSkuSequence || 1))
                                      .map((subSku: any, subIndex: number) => {
                                      const subSkuImage = subSku.images && subSku.images.length > 0 ? subSku.images[0] : null;
                                      const getImageUrl = (path: string): string => {
                                        if (!path) return placeholderImage;
                                        const base = (import.meta as any).env?.VITE_BASE_URL || "";
                                        const isAbsolute = /^https?:\/\//i.test(path);
                                        return isAbsolute
                                          ? path
                                          : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
                                      };
                                      
                                      return (
                                        <tr 
                                          key={subSku._id || subIndex} 
                                          className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                                        >
                                          <td className="w-10 px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                                            <div className="flex items-center justify-center h-full">
                                              <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600"></div>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                              {subSku.subSkuCode || "Auto-generating..."}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                              {subSkuImage ? (
                                                <img
                                                  src={getImageUrl(subSkuImage)}
                                                  alt={subSku.subName || "Sub SKU"}
                                                  className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-gray-600 flex-shrink-0"
                                                  onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = placeholderImage;
                                                  }}
                                                />
                                              ) : (
                                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                                                  <i className="fas fa-image text-gray-400 text-xs"></i>
                                                </div>
                                              )}
                                              <span className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                                                {subSku.subName || "N/A"}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                                            {typeof subSku.storageId === 'object' ? subSku.storageId?.title || "N/A" : "N/A"}
                                          </td>
                                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                                            {typeof subSku.ramId === 'object' ? subSku.ramId?.title || "N/A" : "N/A"}
                                          </td>
                                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                                            {typeof subSku.colorId === 'object' ? subSku.colorId?.title || "N/A" : "N/A"}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            {canWrite ? (
                                              <input
                                                type="number"
                                                min="1"
                                                value={editingSubSequenceId === subSku._id ? editingSubSequenceValue : (subSku.subSkuSequence ?? 1)}
                                                onChange={(e) => {
                                                  const value = e.target.value;
                                                  if (editingSubSequenceId !== subSku._id) {
                                                    setEditingSubSequenceId(subSku._id || null);
                                                  }
                                                  if (value === "" || /^\d+$/.test(value)) {
                                                    setEditingSubSequenceValue(value);
                                                  }
                                                }}
                                                onBlur={() => {
                                                  if (editingSubSequenceId === subSku._id && editingSubSequenceValue !== "") {
                                                    const sequence = parseInt(editingSubSequenceValue);
                                                    if (item._id && subSku._id) {
                                                      handleSubSequenceSave(item._id, subSku._id, sequence);
                                                    } else {
                                                      setEditingSubSequenceId(null);
                                                      setEditingSubSequenceValue("");
                                                    }
                                                  } else if (editingSubSequenceId === subSku._id) {
                                                    setEditingSubSequenceId(null);
                                                    setEditingSubSequenceValue("");
                                                  }
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter" && editingSubSequenceId === subSku._id) {
                                                    const sequence = parseInt(editingSubSequenceValue);
                                                    if (item._id && subSku._id) {
                                                      handleSubSequenceSave(item._id, subSku._id, sequence);
                                                    }
                                                  } else if (e.key === "Escape" && editingSubSequenceId === subSku._id) {
                                                    setEditingSubSequenceId(null);
                                                    setEditingSubSequenceValue("");
                                                  }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-12 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                                                placeholder="1"
                                              />
                                            ) : (
                                              <span className="text-gray-600 dark:text-gray-400 text-xs">
                                                {subSku.subSkuSequence ?? 1}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            {canWrite ? (
                                              <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item._id && subSku._id) {
                                                      handleEditSubSkuFamily(item._id, subSku);
                                                    }
                                                  }}
                                                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors p-1"
                                                  title="Edit"
                                                >
                                                  <i className="fas fa-edit text-sm"></i>
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item._id && subSku._id) {
                                                      handleDeleteSubSkuFamily(item._id, subSku._id);
                                                    }
                                                  }}
                                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1"
                                                  title="Delete"
                                                >
                                                  <i className="fas fa-trash text-sm"></i>
                                                </button>
                                              </div>
                                            ) : (
                                              <span className="text-gray-400 dark:text-gray-500 text-xs">View Only</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td colSpan={8} className="p-8 text-center">
                                        <div className="flex flex-col items-center justify-center text-center">
                                          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                                            <i className="fas fa-box-open text-2xl text-gray-400"></i>
                                          </div>
                                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                            No Sub SKU Families found
                                          </p>
                                          {canWrite && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (item._id) {
                                                  handleAddSubSkuFamily(item._id);
                                                }
                                              }}
                                              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                                            >
                                              <i className="fas fa-plus"></i>
                                              Add Sub SKU Family
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                              
                              {/* Sub SKU Family Pagination */}
                              {subSkuFamilyData[item._id] && subSkuFamilyData[item._id].totalDocs > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 sm:mb-0">
                                    Showing {subSkuFamilyData[item._id].docs.length} of {subSkuFamilyData[item._id].totalDocs} sub SKU families
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const itemId = item._id as string;
                                        const currentPage = subSkuFamilyData[itemId].currentPage;
                                        if (currentPage > 1) {
                                          fetchSubSkuFamilies(itemId, currentPage - 1);
                                        }
                                      }}
                                      disabled={subSkuFamilyData[item._id as string].currentPage === 1}
                                      className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-xs transition-colors"
                                    >
                                      Previous
                                    </button>
                                      <div className="flex space-x-1">
                                        {(() => {
                                          const itemId = item._id as string;
                                          const totalPages = subSkuFamilyData[itemId].totalPages;
                                          const currentPage = subSkuFamilyData[itemId].currentPage;
                                          return Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                            const pageNum = i + 1;
                                            // Show pages around current page
                                            let displayPage = pageNum;
                                            if (totalPages > 5) {
                                              if (currentPage <= 3) {
                                                displayPage = pageNum;
                                              } else if (currentPage >= totalPages - 2) {
                                                displayPage = totalPages - 4 + pageNum;
                                              } else {
                                                displayPage = currentPage - 2 + pageNum;
                                              }
                                            }
                                            return (
                                              <button
                                                key={displayPage}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  fetchSubSkuFamilies(itemId, displayPage);
                                                }}
                                                className={`px-2 py-1.5 rounded-lg text-xs ${
                                                  subSkuFamilyData[itemId].currentPage === displayPage
                                                    ? "bg-[#0071E0] text-white dark:bg-blue-500 dark:text-white border border-blue-600 dark:border-blue-500"
                                                    : "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                                                } transition-colors`}
                                              >
                                                {displayPage}
                                              </button>
                                            );
                                          });
                                        })()}
                                      </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const itemId = item._id as string;
                                        const currentPage = subSkuFamilyData[itemId].currentPage;
                                        if (currentPage < subSkuFamilyData[itemId].totalPages) {
                                          fetchSubSkuFamilies(itemId, currentPage + 1);
                                        }
                                      }}
                                      disabled={(() => {
                                        const itemId = item._id as string;
                                        return subSkuFamilyData[itemId].currentPage === subSkuFamilyData[itemId].totalPages;
                                      })()}
                                      className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-xs transition-colors"
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalDocs > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-0">
              Showing {skuFamilyData.length} of {totalDocs} items
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
                {Array.from({ length: totalPages }, (_, i) => {
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
        )}
      </div>
      <SkuFamilyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditId(null);
        }}
        onSave={handleSave}
        editItem={
          editId ? skuFamilyData.find((item) => item._id === editId) : undefined
        }
      />
      <SubSkuFamilyModal
        isOpen={subSkuFamilyModalOpen}
        onClose={() => {
          setSubSkuFamilyModalOpen(false);
          setSelectedSkuFamilyForSub(null);
          setEditingSubSkuFamilyId(null);
          setEditingSubSkuFamily(null);
        }}
        onSave={handleSaveSubSkuFamily}
        skuFamilyId={selectedSkuFamilyForSub || ""}
        editItem={editingSubSkuFamily}
      />
      {selectedSkuFamily && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 transition-opacity duration-300"
          onClick={() => setSelectedSkuFamily(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 flex-shrink-0 flex items-center justify-center">
                  <i className="fas fa-box text-2xl text-gray-400"></i>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {selectedSkuFamily.name || "N/A"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    SKU Family Details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSkuFamily(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 flex-shrink-0"
                title="Close"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Basic Information
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      {selectedSkuFamily.name || "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Code
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      {selectedSkuFamily.code || "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Brand
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      {typeof selectedSkuFamily.brand === 'object' ? selectedSkuFamily.brand?.title || "N/A" : selectedSkuFamily.brand || "N/A"}
                    </p>
                  </div>

                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Additional Information
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Condition Category
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      {typeof selectedSkuFamily.conditionCategoryId === 'object' ? selectedSkuFamily.conditionCategoryId?.title || "N/A" : selectedSkuFamily.conditionCategoryId || "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sequence
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                      {selectedSkuFamily.sequence || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedSkuFamily.subSkuFamilies && selectedSkuFamily.subSkuFamilies.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Sub SKU Families ({selectedSkuFamily.subSkuFamilies.length})
                  </h3>
                  <div className="space-y-4">
                    {selectedSkuFamily.subSkuFamilies.map((subSku: any, index: number) => (
                      <div key={subSku._id || index} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 p-5 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Sub SKU Code</div>
                            <h4 className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {subSku.subSkuCode || "Auto-generating..."}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium">
                              {subSku.subSkuSequence || 1}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-white mb-4">
                          {subSku.subName || `Sub SKU ${index + 1}`}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                          <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sub SKU Code</label>
                            <p className="text-base font-semibold text-blue-600 dark:text-blue-400 mt-1">
                              {subSku.subSkuCode || "Auto-generating..."}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sub Name</label>
                            <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                              {subSku.subName || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Storage</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">
                              {typeof subSku.storageId === 'object' ? subSku.storageId?.title || "N/A" : "N/A"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">RAM</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">
                              {typeof subSku.ramId === 'object' ? subSku.ramId?.title || "N/A" : "N/A"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Color</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">
                              {typeof subSku.colorId === 'object' ? subSku.colorId?.title || "N/A" : "N/A"}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sequence</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">
                              {subSku.subSkuSequence || 1}
                            </p>
                          </div>
                        </div>
                        {subSku.images && subSku.images.length > 0 && (
                          <div className="mt-3">
                            <label className="text-sm text-gray-600 dark:text-gray-400">Images ({subSku.images.length}):</label>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {subSku.images.slice(0, 4).map((img: string, imgIndex: number) => (
                                <img
                                  key={imgIndex}
                                  src={(function () {
                                    const base = (import.meta as any).env?.VITE_BASE_URL || "";
                                    const isAbsolute = /^https?:\/\//i.test(img);
                                    return isAbsolute ? img : `${base}${img.startsWith("/") ? "" : "/"}${img}`;
                                  })()}
                                  alt={`${subSku.subName} - Image ${imgIndex + 1}`}
                                  className="w-full h-20 object-cover rounded border border-gray-200 dark:border-gray-600"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = placeholderImage;
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {subSku.videos && subSku.videos.length > 0 && (
                          <div className="mt-3">
                            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">
                              Videos ({subSku.videos.length})
                            </label>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {subSku.videos.slice(0, 4).map((video: string, videoIndex: number) => {
                                const videoUrl = getVideoUrl(video);
                                return (
                                  <div
                                    key={videoIndex}
                                    className="relative group aspect-video rounded border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer"
                                    onClick={() => setSelectedVideo(videoUrl)}
                                  >
                                    <video
                                      src={videoUrl}
                                      className="w-full h-full object-cover"
                                      preload="metadata"
                                      muted
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent && !parent.querySelector('.video-fallback')) {
                                          const fallback = document.createElement('div');
                                          fallback.className = 'video-fallback absolute inset-0 flex items-center justify-center';
                                          fallback.innerHTML = '<i class="fas fa-video text-xl text-gray-400"></i>';
                                          parent.appendChild(fallback);
                                        }
                                      }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                      <div className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all group-hover:scale-110">
                                        <i className="fas fa-play text-sm ml-0.5"></i>
                                      </div>
                                    </div>
                                    {videoIndex === 3 && subSku.videos.length > 4 && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <span className="text-white text-xs font-semibold">
                                          +{subSku.videos.length - 4} more
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Video Viewer Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Video Player
              </h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <video
                src={selectedVideo}
                controls
                autoPlay
                className="w-full h-auto max-h-[70vh] rounded-lg"
                onError={(e) => {
                  console.error('Video playback error:', e);
                  toastHelper.showTost('Failed to load video', 'error');
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkuFamilyTable;
