import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Tag } from 'lucide-react';

const fetchCategories = async (params) => {
  const response = await axios.get('/categories', { params });
  return response.data;
};

export default function Categories() {
  const [search, setSearch] = useState('');
  const [page] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  });

  const queryClient = useQueryClient();

  const { data: categoriesData, isLoading } = useQuery(
    ['categories', { page, search }],
    () => fetchCategories({ page, search, limit: 10 }),
    { keepPreviousData: true }
  );

  const createMutation = useMutation(
    (data) => axios.post('/categories', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories');
        toast.success('Category created successfully');
        setShowModal(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create category');
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/categories/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories');
        toast.success('Category updated successfully');
        setShowModal(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update category');
      }
    }
  );

  const deleteMutation = useMutation(
    (id) => axios.delete(`/categories/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories');
        toast.success('Category deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete category');
      }
    }
  );

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'active'
    });
    setEditingCategory(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      status: category.status
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600">Manage your product categories</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-content p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search categories..."
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Categories Table */}
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
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
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
                  {categoriesData?.categories?.map((category) => (
                    <tr key={category.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Tag className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{category.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {category.description || 'No description'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {category.product_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`badge ${category.status === 'active' ? 'badge-default' : 'badge-secondary'}`}>
                          {category.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(category)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
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

      {/* Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="Category Name"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
                <textarea
                  placeholder="Description"
                  className="input"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
                <select
                  className="input"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
                    {editingCategory ? 'Update' : 'Create'}
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