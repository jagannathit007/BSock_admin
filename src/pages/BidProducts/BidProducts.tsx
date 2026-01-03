  import BidProductsTable from "../../components/bidProducts/BidProductsTable";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

const BidProducts = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Bid Products" 
        subTitle="Manage bidding products and auction listings"
      />
      <div className="space-y-6 ">
        <BidProductsTable />
      </div>
    </>
  );
};

export default BidProducts;
