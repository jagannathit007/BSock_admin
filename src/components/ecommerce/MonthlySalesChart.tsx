import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { MoreDotIcon } from "../../icons";
import { useState, useEffect } from "react";
import { DashboardService, ChartData } from "../../services/dashboard/dashboard.services";

export default function MonthlySalesChart() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        const data = await DashboardService.getSalesChart(period);
        setChartData(data);
      } catch (error) {
        console.error("Error fetching sales chart:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [period]);
  const formatCurrency = (val: number) => {
    if (val >= 1000000) {
      return '$' + (val / 1000000).toFixed(1) + 'M';
    } else if (val >= 1000) {
      return '$' + (val / 1000).toFixed(1) + 'K';
    }
    return '$' + val.toLocaleString();
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return 'This Month';
    }
  };

  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Inter, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: period === 'today' ? "90%" : period === 'week' ? "60%" : "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      categories: chartData?.categories || [],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Inter",
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => formatCurrency(val),
      },
    },
  };

  const series = [
    {
      name: "Sales",
      data: chartData?.data || [],
    },
  ];

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handlePeriodChange = (newPeriod: 'today' | 'week' | 'month' | 'year') => {
    setPeriod(newPeriod);
    setIsOpen(false);
  };
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-44 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Delivered Sales Chart
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{getPeriodLabel()}</p>
        </div>
        <div className="relative inline-block">
          <button className="dropdown-toggle" onClick={toggleDropdown}>
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-6" />
          </button>
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="w-40 p-2"
          >
            <DropdownItem
              onItemClick={() => handlePeriodChange('today')}
              className={`flex w-full font-normal text-left rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300 ${
                period === 'today' ? 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Today
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handlePeriodChange('week')}
              className={`flex w-full font-normal text-left rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300 ${
                period === 'week' ? 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              This Week
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handlePeriodChange('month')}
              className={`flex w-full font-normal text-left rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300 ${
                period === 'month' ? 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              This Month
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handlePeriodChange('year')}
              className={`flex w-full font-normal text-left rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300 ${
                period === 'year' ? 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              This Year
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      {chartData && (
        <div className="mb-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total: {formatCurrency(chartData.total)}
          </p>
        </div>
      )}

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          <Chart options={options} series={series} type="bar" height={180} />
        </div>
      </div>
    </div>
  );
}
