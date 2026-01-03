import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import CurrencyConversionTable from "../../components/currencyConversion/CurrencyConversionTable";

const CurrencyConversion = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Currency Conversion" 
        subTitle="Manage currency conversion rates and settings"
      />
      <div className="space-y-6">
        <CurrencyConversionTable />
      </div>
    </>
  );
};

export default CurrencyConversion;
