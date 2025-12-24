import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import CustomersChart from "../../components/ecommerce/CustomersChart";
// import RecentOrders from "../../components/ecommerce/RecentOrders";

export default function Home() {
  return (
    <>
      <div className="space-y-6">
        {/* All Stats Cards - 3 per row */}
        <EcommerceMetrics />

        {/* Charts Row - Sales Chart and Customers Chart on left, Recent Orders on right */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12 xl:col-span-7 space-y-6">
            <MonthlySalesChart />
            <CustomersChart />
          </div>

          {/* <div className="col-span-12 xl:col-span-5">
            <RecentOrders />
          </div> */}
        </div>
      </div>
    </>
  );
}
