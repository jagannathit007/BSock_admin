import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import BrandTable from "../../components/brand/BrandTable";

const Brand = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Brand" 
        subTitle="Manage product brands and their configurations"
      />
      <div className="space-y-6 ">
        <BrandTable />
      </div>
    </>
  );
};

export default Brand;

