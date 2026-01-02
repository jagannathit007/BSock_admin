import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import toastHelper from "../../utils/toastHelper";
import AdminsModal from "./AdminsModal";
import PermissionManagementModal from "./PermissionManagementModal";
import { AdminService, Admin, UpdateAdminRequest } from "../../services/admin/admin.services";
import { LOCAL_STORAGE_KEYS } from "../../constants/localStorage";
import { useDebounce } from "../../hooks/useDebounce";
import { usePermissions } from "../../context/PermissionsContext";
import { FaEdit, FaKey, FaShieldAlt, FaTrash } from "react-icons/fa";

const AdminsTable: React.FC = () => {
  const { hasPermission, permissions } = usePermissions();
  const canWrite = hasPermission('/admin', 'write');
  const isSuperAdmin = permissions?.role === 'superadmin';
  const [adminsData, setAdminsData] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [permissionModalOpen, setPermissionModalOpen] = useState<boolean>(false);
  const [selectedAdminForPermissions, setSelectedAdminForPermissions] = useState<Admin | null>(null);
  const itemsPerPage = 10;

  // Fetch admins data
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await AdminService.listAdmins({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
      });
      
      if (response.status === 200 && response.data) {
        // Filter out admins that have already logged in
        const currentUserId = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_ID);
        const filteredAdmins = response.data.docs.filter(admin => admin._id !== currentUserId);
        
        setAdminsData(filteredAdmins);
        setTotalPages(response.data.totalPages);
        setTotalDocs(filteredAdmins.length); // Update total count to reflect filtered results
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
      toastHelper.error('Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [currentPage, debouncedSearchTerm]);

  // Reset to first page when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  const handleSave = () => {
    // Refresh the data after save
    fetchAdmins();
    setIsModalOpen(false);
    setEditingAdmin(null);
  };

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setIsModalOpen(true);
  };

  const handleResetPassword = async (admin: Admin) => {
    const confirmed = await Swal.fire({
      title: "Reset Password?",
      html: `
        <div class="text-center">
          <p class="mb-3">Are you sure you want to reset the password for <strong>${admin.name}</strong>?</p>
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
            <p class="text-sm text-yellow-800">
              <i class="fas fa-exclamation-triangle mr-2"></i>
              <strong>Warning:</strong> The new password will be set to <code class="bg-yellow-100 px-1 rounded">user@1234</code>
            </p>
          </div>
          <p class="text-sm text-gray-600">The admin will need to change this password on their next login.</p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, reset password!",
      cancelButtonText: "No, cancel!",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      focusCancel: true,
    });

    if (confirmed.isConfirmed) {
      setResettingPassword(admin._id);
      try {
        const updateData: UpdateAdminRequest = {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          isActive: admin.isActive,
          password: "user@1234", // Default password
        };
        
        await AdminService.updateAdmin(updateData);
        
        Swal.fire({
          title: "Password Reset!",
          text: `Password has been reset to "user@1234" for ${admin.name}`,
          icon: "success",
          confirmButtonColor: "#10b981",
        });
        
        fetchAdmins(); // Refresh the data
      } catch (error) {
        console.error('Error resetting password:', error);
        toastHelper.error("Failed to reset password. Please try again.");
      } finally {
        setResettingPassword(null);
      }
    }
  };

  const handleDelete = async (admin: Admin) => {
    const confirmed = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the admin! This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete permanently!",
      cancelButtonText: "No, cancel!",
      confirmButtonColor: "#dc2626",
    });

    if (confirmed.isConfirmed) {
      try {
        await AdminService.deleteAdmin({ id: admin._id });
        fetchAdmins(); // Refresh the data
      } catch (error) {
        console.error('Error deleting admin:', error);
      }
    }
  };


  // Function to get status styles and icons
  const getStatusStyles = (isActive: boolean) => {
    return isActive
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700";
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? "fa-check-circle" : "fa-times";
  };

  return (
    <div className="py-4">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
        {/* Table Header with Controls */}
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by name or email..."
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
              className="inline-flex items-center gap-1 rounded-lg bg-[#0071E0] text-white px-4 py-2 text-sm font-medium hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              onClick={() => {
                setIsModalOpen(true);
              }}
            >
              <i className="fas fa-plus text-xs"></i>
              Add Admin
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
                {/* <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Email
                </th> */}
                
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Created At
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 align-middle">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto mb-4"></div>
                      Loading Admins...
                    </div>
                  </td>
                </tr>
              ) : adminsData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="text-gray-500 dark:text-gray-400 text-lg">
                      No admins found
                    </div>
                  </td>
                </tr>
              ) : (
                adminsData.map((item: Admin) => (
                  <tr
                    key={item._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      <p className='capitalize'>{item.name}</p>
                      <p className='text-gray-500 text-sm '>{item.email}</p>
                    </td>
                    {/* <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.email}
                    </td> */}
                    
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span 
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider ${getStatusStyles(item.isActive)}`}
                      >
                        <i className={`fas ${getStatusIcon(item.isActive)} text-xs`}></i>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {canWrite ? (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Edit Admin"
                          >
                            {/* <i className="fas fa-edit"></i> */}
                            <FaEdit className="w-[16px] h-[16px]"/>
                          </button>
                          <button
                            onClick={() => handleResetPassword(item)}
                            disabled={resettingPassword === item._id}
                            className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Reset Password"
                          >
                            {resettingPassword === item._id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-yellow-600"></div>
                            ) : (
                              // <i className="fas fa-key"></i>
                              <FaKey className="w-[16px] h-[16px]"/>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAdminForPermissions(item);
                              setPermissionModalOpen(true);
                            }}
                            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Manage Permissions"
                          >
                            {/* <i className="fas fa-shield-alt"></i> */}
                            <FaShieldAlt className="w-[16px] h-[16px]" />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Delete Admin"
                            >
                              {/* <i className="fas fa-trash"></i> */}
                              <FaTrash className="w-[16px] h-[16px]" />
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
            Showing {adminsData.length} of {totalDocs} items
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || loading}
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
                    disabled={loading}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      currentPage === pageNum
                        ? "bg-[#0071E0] text-white dark:bg-blue-500 dark:text-white border border-blue-600 dark:border-blue-500"
                        : "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AdminsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAdmin(null);
        }}
        onSave={handleSave}
        editAdmin={editingAdmin}
      />

      {selectedAdminForPermissions && (
        <PermissionManagementModal
          isOpen={permissionModalOpen}
          onClose={() => {
            setPermissionModalOpen(false);
            setSelectedAdminForPermissions(null);
          }}
          adminId={selectedAdminForPermissions._id}
          adminName={selectedAdminForPermissions.name}
          adminRole={selectedAdminForPermissions.role || 'admin'}
          onUpdate={() => {
            fetchAdmins();
          }}
        />
      )}
    </div>
  );
};

export default AdminsTable;