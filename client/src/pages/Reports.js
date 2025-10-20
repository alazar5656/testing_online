import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';

const fetchReports = async (params) => {
  const response = await axios.get('/reports', { params });
  return response.data;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function Reports() {
  const [dateRange, setDateRange] = useState('30d');
  const [reportType, setReportType] = useState('sales');

  const { data: reportsData, isLoading } = useQuery(
    ['reports', { dateRange, reportType }],
    () => fetchReports({ period: dateRange, type: reportType }),
    { keepPreviousData: true }
  );

  const handleExport = (format) => {
    // Implementation for exporting reports
    console.log(`Exporting ${reportType} report as ${format}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Analytics and insights for your business</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => handleExport('pdf')}
            className="btn-outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="btn-outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-content p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              className="input"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="sales">Sales Report</option>
              <option value="inventory">Inventory Report</option>
              <option value="customers">Customer Report</option>
              <option value="products">Product Performance</option>
            </select>
            <select
              className="input"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${reportsData?.summary?.total_revenue || '0.00'}</p>
                <p className="text-xs text-green-600">+12% from last period</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <ShoppingCart className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{reportsData?.summary?.total_orders || 0}</p>
                <p className="text-xs text-blue-600">+8% from last period</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">New Customers</p>
                <p className="text-2xl font-bold text-gray-900">{reportsData?.summary?.new_customers || 0}</p>
                <p className="text-xs text-purple-600">+15% from last period</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Products Sold</p>
                <p className="text-2xl font-bold text-gray-900">{reportsData?.summary?.products_sold || 0}</p>
                <p className="text-xs text-orange-600">+5% from last period</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Revenue Trend</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportsData?.revenue_trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales by Category */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Sales by Category</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reportsData?.sales_by_category || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: $${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(reportsData?.sales_by_category || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Volume */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Order Volume</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportsData?.order_volume || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="orders" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Top Performing Products</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {(reportsData?.top_products || []).slice(0, 5).map((product, index) => (
                <div key={product.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{product.quantity_sold} sold</p>
                    <p className="text-sm text-gray-500">${product.revenue}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Detailed {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Data</h3>
        </div>
        <div className="card-content p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Order Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Growth
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(reportsData?.detailed_data || []).map((row, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${row.revenue || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.orders || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${row.avg_order_value || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (row.growth || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {(row.growth || 0) >= 0 ? '+' : ''}{row.growth || 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}