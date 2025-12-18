import { useEffect, useState } from "react";
import { WtbAdminService, WtbAdminRow } from "../../services/order/wtb.services";

const WtbRequestsTable = () => {
  const [rows, setRows] = useState<WtbAdminRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (p = page, s = search) => {
    try {
      setLoading(true);
      const data = await WtbAdminService.list(p, 20, s);
      setRows(data.docs || []);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e) {
      console.error("WTB list error", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(1, search);
  };

  return (
    <div className="mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          WTB Requests
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            placeholder="Search customer, SKU code, name, brand, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium"
          >
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">No WTB requests found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">SKU Code</th>
                <th className="px-3 py-2 text-left">SKU Name</th>
                <th className="px-3 py-2 text-left">Brand</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Condition</th>
                <th className="px-3 py-2 text-left">Product Spec</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2">{r.customerName}</td>
                  <td className="px-3 py-2">{r.customerEmail}</td>
                  <td className="px-3 py-2 font-medium">{r.skuFamilyCode || "-"}</td>
                  <td className="px-3 py-2">{r.skuFamilyName || "-"}</td>
                  <td className="px-3 py-2">{r.brand || "-"}</td>
                  <td className="px-3 py-2">{r.productCategory || "-"}</td>
                  <td className="px-3 py-2">{r.conditionCategory || "-"}</td>
                  <td className="px-3 py-2">{r.productSpec || "-"}</td>
                  <td className="px-3 py-2">{r.quantity}</td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                  <td className="px-3 py-2">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-end mt-3 gap-2">
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1, search)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => load(page + 1, search)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default WtbRequestsTable;
