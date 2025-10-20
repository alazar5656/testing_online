import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle } from 'lucide-react';

const fetchProducts = async (params) => {
  const response = await axios.get('/products', { params });
  return response.data;
};

const fetchCategories = async () => {
  const response = await axios.get('/categories');
  return response.data.categories;
};

export default function Products() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    category_id: '',
    price: '',
    cost: '',
    stock_quantity: '',
    min_stock_level: '10',
    status: 'active'
  });

  const queryClient = useQueryClient();

  const { data: productsData, isLoading } = useQuery(
    ['products', { page, search, category }],
    () => fetchProducts({ page, search, category, limit: 10 }),
    { keepPreviousData: true }
  );

  const { data: categories } = useQuery('categories', fetchCategories);

  const createMutation = useMutation(
    (data) => axios.post('/products', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('products');
        toast.success('Product created successfully');
        setShowModal(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create product');
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/products/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('products');
        toast.success('Product updated successfully');
        setShowModal(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update product');
      }
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/products/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('products');
        toast.success('Product deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete product');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sku: '',
      category_id: '',
      price: '',
      cost: '',
      stock_quantity: '',
      min_stock_level: '10',
      status: 'active'
    });
    setEditingProduct(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      sku: product.sku,
      category_id: product.category_id || '',
      price: product.price,
      cost: product.cost || '',
      stock_quantity: product.stock_quantity,
      min_stock_level: product.min_stock_level,
      status: product.status
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product inventory</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </button>
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
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
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
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
                  {productsData?.products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.category_name || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${product.price}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-900">{product.stock_quantity}</span>
                          {product.low_stock && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500 ml-2" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${product.status === 'active' ? 'badge-default' : 'badge-secondary'}`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
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

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="Product Name"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="SKU"
                  className="input"
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  required
                />
                <select
                  className="input"
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                >
                  <option value="">Select Category</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    className="input"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Cost"
                    className="input"
                    value={formData.cost}
                    onChange={(e) => setFormData({...formData, cost: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Stock Quantity"
                    className="input"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Min Stock Level"
                    className="input"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                  />
                </div>
                <textarea
                  placeholder="Description"
                  className="input"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
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
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                  >
                    {editingProduct ? 'Update' : 'Create'}
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