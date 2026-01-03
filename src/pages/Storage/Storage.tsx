import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StorageTable from "../../components/storage/StorageTable";

const Storage = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Storage" 
        subTitle="Manage storage specifications and options"
      />
      <div className="space-y-6 ">
        <StorageTable />
      </div>
    </>
  );
};

export default Storage;


