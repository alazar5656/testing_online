import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const fetchInventory = async (params) => {
  const response = await axios.get('/inventory', { params });
  return response.data;
};

const fetchProducts = async () => {
  const response = await axios.get('/products');
  return response.data.products;
};

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [alertType, setAlertType] = useState('');
  const [page] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    product_id: '',
    quantity_change: '',
    type: 'adjustment',
    reason: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: inventoryData, isLoading } = useQuery(
    ['inventory', { page, search, alertType }],
    () => fetchInventory({ page, search, alert_type: alertType, limit: 10 }),
    { keepPreviousData: true }
  );

  const { data: products } = useQuery('products', fetchProducts);

  const adjustMutation = useMutation(
    (data) => axios.post('/inventory/adjust', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('inventory');
        queryClient.invalidateQueries('products');
        toast.success('Inventory adjusted successfully');
        setShowModal(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to adjust inventory');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      product_id: '',
      quantity_change: '',
      type: 'adjustment',
      reason: '',
      notes: ''
    });
    setEditingItem(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    adjustMutation.mutate(formData);
  };

  const handleAdjust = (item) => {
    setEditingItem(item);
    setFormData({
      product_id: item.id,
      quantity_change: '',
      type: 'adjustment',
      reason: '',
      notes: ''
    });
    setShowModal(true);
  };

  const getAlertColor = (alertType) => {
    switch (alertType) {
      case 'out_of_stock': return 'text-red-600';
      case 'low_stock': return 'text-yellow-600';
      case 'overstock': return 'text-blue-600';
      default: return 'text-green-600';
    }
  };

  const getAlertIcon = (alertType) => {
    switch (alertType) {
      case 'out_of_stock': return AlertTriangle;
      case 'low_stock': return TrendingDown;
      case 'overstock': return TrendingUp;
      default: return Package;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600">Monitor and manage stock levels</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adjust Inventory
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{inventoryData?.summary?.total_products || 0}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-gray-900">{inventoryData?.summary?.out_of_stock || 0}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900">{inventoryData?.summary?.low_stock || 0}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">${inventoryData?.summary?.total_value || '0.00'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-content p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search products..."
                  className="input pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <select
              className="input"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
            >
              <option value="">All Items</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="overstock">Overstock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <div className="card-content p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Min Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventoryData?.items?.map((item) => {
                    const AlertIcon = getAlertIcon(item.alert_type);
                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Package className="h-8 w-8 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-500">{item.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-900">{item.stock_quantity}</span>
                            {item.alert_type && (
                              <AlertIcon className={`h-4 w-4 ml-2 ${getAlertColor(item.alert_type)}`} />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.min_stock_level}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${((item.stock_quantity || 0) * (item.cost || item.price || 0)).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.alert_type === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                            item.alert_type === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                            item.alert_type === 'overstock' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {item.alert_type ? item.alert_type.replace('_', ' ') : 'Normal'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleAdjust(item)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Adjust Inventory
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <select
                  className="input"
                  value={formData.product_id}
                  onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                  required
                  disabled={editingItem}
                >
                  <option value="">Select Product</option>
                  {products?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Quantity Change"
                    className="input"
                    value={formData.quantity_change}
                    onChange={(e) => setFormData({...formData, quantity_change: e.target.value})}
                    required
                  />
                  <select
                    className="input"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="adjustment">Adjustment</option>
                    <option value="restock">Restock</option>
                    <option value="sale">Sale</option>
                    <option value="damage">Damage</option>
                    <option value="return">Return</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Reason"
                  className="input"
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                />
                <textarea
                  placeholder="Notes"
                  className="input"
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={adjustMutation.isLoading}
                  >
                    Adjust
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}