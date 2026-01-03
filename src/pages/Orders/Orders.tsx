import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import OrdersTable from "../../components/orders/OrdersTable";

const Orders = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Orders" 
        subTitle="View and manage all customer orders"
      />
      <div className="space-y-6">
        <OrdersTable />
      </div>
    </>
  );
};

export default Orders;