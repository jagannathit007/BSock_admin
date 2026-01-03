import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import WtbRequestsTable from "../../components/orders/WtbRequestsTable";

const WTBRequests = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="WTB Requests" 
        subTitle="Manage Want To Buy requests from customers"
      />
      <div className="space-y-6">
        <WtbRequestsTable />
      </div>
    </>
  );
};

export default WTBRequests;
