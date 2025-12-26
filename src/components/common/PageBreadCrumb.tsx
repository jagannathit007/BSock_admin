interface BreadcrumbProps {
  pageTitle: string;
}
import {LOCAL_STORAGE_KEYS} from "../../constants/localStorage";
const PageBreadcrumb: React.FC<BreadcrumbProps> = ({ pageTitle }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h2
        className="text-3xl font-semibold text-gray-800 dark:text-white/90"
        x-text="pageName"
      >
        {pageTitle}
      </h2>
      <button 
      className="bg-violet-700 rounded-md p-2 font-bold text-white border-2"
      onClick={()=>{
        localStorage.removeItem(LOCAL_STORAGE_KEYS.VARIENTPRODUCT);
        window.location.reload();
      }}
      >Clear Cache</button>
    </div>
  );
};

export default PageBreadcrumb;
