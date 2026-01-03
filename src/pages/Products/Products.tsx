import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ProductsTable from "../../components/products/ProductsTable";

const Products = () => {
  return (
    <>
      <PageBreadcrumb 
        pageTitle="Products" 
        subTitle="View and manage all products in the system"
      />
      <div className="space-y-6 ">
        <ProductsTable />
      </div>
    </>
  );
};

export default Products;
