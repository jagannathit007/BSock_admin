import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PaymentConfig from "../../components/payment/PaymentConfig";
import { useState } from "react";

const payment = () => {
  const [actionButtons, setActionButtons] = useState<React.ReactNode>(null);

  return (
    <>
      <PageMeta
        title="React.js Products Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Products Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb 
        pageTitle="Payment Configuration" 
        subTitle="Configure payment methods and settings"
      />
      <div className="flex justify-end mb-6">
        {actionButtons}
      </div>
      
      <div className="space-y-6 ">
        <PaymentConfig onRenderButtons={setActionButtons} />
      </div>
    </>
  );
};

export default payment;
