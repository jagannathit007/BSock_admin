import ActionsTable from "../../components/activities/ActivitiesTable";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

const Activities = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Activities" 
        subTitle="View system activities and user actions"
      />
      <div className="space-y-6">
        <ActionsTable />
      </div>
    </>
  );
};

export default Activities;

