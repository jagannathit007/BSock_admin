import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import SellerTable from "../../components/seller/SellerTable";

const Sellers = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Sellers" 
        subTitle="Manage seller accounts and their information"
      />
      <div className="space-y-6">
        <SellerTable />
      </div>
    </>
  );
};

export default Sellers;

