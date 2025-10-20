const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all products with pagination and filtering
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 10, search = '', category = '', status = '' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (search) {
    whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category) {
    whereClause += ' AND p.category_id = ?';
    params.push(category);
  }

  if (status) {
    whereClause += ' AND p.status = ?';
    params.push(status);
  }

  const query = `
    SELECT p.*, c.name as category_name,
           CASE WHEN p.stock_quantity <= p.min_stock_level THEN 1 ELSE 0 END as low_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    db.all(query, [...params, parseInt(limit), parseInt(offset)], (err, products) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Get single product
router.get('/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;

  db.get(query, [req.params.id], (err, product) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ product });
  });
});

// Create product
router.post('/', authenticateToken, [
  body('name').notEmpty().withMessage('Product name is required'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock_quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name,
    description,
    sku,
    category_id,
    price,
    cost,
    stock_quantity,
    min_stock_level = 10,
    image_url,
    status = 'active'
  } = req.body;

  // Check if SKU already exists
  db.get('SELECT id FROM products WHERE sku = ?', [sku], (err, existingProduct) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (existingProduct) {
      return res.status(400).json({ message: 'SKU already exists' });
    }

    db.run(
      `INSERT INTO products (name, description, sku, category_id, price, cost, stock_quantity, min_stock_level, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, sku, category_id, price, cost, stock_quantity, min_stock_level, image_url, status],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Failed to create product' });
        }

        // Log inventory transaction
        db.run(
          'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes) VALUES (?, ?, ?, ?)',
          [this.lastID, 'initial_stock', stock_quantity, 'Initial stock entry']
        );

        res.status(201).json({
          message: 'Product created successfully',
          product: { id: this.lastID, ...req.body }
        });
      }
    );
  });
});

// Update product
router.put('/:id', authenticateToken, [
  body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const productId = req.params.id;
  const updates = [];
  const values = [];

  // Get current product for stock comparison
  db.get('SELECT stock_quantity FROM products WHERE id = ?', [productId], (err, currentProduct) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!currentProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const allowedFields = ['name', 'description', 'sku', 'category_id', 'price', 'cost', 'stock_quantity', 'min_stock_level', 'image_url', 'status'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(productId);

    db.run(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Failed to update product' });
        }

        // Log inventory transaction if stock changed
        if (req.body.stock_quantity !== undefined && req.body.stock_quantity !== currentProduct.stock_quantity) {
          const difference = req.body.stock_quantity - currentProduct.stock_quantity;
          const transactionType = difference > 0 ? 'adjustment_in' : 'adjustment_out';
          
          db.run(
            'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes) VALUES (?, ?, ?, ?)',
            [productId, transactionType, Math.abs(difference), 'Manual stock adjustment']
          );
        }

        res.json({ message: 'Product updated successfully' });
      }
    );
  });
});

// Delete product
router.delete('/:id', authenticateToken, (req, res) => {
  const productId = req.params.id;

  // Check if product exists and has no order items
  db.get('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?', [productId], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.count > 0) {
      return res.status(400).json({ message: 'Cannot delete product with existing orders' });
    }

    db.run('DELETE FROM products WHERE id = ?', [productId], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to delete product' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json({ message: 'Product deleted successfully' });
    });
  });
});

// Get low stock products
router.get('/alerts/low-stock', authenticateToken, (req, res) => {
  const query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock_quantity <= p.min_stock_level AND p.status = 'active'
    ORDER BY p.stock_quantity ASC
  `;

  db.all(query, [], (err, products) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ products });
  });
});

module.exports = router;