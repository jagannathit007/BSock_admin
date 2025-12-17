import { useEffect, useState } from "react";
import {
  BoxIconLine,
  GroupIcon,
  DollarLineIcon,
  BoxIcon,
} from "../../icons";
import { DashboardService, DashboardStats } from "../../services/dashboard/dashboard.services";

export default function EcommerceMetrics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await DashboardService.getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-200 rounded mb-3"></div>
                <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
              </div>
              <div className="h-12 w-12 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
      {/* <!-- Customers Card --> */}
      <div className="dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Customers
              </p>
            </div>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {stats ? formatNumber(stats.customers.total) : '0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {stats && stats.customers.today > 0 ? `${stats.customers.today} today` : 'Registered users'}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
            <GroupIcon className="text-blue-600 dark:text-blue-400 size-6" />
          </div>
        </div>
      </div>

      {/* <!-- Total Delivered Orders Card --> */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Total Orders
              </p>
            </div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              {stats ? formatNumber(stats.orders.total) : '0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Delivered orders
            </p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
            <BoxIconLine className="text-indigo-600 dark:text-indigo-400 size-6" />
          </div>
        </div>
      </div>

      {/* <!-- Total Sales Card --> */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Total Sales
              </p>
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              {stats ? `$${formatNumber(stats.sales.total)}` : '$0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {stats && stats.sales.today > 0 ? `$${formatNumber(stats.sales.today)} today` : 'Total amount'}
            </p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
            <DollarLineIcon className="text-emerald-600 dark:text-emerald-400 size-6" />
          </div>
        </div>
      </div>

      {/* <!-- Active Products Card --> */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Active Products
              </p>
            </div>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {stats ? formatNumber(stats.products.active) : '0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {stats ? `${stats.products.active} approved` : 'Approved products'}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl">
            <BoxIcon className="text-purple-600 dark:text-purple-400 size-6" />
          </div>
        </div>
      </div>

      {/* <!-- Total Wallet Card --> */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Total Wallet
              </p>
            </div>
            <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 mb-1">
              {stats ? `$${formatNumber(stats.wallet?.total || 0)}` : '$0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              All customers balance
            </p>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-xl">
            <DollarLineIcon className="text-teal-600 dark:text-teal-400 size-6" />
          </div>
        </div>
      </div>

      {/* <!-- Today Orders Card --> */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Today Orders
              </p>
            </div>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mb-1">
              {stats ? formatNumber(stats.orders.todayPlaced || 0) : '0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {stats ? `${stats.orders.todayPlaced || 0} placed, ${stats.orders.today || 0} delivered` : 'Placed & Delivered'}
            </p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl">
            <BoxIconLine className="text-rose-600 dark:text-rose-400 size-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
