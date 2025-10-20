const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get inventory transactions
router.get('/transactions', authenticateToken, (req, res) => {
  const { page = 1, limit = 20, product_id = '', type = '' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (product_id) {
    whereClause += ' AND it.product_id = ?';
    params.push(product_id);
  }

  if (type) {
    whereClause += ' AND it.transaction_type = ?';
    params.push(type);
  }

  const query = `
    SELECT it.*, p.name as product_name, p.sku as product_sku
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.id
    ${whereClause}
    ORDER BY it.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.id
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    db.all(query, [...params, parseInt(limit), parseInt(offset)], (err, transactions) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        transactions,
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

// Adjust stock
router.post('/adjust', authenticateToken, [
  body('product_id').isInt().withMessage('Valid product ID is required'),
  body('quantity').isInt().withMessage('Quantity must be an integer'),
  body('type').isIn(['adjustment_in', 'adjustment_out']).withMessage('Invalid adjustment type'),
  body('notes').optional().isString()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { product_id, quantity, type, notes = '' } = req.body;
  const adjustmentQuantity = type === 'adjustment_in' ? Math.abs(quantity) : -Math.abs(quantity);

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Check if product exists and get current stock
    db.get('SELECT stock_quantity FROM products WHERE id = ?', [product_id], (err, product) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ message: 'Database error' });
      }

      if (!product) {
        db.run('ROLLBACK');
        return res.status(404).json({ message: 'Product not found' });
      }

      const newStock = product.stock_quantity + adjustmentQuantity;
      if (newStock < 0) {
        db.run('ROLLBACK');
        return res.status(400).json({ message: 'Insufficient stock for adjustment' });
      }

      // Update product stock
      db.run(
        'UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStock, product_id],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Failed to update stock' });
          }

          // Log inventory transaction
          db.run(
            'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes) VALUES (?, ?, ?, ?)',
            [product_id, type, Math.abs(quantity), notes],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Failed to log transaction' });
              }

              db.run('COMMIT');
              res.json({
                message: 'Stock adjusted successfully',
                transaction: {
                  id: this.lastID,
                  product_id,
                  type,
                  quantity: Math.abs(quantity),
                  notes,
                  new_stock: newStock
                }
              });
            }
          );
        }
      );
    });
  });
});

// Get stock levels
router.get('/stock-levels', authenticateToken, (req, res) => {
  const { low_stock_only = 'false' } = req.query;

  let whereClause = 'WHERE p.status = "active"';
  if (low_stock_only === 'true') {
    whereClause += ' AND p.stock_quantity <= p.min_stock_level';
  }

  const query = `
    SELECT p.id, p.name, p.sku, p.stock_quantity, p.min_stock_level,
           c.name as category_name,
           CASE WHEN p.stock_quantity <= p.min_stock_level THEN 1 ELSE 0 END as is_low_stock,
           CASE 
             WHEN p.stock_quantity = 0 THEN 'out_of_stock'
             WHEN p.stock_quantity <= p.min_stock_level THEN 'low_stock'
             ELSE 'in_stock'
           END as stock_status
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY p.stock_quantity ASC, p.name
  `;

  db.all(query, [], (err, products) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ products });
  });
});

// Get inventory summary
router.get('/summary', authenticateToken, (req, res) => {
  const queries = {
    totalProducts: 'SELECT COUNT(*) as count FROM products WHERE status = "active"',
    totalValue: 'SELECT SUM(price * stock_quantity) as value FROM products WHERE status = "active"',
    lowStockCount: 'SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock_level AND status = "active"',
    outOfStockCount: 'SELECT COUNT(*) as count FROM products WHERE stock_quantity = 0 AND status = "active"',
    recentTransactions: `
      SELECT COUNT(*) as count 
      FROM inventory_transactions 
      WHERE DATE(created_at) = DATE('now')
    `
  };

  const results = {};
  let completed = 0;
  const total = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      results[key] = result.count !== undefined ? result.count : result.value || 0;
      completed++;

      if (completed === total) {
        res.json({
          summary: {
            total_products: results.totalProducts,
            total_inventory_value: results.totalValue,
            low_stock_products: results.lowStockCount,
            out_of_stock_products: results.outOfStockCount,
            todays_transactions: results.recentTransactions
          }
        });
      }
    });
  });
});

module.exports = router;