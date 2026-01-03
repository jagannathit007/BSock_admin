import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import SellerCategoryTable from "../../components/sellerCategory/SellerCategoryTable";

const SellerCategory = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Seller Category" 
        subTitle="Manage seller categories and classifications"
      />
      <div className="space-y-6 ">
        <SellerCategoryTable />
      </div>
    </>
  );
};

export default SellerCategory;

