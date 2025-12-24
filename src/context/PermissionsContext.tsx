import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { RoleManagementService, MyPermissions } from '../services/roleManagement/roleManagement.services';
import { SocketService } from '../services/socket/socket';

interface PermissionsContextType {
  permissions: MyPermissions | null;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
  hasAccess: (modulePath: string) => boolean;
  hasPermission: (modulePath: string, permission: 'read' | 'write' | 'verifyApprove' | 'marginUpdate') => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
};

interface PermissionsProviderProps {
  children: ReactNode;
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
  const [permissions, setPermissions] = useState<MyPermissions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);

      // 1) Seed from localStorage (fast paint), but do NOT return early.
      //    We still fetch fresh permissions from the API to pick up changes after logout/login.
      const storedPermissions = localStorage.getItem('adminPermissions');
      const storedRole = localStorage.getItem('adminRole');

      if (storedPermissions && storedRole) {
        try {
          const parsedPermissions = JSON.parse(storedPermissions);
          setPermissions(parsedPermissions);
        } catch (e) {
          console.error('Error parsing stored permissions:', e);
        }
      }

      // 2) Always fetch latest permissions from API to reflect role/permission changes immediately.
      const myPermissions = await RoleManagementService.getMyPermissions();
      
      // Convert Mongoose documents to plain objects using JSON serialization
      // This ensures all nested Mongoose documents are converted to plain objects
      const cleanPermissions: MyPermissions = JSON.parse(JSON.stringify(myPermissions));
      
      // Debug: Log permissions structure in development
      if (import.meta.env.DEV) {
        console.log('📋 Loaded permissions from API:', {
          role: cleanPermissions.role,
          modulesCount: cleanPermissions.modules?.length || 0,
          modules: cleanPermissions.modules?.map(m => ({
            path: m.path,
            key: m.key,
            hasAccess: m.hasAccess,
            permissions: m.permissions
          }))
        });
      }
      
      setPermissions(cleanPermissions);

      // Store in localStorage for future fast load
      localStorage.setItem('adminPermissions', JSON.stringify(cleanPermissions));
      localStorage.setItem('adminRole', cleanPermissions.role);
    } catch (error) {
      console.error('Error loading permissions:', error);
      // On error, set default permissions (superadmin access)
      setPermissions({
        role: 'superadmin',
        modules: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    await loadPermissions();
  }, [loadPermissions]);

  const hasAccess = (modulePath: string): boolean => {
    if (!permissions) return false;
    
    if (permissions.role === 'superadmin') {
      return true;
    }
    
    const module = permissions.modules.find(
      (m) => m.path === modulePath || m.subItems?.some((si) => si.path === modulePath)
    );
    
    return module?.hasAccess || false;
  };

  // Helper function to convert Mongoose document to plain object
  const toPlainObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Check if it's a Mongoose document (has $__ or _doc)
    if (obj._doc) {
      // Use _doc which contains the actual data
      return JSON.parse(JSON.stringify(obj._doc));
    }
    
    if (obj.$__) {
      // It's a Mongoose document, use JSON serialization to convert
      return JSON.parse(JSON.stringify(obj));
    }
    
    // If it's an array, convert each item
    if (Array.isArray(obj)) {
      return obj.map(item => toPlainObject(item));
    }
    
    // If it's already a plain object, check for nested Mongoose documents
    const plain: any = {};
    for (const key in obj) {
      // Skip Mongoose internal properties
      if (key.startsWith('$') || key === '__v' || (key === '_id' && typeof obj._id === 'object' && obj._id.toString)) {
        continue;
      }
      plain[key] = toPlainObject(obj[key]);
    }
    return plain;
  };

  const hasPermission = (modulePath: string, permission: 'read' | 'write' | 'verifyApprove' | 'marginUpdate'): boolean => {
    // If permissions are still loading, return false (will be re-checked when loaded)
    if (!permissions) {
      return false;
    }
    
    // Superadmin always has all permissions - check this FIRST
    if (permissions.role === 'superadmin') {
      return true;
    }
    
    // Find module by exact path match or subItems path match
    const module = permissions.modules.find(
      (m) => m.path === modulePath || m.subItems?.some((si) => si.path === modulePath)
    );
    
    if (!module) {
      // Debug only in development
      if (import.meta.env.DEV) {
        console.warn(`⚠️ hasPermission: Module not found for path: ${modulePath}`);
        console.warn('Available modules:', permissions.modules.map(m => ({ path: m.path, key: m.key })));
      }
      return false;
    }
    
    // Convert permissions to plain object if it's a Mongoose document
    const plainPermissions = toPlainObject(module.permissions);
    
    // Check if permission exists and is true
    // Ensure we check the permissions object exists and the specific permission is explicitly true
    const hasPerm = plainPermissions && 
                    typeof plainPermissions[permission] !== 'undefined' && 
                    plainPermissions[permission] === true;
    
    // Debug only in development
    if (import.meta.env.DEV && !hasPerm && plainPermissions) {
      console.log(`⚠️ Permission check: ${modulePath}.${permission} = ${plainPermissions[permission]}`);
      console.log('Module permissions object (plain):', plainPermissions);
    }
    
    return hasPerm;
  };

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Listen for permissions update events (e.g., after login)
  useEffect(() => {
    const handlePermissionsUpdate = () => {
      console.log('🔄 Permissions update event received, refreshing permissions...');
      
      // Immediately update from localStorage for instant UI update (no loading state)
      const storedPermissions = localStorage.getItem('adminPermissions');
      if (storedPermissions) {
        try {
          const parsedPermissions = JSON.parse(storedPermissions);
          setPermissions(parsedPermissions);
          console.log('✅ Permissions updated from localStorage immediately');
        } catch (e) {
          console.error('Error parsing stored permissions:', e);
        }
      }
      
      // Then fetch fresh permissions from API to ensure accuracy
      refreshPermissions();
    };

    // Listen for the custom event (from login or manual refresh)
    window.addEventListener('permissionsUpdated', handlePermissionsUpdate);

    // Listen for socket forceLogout event - refresh permissions before logout
    const handleForceLogout = (_payload: any) => {
      console.log('🔄 Force logout received, refreshing permissions before logout...');
      // Refresh permissions one last time before logout
      refreshPermissions().then(() => {
        console.log('✅ Permissions refreshed before logout');
      });
    };

    // Set up socket listener for forceLogout
    SocketService.onForceLogout(handleForceLogout);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('permissionsUpdated', handlePermissionsUpdate);
      SocketService.offForceLogout();
    };
  }, [refreshPermissions]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading,
        refreshPermissions,
        hasAccess,
        hasPermission,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};



