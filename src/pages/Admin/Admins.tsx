import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import AdminsTable from "../../components/admins/AdminsTable";

const Admins = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Admins" 
        subTitle="Manage admin users and their permissions"
      />
      <div className="space-y-6">
        <AdminsTable />
      </div>
    </>
  );
};

export default Admins;
