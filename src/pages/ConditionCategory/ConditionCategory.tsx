import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ConditionCategoryTable from "../../components/conditionCategory/ConditionCategoryTable";

const ConditionCategory = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Conditions" 
        subTitle="Manage product condition categories"
      />
      <div className="space-y-6 ">
        <ConditionCategoryTable />
      </div>
    </>
  );
};

export default ConditionCategory;

