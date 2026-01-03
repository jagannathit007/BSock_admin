import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import WalletAmountTable from "../../components/walletAmount/WalletAmountTable";

const WalletAmount = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Wallet Amount" 
        subTitle="View and manage wallet balances for users"
      />
      <div className="space-y-6">
        <WalletAmountTable />
      </div>
    </>
  );
};

export default WalletAmount;