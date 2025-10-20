import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const fetchDashboardData = async () => {
  const [overview, sales, inventory] = await Promise.all([
    axios.get('/dashboard/overview'),
    axios.get('/dashboard/sales?period=7d'),
    axios.get('/dashboard/inventory')
  ]);
  
  return {
    overview: overview.data.overview,
    sales: sales.data,
    inventory: inventory.data
  };
};

const StatCard = ({ title, value, icon: Icon, change, changeType = 'positive' }) => (
  <div className="card">
    <div className="card-content p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-xs ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
              {change}
            </p>
          )}
        </div>
        <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  </div>
);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function Dashboard() {
  const { data, isLoading, error } = useQuery('dashboard', fetchDashboardData);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load dashboard data</p>
      </div>
    );
  }

  const { overview, sales, inventory } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your store.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={`$${overview.total_revenue.toLocaleString()}`}
          icon={DollarSign}
          change={`$${overview.today_revenue} today`}
        />
        <StatCard
          title="Total Orders"
          value={overview.total_orders.toLocaleString()}
          icon={ShoppingCart}
          change={`${overview.today_orders} today`}
        />
        <StatCard
          title="Total Customers"
          value={overview.total_customers.toLocaleString()}
          icon={Users}
        />
        <StatCard
          title="Total Products"
          value={overview.total_products.toLocaleString()}
          icon={Package}
        />
      </div>

      {/* Alerts */}
      {(overview.pending_orders > 0 || overview.low_stock_products > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {overview.pending_orders > 0 && (
            <div className="card border-orange-200 bg-orange-50">
              <div className="card-content p-6">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-orange-600 mr-2" />
                  <h3 className="text-sm font-medium text-orange-800">Pending Orders</h3>
                </div>
                <p className="mt-2 text-2xl font-bold text-orange-900">{overview.pending_orders}</p>
                <p className="text-sm text-orange-700">Orders waiting to be processed</p>
              </div>
            </div>
          )}
          
          {overview.low_stock_products > 0 && (
            <div className="card border-red-200 bg-red-50">
              <div className="card-content p-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  <h3 className="text-sm font-medium text-red-800">Low Stock Alert</h3>
                </div>
                <p className="mt-2 text-2xl font-bold text-red-900">{overview.low_stock_products}</p>
                <p className="text-sm text-red-700">Products running low on stock</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Sales Overview (Last 7 Days)</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sales.sales_by_day}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Order Status Distribution</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sales.sales_by_status}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {sales.sales_by_status.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Top Selling Products</h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {sales.top_products.slice(0, 5).map((product, index) => (
                <div key={product.sku} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
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

        {/* Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Stock Alerts</h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {inventory.stock_alerts.slice(0, 5).map((product) => (
                <div key={product.sku} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{product.stock_quantity} left</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.alert_type === 'out_of_stock' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {product.alert_type === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}