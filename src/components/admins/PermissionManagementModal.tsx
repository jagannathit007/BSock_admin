import React, { useState, useEffect } from "react";
import { RoleManagementService, Module, Permission, ModulePermissions } from "../../services/roleManagement/roleManagement.services";
import toastHelper from "../../utils/toastHelper";

interface PermissionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminId: string;
  adminName: string;
  adminRole: string;
  onUpdate: () => void;
}

const PermissionManagementModal: React.FC<PermissionManagementModalProps> = ({
  isOpen,
  onClose,
  adminId,
  adminName,
  adminRole,
  onUpdate,
}) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<ModulePermissions>({});
  const [selectedRole, setSelectedRole] = useState<string>(adminRole);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && adminId) {
      fetchData();
    }
  }, [isOpen, adminId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [modulesData, rolesData, adminPermissionsData] = await Promise.all([
        RoleManagementService.getModules(),
        RoleManagementService.getRoles(),
        RoleManagementService.getAdminPermissions(adminId),
      ]);

      setModules(modulesData);
      setAvailableRoles(rolesData);
      setSelectedRole(adminPermissionsData.admin.role);
      const fetchedPermissions = adminPermissionsData.permissions || {};
      
      // Debug: Log permissions to check if marginUpdate is present
      console.log('Fetched permissions:', JSON.stringify(fetchedPermissions, null, 2));
      
      // Note: Backend schema has been fixed to include sellers module
      
      // Initialize permissions for all modules to ensure they exist
      // This ensures that even if backend doesn't return permissions for a module,
      // we still have a default permission object for it
      modulesData.forEach((module) => {
        // Check if permission exists with current key
        let modulePermission = fetchedPermissions[module.key];
        
        // If not found, try to find by name (case-insensitive) or similar keys
        if (!modulePermission) {
          const foundKey = Object.keys(fetchedPermissions).find(
            key => {
              const keyLower = key.toLowerCase();
              const moduleKeyLower = module.key.toLowerCase();
              const moduleNameLower = module.name.toLowerCase();
              
              return keyLower === moduleKeyLower ||
                     keyLower === moduleNameLower ||
                     (keyLower.includes('seller') && moduleKeyLower.includes('seller')) ||
                     (keyLower.includes('seller') && moduleNameLower.includes('seller'));
            }
          );
          if (foundKey) {
            modulePermission = fetchedPermissions[foundKey];
            // Copy to the correct key, ensuring proper boolean values
            const isMaster = module.key.toLowerCase() === "master" || 
                            module.key.toLowerCase() === "masters" ||
                            module.name.toLowerCase() === "master" || 
                            module.name.toLowerCase() === "masters" ||
                            module.name.toLowerCase().includes("master");
            fetchedPermissions[module.key] = {
              read: Boolean(modulePermission.read),
              write: Boolean(modulePermission.write),
              ...(typeof modulePermission.verifyApprove !== 'undefined' && modulePermission.verifyApprove !== null && {
                verifyApprove: Boolean(modulePermission.verifyApprove),
              }),
              ...(isMaster && typeof modulePermission.marginUpdate !== 'undefined' && modulePermission.marginUpdate !== null && {
                marginUpdate: Boolean(modulePermission.marginUpdate),
              }),
            };
          }
        }
        
        // Initialize permissions object if it doesn't exist
        const isMaster = module.key.toLowerCase() === "master" || 
                        module.key.toLowerCase() === "masters" ||
                        module.name.toLowerCase() === "master" || 
                        module.name.toLowerCase() === "masters" ||
                        module.name.toLowerCase().includes("master");
        
        if (!fetchedPermissions[module.key]) {
          fetchedPermissions[module.key] = {
            read: false,
            write: false,
            ...(isMaster && { marginUpdate: false }),
          };
        } else {
          // Ensure read and write are always defined and are proper booleans
          const perm = fetchedPermissions[module.key];
          if (typeof perm.read === 'undefined' || perm.read === null) {
            perm.read = false;
          } else {
            perm.read = Boolean(perm.read);
          }
          if (typeof perm.write === 'undefined' || perm.write === null) {
            perm.write = false;
          } else {
            perm.write = Boolean(perm.write);
          }
          // Ensure verifyApprove is boolean if it exists
          if (typeof perm.verifyApprove !== 'undefined' && perm.verifyApprove !== null) {
            perm.verifyApprove = Boolean(perm.verifyApprove);
          }
          
          // Ensure marginUpdate is properly handled for Master module
          if (isMaster) {
            if (typeof perm.marginUpdate === 'undefined' || perm.marginUpdate === null) {
              perm.marginUpdate = false;
            } else {
              perm.marginUpdate = Boolean(perm.marginUpdate);
            }
          }
        }
      });
      
      // Final check: Ensure seller module has permissions initialized
      const sellerModule = modulesData.find(m => 
        m.key.toLowerCase().includes('seller') || 
        m.name.toLowerCase().includes('seller')
      );
      
      if (sellerModule) {
        if (!fetchedPermissions[sellerModule.key]) {
          fetchedPermissions[sellerModule.key] = {
            read: false,
            write: false,
          };
        }
      }
      setPermissions(fetchedPermissions);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (moduleKey: string, permissionType: keyof Permission, value: boolean | number) => {
    setPermissions((prev) => {
      // Ensure we have a base permission object
      const currentPermission = prev[moduleKey] || { read: false, write: false };
      
      const updated = {
        ...prev,
        [moduleKey]: {
          ...currentPermission,
          [permissionType]: value,
        },
      };
      
      
      return updated;
    });
  };


  const handleRoleChange = async (newRole: string) => {
    setSelectedRole(newRole);
    // If changing to superadmin, set all permissions to true
    if (newRole === "superadmin") {
      const allPermissions: ModulePermissions = {};
      modules.forEach((module) => {
        const isMaster = isMasterModule(module);
        const supportsVerifyApprove = moduleSupportsVerifyApprove(module.key, module.name);
        
        allPermissions[module.key] = {
          read: true,
          write: true,
          ...(supportsVerifyApprove && { verifyApprove: true }),
          ...(isMaster && {
            marginUpdate: true,
          }),
        };
      });
      setPermissions(allPermissions);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update role first if changed
      if (selectedRole !== adminRole) {
        await RoleManagementService.updateAdminRole(adminId, selectedRole);
      }

      // Update permissions (only if not superadmin, as superadmin has all permissions)
      if (selectedRole !== "superadmin") {
        // Filter out marginUpdate and marginValue from permissions before sending to backend
        // These are handled separately or stored differently
        const permissionsToSend: ModulePermissions = {};
        
        // Only send permissions for modules that exist in the modules list
        // This ensures we're using the correct module keys
        modules.forEach((module) => {
          // Get permission - check both exact key and case-insensitive match
          let permission = permissions[module.key];
          
          // If not found, try to find by case-insensitive key or name match
          if (!permission) {
            const foundKey = Object.keys(permissions).find(
              key => key.toLowerCase() === module.key.toLowerCase() ||
                     key.toLowerCase() === module.name.toLowerCase()
            );
            if (foundKey) {
              permission = permissions[foundKey];
            }
          }
          
          // Always create permission object, even if it doesn't exist in state
          // This ensures all modules are sent to backend
          const permissionToSend = permission || {
            read: false,
            write: false,
          };
          
          permissionsToSend[module.key] = {
            read: Boolean(permissionToSend.read),
            write: Boolean(permissionToSend.write),
            // Only include verifyApprove if module supports it
            ...(moduleSupportsVerifyApprove(module.key, module.name) && typeof permissionToSend.verifyApprove !== 'undefined' && {
              verifyApprove: Boolean(permissionToSend.verifyApprove),
            }),
            // Always include marginUpdate for Master module (even if false)
            ...(isMasterModule(module) && {
              marginUpdate: Boolean(permissionToSend.marginUpdate ?? false),
            }),
          };
          
        });
        
        // Double-check: Ensure seller module is included
        const sellerModule = modules.find(m => 
          m.key.toLowerCase().includes('seller') || 
          m.name.toLowerCase().includes('seller')
        );
        
        if (sellerModule) {
          // Ensure seller permissions are always included and properly formatted
          const sellerPerm = permissions[sellerModule.key] || {
            read: false,
            write: false,
          };
          
          permissionsToSend[sellerModule.key] = {
            read: Boolean(sellerPerm.read),
            write: Boolean(sellerPerm.write),
            ...(moduleSupportsVerifyApprove(sellerModule.key, sellerModule.name) && 
                typeof sellerPerm.verifyApprove !== 'undefined' && {
              verifyApprove: Boolean(sellerPerm.verifyApprove),
            }),
          };
          
          // Backend now properly supports 'sellers' key, no need for fallback
        }
        
        // Debug: Log permissions being sent
        console.log('Sending permissions:', JSON.stringify(permissionsToSend, null, 2));
        
        await RoleManagementService.updateAdminPermissions(adminId, permissionsToSend);
      }

      toastHelper.showTost("Permissions updated successfully!", "success");
      
      
      // Refresh permissions in localStorage for the current admin (not the one being edited)
      // This ensures the sidebar updates if we're editing our own permissions
      try {
        const updatedPermissions = await RoleManagementService.getMyPermissions();
        localStorage.setItem('adminPermissions', JSON.stringify(updatedPermissions));
        localStorage.setItem('adminRole', updatedPermissions.role);
      } catch (error) {
        console.error('Error refreshing permissions:', error);
      }
      
      // Dispatch custom event to notify other components (like sidebar)
      window.dispatchEvent(new Event('permissionsUpdated'));
      
      // Also trigger storage event for cross-tab updates
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'adminPermissions',
        newValue: localStorage.getItem('adminPermissions'),
      }));
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error saving permissions:", error);
    } finally {
      setSaving(false);
    }
  };

  // Check if module supports Verify/Approve permission
  // Removed: customer, seller, wallet amounts, customer cart, admin, skufamily from verify/approve
  // Only show Verify/Approve for specific modules: orders, products, business request
  const moduleSupportsVerifyApprove = (moduleKey: string, moduleName: string): boolean => {
    // List of modules that support Verify/Approve (removed customer, seller, wallet, cart, admin, skufamily)
    const modulesWithVerifyApprove = [
      'order',
      'orders',
      'product',
      'products',
      'business',
      'businessrequest',
      'business-request',
      'business requests',
    ];
    
    const keyLower = moduleKey.toLowerCase();
    const nameLower = moduleName.toLowerCase();
    
    // Check if module key or name matches any of the allowed modules
    return modulesWithVerifyApprove.some(
      (allowedModule) => keyLower === allowedModule || 
                         keyLower.includes(allowedModule) ||
                         nameLower === allowedModule ||
                         nameLower.includes(allowedModule)
    );
  };

  // Check if module is Master module
  // Check both key and name, and also check for "masters" (plural)
  const isMasterModule = (module: Module): boolean => {
    const keyLower = module.key.toLowerCase();
    const nameLower = module.name.toLowerCase();
    return keyLower === "master" || 
           keyLower === "masters" ||
           nameLower === "master" || 
           nameLower === "masters" ||
           nameLower.includes("master");
  };

  const isSuperAdmin = selectedRole === "superadmin";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Manage Permissions
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {adminName} ({adminRole})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Role Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
                {isSuperAdmin && (
                  <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                    <i className="fas fa-info-circle mr-1"></i>
                    Superadmin has all permissions by default
                  </p>
                )}
              </div>

              {/* Permissions Cards */}
              {!isSuperAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modules.map((module) => {
                    // Initialize module permission with defaults
                    const basePermission = permissions[module.key] || {
                      read: false,
                      write: false,
                    };
                    
                    // Ensure Master module has marginUpdate initialized
                    const isMaster = isMasterModule(module);
                    const modulePermission: Permission = {
                      read: Boolean(basePermission.read),
                      write: Boolean(basePermission.write),
                      // Include verifyApprove if it exists
                      ...(typeof basePermission.verifyApprove !== 'undefined' && {
                        verifyApprove: Boolean(basePermission.verifyApprove),
                      }),
                      // Initialize marginUpdate for Master module
                      ...(isMaster && {
                        marginUpdate: Boolean(basePermission.marginUpdate ?? false),
                      }),
                    };
                    
                    const supportsVerifyApprove = moduleSupportsVerifyApprove(module.key, module.name);

                    return (
                      <div
                        key={module.key}
                        className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:shadow-md transition-shadow p-5"
                      >
                        {/* Module Header */}
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-600">
                          <i className={`${module.icon} text-xl text-blue-600 dark:text-blue-400`}></i>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                            {module.name}
                          </h3>
                        </div>

                        {/* Permissions */}
                        <div className="space-y-3">
                          {/* Read Permission */}
                          <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-2">
                              <i className="fas fa-eye text-gray-500 dark:text-gray-400"></i>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Read
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={Boolean(modulePermission.read)}
                              onChange={(e) =>
                                handlePermissionChange(module.key, "read", e.target.checked)
                              }
                              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          {/* Write Permission */}
                          <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-2">
                              <i className="fas fa-edit text-gray-500 dark:text-gray-400"></i>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Write
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={Boolean(modulePermission.write)}
                              onChange={(e) =>
                                handlePermissionChange(module.key, "write", e.target.checked)
                              }
                              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          {/* Verify/Approve Permission - Only show if module supports it */}
                          {supportsVerifyApprove && (
                            <label className="flex items-center justify-between cursor-pointer group">
                              <div className="flex items-center gap-2">
                                <i className="fas fa-check-circle text-gray-500 dark:text-gray-400"></i>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Verify/Approve
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={Boolean(modulePermission.verifyApprove)}
                                onChange={(e) =>
                                  handlePermissionChange(
                                    module.key,
                                    "verifyApprove",
                                    e.target.checked
                                  )
                                }
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </label>
                          )}

                          {/* Margin Update Permission - Only for Master Module */}
                          {isMaster && (
                            <label className="flex items-center justify-between cursor-pointer group">
                              <div className="flex items-center gap-2">
                                <i className="fas fa-percent text-gray-500 dark:text-gray-400"></i>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Margin Update
                                </span>
                              </div>
                              <input
                                type="checkbox"
                                checked={modulePermission.marginUpdate || false}
                                onChange={(e) =>
                                  handlePermissionChange(
                                    module.key,
                                    "marginUpdate",
                                    e.target.checked
                                  )
                                }
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isSuperAdmin && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <i className="fas fa-shield-alt text-4xl mb-4"></i>
                  <p className="text-lg font-medium">Superadmin has full access to all modules</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Saving...
              </>
            ) : (
              "Save Permissions"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionManagementModal;

