import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import Logo from "../components/common/Logo";
import { usePermissions } from "../context/PermissionsContext";
import type { MyPermissions } from "../services/roleManagement/roleManagement.services";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <i className="fas fa-th-large"></i>,
    name: "Dashboard",
    path: "/home",
    // Dashboard always visible, no permission check needed
  },
  {
    icon: <i className="fas fa-user-shield"></i>,
    name: "Admins",
    path: "/admin",
  },
  {
    icon: <i className="fas fa-users"></i>,
    name: "Customers",
    path: "/customers",
  },
  {
    icon: <i className="fas fa-user-tie"></i>,
    name: "Sellers",
    path: "/sellers",
  },
  {
    icon: <i className="fas fa-exchange-alt"></i>,
    name: "Currency Conversion",
    path: "/currency-conversion",
  },
  {
    icon: <i className="fa-solid fa-building"></i>,
    name: "Business Requests",
    path: "/business-requests",
  },
  {
    icon: <i className="fas fa-tags"></i>,
    name: "Sku Family",
    path: "/sku-family",
  },
  {
    icon: <i className="fas fa-box-open"></i>,
    name: "Products",
    path: "/products",
  },
  {
    icon: <i className="fas fa-layer-group"></i>,
    name: "Masters",
    path: "/masters", // Add path for matching
    subItems: [
      { name: "Grade", path: "/masters/grade" },
      { name: "Brand", path: "/masters/brand" },
      { name: "Product Category", path: "/masters/product-category" },
      { name: "Color", path: "/masters/color" },
      { name: "RAM", path: "/masters/ram" },
      { name: "Storage", path: "/masters/storage" },
      { name: "Conditions", path: "/masters/condition-category" },
      { name: "Customer Category", path: "/masters/customer-category" },
      { name: "Seller Category", path: "/masters/seller-category" },
    ],
  },
  {
    icon: <i className="fas fa-box-open"></i>,
    name: "Orders",
    path: "/orders",
  },
  {
    icon: <i className="fas fa-credit-card"></i>,
    name: "Payments",
    path: "/payments-management",
  },
  {
    icon: <i className="fas fa-shopping-cart"></i>,
    name: "WTB Requests",
    path: "/wtb-requests",
  },
  {
    icon: <i className="fas fa-handshake"></i>,
    name: "Negotiations",
    path: "/negotiations",
  },
  {
    icon: <i className="fa-solid fa-list-check"></i>,
    name: "Activities",
    path: "/activities",
  },
  {
    icon: <i className="fas fa-cog"></i>,
    name: "Configuration",
    path: "/configuration", // Add path for matching
    subItems: [
      { name: "Payment Config", path: "/payments" },
      // { name: "Order Payments", path: "/order-payments" },
      { name: "Cost Config", path: "/cost-module" },
    ],
  },
  {
    icon: <i className="fas fa-wallet"></i>,
    name: "Wallet Amount",
    path: "/wallet-amount",
  },
  {
    icon: <i className="fas fa-cart-shopping"></i>,
    name: "Customer Cart",
    path: "/customer-cart",
  },
  {
    icon: <i className="fas fa-gavel"></i>,
    name: "Bid Products",
    path: "/bid-products",
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const { permissions, loading } = usePermissions();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [filteredNavItems, setFilteredNavItems] = useState<NavItem[]>(navItems);

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  // Helper function to filter nav items based on permissions
  const filterNavItemsByPermissions = (permissionsData: MyPermissions) => {
    console.log('Filtering nav items with permissions:', permissionsData);
    
    if (!permissionsData || !permissionsData.modules) {
      console.warn('Invalid permissions data, showing all items');
      setFilteredNavItems(navItems);
      return;
    }
    
    if (permissionsData.role === 'superadmin') {
      // Superadmin sees all items
      setFilteredNavItems(navItems);
      console.log('Superadmin: Showing all menu items');
      return;
    }
    
    // Filter based on module access
    const filtered = navItems.filter((item) => {
      // For Dashboard, always show (no module mapping needed)
      if (item.path === '/home' || item.name === 'Dashboard') {
        console.log(`✓ Showing Dashboard (always visible)`);
        return true;
      }
      
      // Find matching module in permissions by path
      let module = null;
      
      // First try direct path match
      if (item.path) {
        module = permissionsData.modules.find((m) => m.path === item.path);
      }
      
      // If no direct match and item has subItems, check if any subItem path matches module path
      if (!module && item.subItems) {
        module = permissionsData.modules.find((m) => {
          // Check if module path matches any subItem path
          return item.subItems?.some((si) => si.path === m.path);
        });
      }
      
      // If still no match, check if module has subItems that match item's subItems
      if (!module && item.subItems) {
        module = permissionsData.modules.find((m) => {
          if (m.subItems) {
            // Check if any module subItem matches any navItem subItem
            return m.subItems.some((msi) => 
              item.subItems?.some((si) => si.path === msi.path)
            );
          }
          return false;
        });
      }
      
      const hasAccess = module?.hasAccess || false;
      
      if (hasAccess) {
        console.log(`✓ Showing menu item: ${item.name} (module: ${module?.key}, path: ${item.path})`);
      } else {
        console.log(`✗ Hiding menu item: ${item.name} (no access, path: ${item.path})`);
        if (!module) {
          console.log(`  → No matching module found in permissions`);
        } else {
          console.log(`  → Module found but hasAccess: ${module.hasAccess}`);
        }
      }
      
      return hasAccess;
    });
    
    setFilteredNavItems(filtered);
    console.log(`Filtered menu items for role ${permissionsData.role}:`, {
      total: navItems.length,
      shown: filtered.length,
      hidden: navItems.length - filtered.length,
      items: filtered.map(i => i.name)
    });
  };

  // Filter nav items whenever permissions change
  useEffect(() => {
    // PermissionsContext loads from localStorage immediately, so permissions
    // may be available even while loading (fetching from API)
    if (permissions) {
      filterNavItemsByPermissions(permissions);
    } else if (!loading) {
      // Only show all items if we're not loading and have no permissions
      // (This handles the case where permissions failed to load)
      setFilteredNavItems(navItems);
    }
    // If loading and no permissions yet, keep current state (don't change)
  }, [permissions, loading]);

  useEffect(() => {
    let submenuMatched = false;
    filteredNavItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu({
              type: "main",
              index,
            });
            submenuMatched = true;
          }
        });
      }
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main") => (
    <ul className="flex flex-col gap-2">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group flex items-center py-1 ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size w-8 h-8 flex items-center justify-center ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text text-base text-[14px]">
                  {nav.name}
                </span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <i
                  className={`ml-auto w-5 h-5 transition-transform duration-200 fas fa-chevron-down flex items-center justify-center ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group flex items-center py-1 ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size w-8 h-8 flex items-center justify-center text-base ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text text-base text-[14px]">
                    {nav.name}
                  </span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-1 space-y-1 ml-8">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item text-sm ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed flex flex-col px-4 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 transition-all duration-300 ease-in-out z-40 border-r border-gray-200
        ${isMobileOpen ? "top-16 h-[calc(100vh-4rem)]" : "top-16 lg:top-0 h-screen"} 
        ${
          isExpanded || isMobileOpen
            ? "w-[250px]"
            : isHovered
            ? "w-[250px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-6 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <>
          {isExpanded || isHovered || isMobileOpen ? (
            <Logo showTagline={true} size="medium" variant="sidebar" />
          ) : (
            <div 
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl shadow-sm"
              style={{ background: 'linear-gradient(to bottom right, #0071E0, #005bb5)' }}
            >
              <svg
                className="w-7 h-7 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          )}
        </>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-5">
          <div className="flex flex-col gap-2">
            <div>
              <h2
                className={`mb-3 text-xs uppercase flex leading-[18px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <i className="fas fa-ellipsis-h size-6"></i>
                )}
              </h2>
              {/* Debug: Show permissions status */}
              {/* {process.env.NODE_ENV === 'development' && permissions && (
                <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900 text-xs rounded">
                  <div>Role: <strong>{permissions.role}</strong></div>
                  <div>Visible Items: {filteredNavItems.length} / {navItems.length}</div>
                </div>
              )} */}
              {renderMenuItems(filteredNavItems, "main")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
