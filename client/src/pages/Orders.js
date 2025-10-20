import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Search, Edit, Trash2, ShoppingCart, Eye } from 'lucide-react';

const fetchOrders = async (params) => {
  const response = await axios.get('/orders', { params });
  return response.data;
};

const fetchCustomers = async () => {
  const response = await axios.get('/customers');
  return response.data.customers;
};

export default function Orders() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    status: 'pending',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: ordersData, isLoading } = useQuery(
    ['orders', { page, search, status }],
    () => fetchOrders({ page, search, status, limit: 10 }),
    { keepPreviousData: true }
  );

  const { data: customers } = useQuery('customers', fetchCustomers);

  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/orders/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        toast.success('Order updated successfully');
        setShowModal(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update order');
      }
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/orders/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        toast.success('Order deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete order');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      customer_id: '',
      status: 'pending',
      notes: ''
    });
    setEditingOrder(null);
    setViewingOrder(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data: formData });
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      customer_id: order.customer_id,
      status: order.status,
      notes: order.notes || ''
    });
    setShowModal(true);
  };

  const handleView = (order) => {
    setViewingOrder(order);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Manage customer orders and fulfillment</p>
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
                  placeholder="Search orders..."
                  className="input pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
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
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ordersData?.orders?.map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <ShoppingCart className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                            <div className="text-sm text-gray-500">{order.items_count || 0} items</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.customer_name || 'Unknown Customer'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${order.total_amount || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleView(order)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {viewingOrder ? `Order #${viewingOrder.id}` : 'Edit Order'}
              </h3>
              
              {viewingOrder ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Customer</label>
                    <p className="text-sm text-gray-900">{viewingOrder.customer_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(viewingOrder.status)}`}>
                      {viewingOrder.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                    <p className="text-sm text-gray-900">${viewingOrder.total_amount || '0.00'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Order Date</label>
                    <p className="text-sm text-gray-900">{new Date(viewingOrder.created_at).toLocaleString()}</p>
                  </div>
                  {viewingOrder.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <p className="text-sm text-gray-900">{viewingOrder.notes}</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="btn-outline"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <select
                    className="input"
                    value={formData.customer_id}
                    onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers?.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
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
                      disabled={updateMutation.isLoading}
                    >
                      Update
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}