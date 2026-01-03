import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ColorTable from "../../components/color/ColorTable";

const Color = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Color" 
        subTitle="Manage product colors and color options"
      />
      <div className="space-y-6 ">
        <ColorTable />
      </div>
    </>
  );
};

export default Color;


