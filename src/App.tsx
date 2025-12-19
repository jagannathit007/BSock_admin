import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import SkuFamily from "./pages/SkuFamily/SkuFamily";
import Products from "./pages/Products/Products";
import ProductVariantForm from "./pages/Products/ProductVariantForm";
import Admins from "./pages/Admin/Admins";
import CostModule from "./pages/CostModule/CostModule";
import WalletAmount from "./pages/WalletAmount/WalletAmount";
import Payment from "./pages/Payment/Payment";
import OrderPayments from "./pages/Payment/OrderPayments";
import Payments from "./pages/Payment/Payments";
import CustomerCart from "./pages/Customer/CustomerCart";
import BusinessRequests from "./pages/BusinessRequests/BusinessRequests";
import Orders from "./pages/Orders/Orders";
import WTBRequests from "./pages/WTBRequests/WTBRequests";
import CurrencyConversion from "./pages/CurrencyConversion/CurrencyConversion";
import Activities from "./pages/Activities/Activities";
import Customers from "./pages/Customers/Customers";
import Sellers from "./pages/Sellers/Sellers";
import BidProducts from "./pages/BidProducts/BidProducts";
import BidTracking from "./pages/BidProducts/BidTracking";
import Negotiations from "./pages/Negotiations/Negotiations";
import Brand from "./pages/Brand/Brand";
import Grade from "./pages/Grade/Grade";
import ProductCategory from "./pages/ProductCategory/ProductCategory";
import Color from "./pages/Color/Color";
import Ram from "./pages/Ram/Ram";
import Storage from "./pages/Storage/Storage";
import ConditionCategory from "./pages/ConditionCategory/ConditionCategory";
import CustomerCategory from "./pages/CustomerCategory/CustomerCategory";
import SellerCategory from "./pages/SellerCategory/SellerCategory";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Redirect root to signin */}
          <Route path="/" element={<Navigate to="/signin" replace />} />

          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />
            <Route path="/admin" element={<Admins />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/sellers" element={<Sellers />} />
            <Route path="/currency-conversion" element={<CurrencyConversion />} />
            <Route path="/business-requests" element={<BusinessRequests />} />
            <Route path="/sku-family" element={<SkuFamily />} />
            <Route path="/products" element={<Products />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/wtb-requests" element={<WTBRequests />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/cost-module" element={<CostModule />} />
            <Route path="/wallet-amount" element={<WalletAmount />} />
            <Route path="/payments" element={<Payment />}></Route>
            <Route path="/order-payments" element={<OrderPayments />}></Route>
            <Route path="/payments-management" element={<Payments />}></Route>
            <Route path="/customer-cart" element={<CustomerCart />} />

            <Route path="/bid-products" element={<BidProducts />} />
            <Route path="/bid-tracking" element={<BidTracking />} />
            <Route path="/negotiations" element={<Negotiations />} />

            {/* Masters */}
            <Route path="/masters/brand" element={<Brand />} />
            <Route path="/masters/grade" element={<Grade />} />
            <Route path="/masters/product-category" element={<ProductCategory />} />
            <Route path="/masters/color" element={<Color />} />
            <Route path="/masters/ram" element={<Ram />} />
            <Route path="/masters/storage" element={<Storage />} />
            <Route path="/masters/condition-category" element={<ConditionCategory />} />
            <Route path="/masters/customer-category" element={<CustomerCategory />} />
            <Route path="/masters/seller-category" element={<SellerCategory />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="/basic-tables" element={<BasicTables />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Fullscreen Pages (without sidebar) */}
          <Route path="/products/create" element={<ProductVariantForm />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}