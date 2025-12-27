import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <Backdrop />
      <AppHeader />
      {/* Main content area with padding-top to account for fixed header */}
      <div
        className={`transition-all duration-300 ease-in-out pt-16 ${
          isExpanded || isHovered ? "lg:ml-[269px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <div className="p-4 mx-auto w-full max-w-screen-2xl md:p-6 2xl:max-w-[1920px] 2xl:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
