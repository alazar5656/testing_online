import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Package, AlertTriangle, TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';

const fetchInventory = async () => {
  const [stockLevels, summary, transactions] = await Promise.all([
    axios.get('/inventory/stock-levels'),
    axios.get('/inventory/summary'),
    axios.get('/inventory/transactions?limit=10')
  ]);
  
  return {
    stockLevels: stockLevels.data.products,
    summary: summary.data.summary,
    transactions: transactions.data.transactions
  };
};

export default function Inventory() {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentData, setAdjustmentData] = useState({
    quantity: '',
    type: 'adjustment_in',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery('inventory', fetchInventory);

  const adjustStockMutation = useMutation(
    (data) => axios.post('/inventory/adjust', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('inventory');
        queryClient.invalidateQueries('products');
        toast.success('Stock adjusted successfully');
        setShowAdjustModal(false);
        setAdjustmentData({ quantity: '', type: 'adjustment_in', notes: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to adjust stock');
      }
    }
  );

  const handleAdjustStock = (product) => {
    setSelectedProduct(product);
    setShowAdjustModal(true);
  };

  const handleSubmitAdjustment = (e) => {
    e.preventDefault();
    adjustStockMutation.mutate({
      product_id: selectedProduct.id,
      ...adjustmentData
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { stockLevels, summary, transactions } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-600">Monitor stock levels and manage inventory</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_products}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                <p className="text-2xl font-bold text-gray-900">${summary.total_inventory_value?.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card border-yellow-200 bg-yellow-50">
          <div className="card-content p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-900">{summary.low_stock_products}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card border-red-200 bg-red-50">
          <div className="card-content p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-800">Out of Stock</p>
                <p className="text-2xl font-bold text-red-900">{summary.out_of_stock_products}</p>
              </div>
              <Package className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Levels */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Stock Levels</h3>
          </div>
          <div className="card-content p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockLevels?.slice(0, 10).map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.sku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.stock_quantity} / {product.min_stock_level}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.stock_status === 'out_of_stock' 
                            ? 'bg-red-100 text-red-800'
                            : product.stock_status === 'low_stock'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {product.stock_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleAdjustStock(product)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
          </div>
          <div className="card-content p-0">
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-3 p-6">
                {transactions?.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        transaction.quantity > 0 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {transaction.quantity > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{transaction.product_name}</p>
                        <p className="text-xs text-gray-500">{transaction.transaction_type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        transaction.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Adjust Stock - {selectedProduct.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Current stock: {selectedProduct.stock_quantity}
              </p>
              <form onSubmit={handleSubmitAdjustment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adjustment Type
                  </label>
                  <select
                    className="input"
                    value={adjustmentData.type}
                    onChange={(e) => setAdjustmentData({...adjustmentData, type: e.target.value})}
                  >
                    <option value="adjustment_in">Stock In (+)</option>
                    <option value="adjustment_out">Stock Out (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={adjustmentData.quantity}
                    onChange={(e) => setAdjustmentData({...adjustmentData, quantity: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    className="input"
                    rows="3"
                    value={adjustmentData.notes}
                    onChange={(e) => setAdjustmentData({...adjustmentData, notes: e.target.value})}
                    placeholder="Reason for adjustment..."
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjustModal(false);
                      setAdjustmentData({ quantity: '', type: 'adjustment_in', notes: '' });
                    }}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={adjustStockMutation.isLoading}
                  >
                    Adjust Stock
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