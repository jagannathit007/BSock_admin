import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import WtbRequestsTable from "../../components/orders/WtbRequestsTable";

const WTBRequests = () => {
  return (
    <>
      <PageBreadcrumb pageTitle="WTB Requests" />
      <div className="space-y-6">
        <WtbRequestsTable />
      </div>
    </>
  );
};

export default WTBRequests;
