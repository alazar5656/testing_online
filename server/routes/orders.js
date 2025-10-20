const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp.slice(-6)}-${random}`;
};

// Get all orders with pagination and filtering
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 10, status = '', customer = '', date_from = '', date_to = '' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (status) {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }

  if (customer) {
    whereClause += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)';
    params.push(`%${customer}%`, `%${customer}%`, `%${customer}%`);
  }

  if (date_from) {
    whereClause += ' AND DATE(o.created_at) >= ?';
    params.push(date_from);
  }

  if (date_to) {
    whereClause += ' AND DATE(o.created_at) <= ?';
    params.push(date_to);
  }

  const query = `
    SELECT o.*, 
           c.first_name || ' ' || c.last_name as customer_name,
           c.email as customer_email,
           COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ${whereClause}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT o.id) as total
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    db.all(query, [...params, parseInt(limit), parseInt(offset)], (err, orders) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        orders,
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

// Get single order with items
router.get('/:id', authenticateToken, (req, res) => {
  const orderQuery = `
    SELECT o.*, 
           c.first_name || ' ' || c.last_name as customer_name,
           c.email as customer_email,
           c.phone as customer_phone,
           c.address as customer_address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ?
  `;

  const itemsQuery = `
    SELECT oi.*, p.name as product_name, p.sku as product_sku
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `;

  db.get(orderQuery, [req.params.id], (err, order) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    db.all(itemsQuery, [req.params.id], (err, items) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({ order: { ...order, items } });
    });
  });
});

// Create order
router.post('/', authenticateToken, [
  body('customer_id').isInt().withMessage('Valid customer ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt().withMessage('Valid product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('total_amount').isFloat({ min: 0 }).withMessage('Total amount must be positive')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    customer_id,
    items,
    total_amount,
    tax_amount = 0,
    discount_amount = 0,
    payment_method = 'cash',
    payment_status = 'pending',
    notes = ''
  } = req.body;

  const order_number = generateOrderNumber();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Create order
    db.run(
      `INSERT INTO orders (customer_id, order_number, total_amount, tax_amount, discount_amount, payment_method, payment_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, order_number, total_amount, tax_amount, discount_amount, payment_method, payment_status, notes],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Failed to create order' });
        }

        const orderId = this.lastID;
        let itemsProcessed = 0;
        let hasError = false;

        // Process each item
        items.forEach(item => {
          // Get product info and check stock
          db.get('SELECT price, stock_quantity FROM products WHERE id = ?', [item.product_id], (err, product) => {
            if (err || !product) {
              if (!hasError) {
                hasError = true;
                db.run('ROLLBACK');
                return res.status(400).json({ message: `Product not found: ${item.product_id}` });
              }
              return;
            }

            if (product.stock_quantity < item.quantity) {
              if (!hasError) {
                hasError = true;
                db.run('ROLLBACK');
                return res.status(400).json({ message: `Insufficient stock for product ${item.product_id}` });
              }
              return;
            }

            const unit_price = item.unit_price || product.price;
            const total_price = unit_price * item.quantity;

            // Insert order item
            db.run(
              'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
              [orderId, item.product_id, item.quantity, unit_price, total_price],
              (err) => {
                if (err && !hasError) {
                  hasError = true;
                  db.run('ROLLBACK');
                  return res.status(500).json({ message: 'Failed to create order item' });
                }

                // Update product stock
                db.run(
                  'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                  [item.quantity, item.product_id],
                  (err) => {
                    if (err && !hasError) {
                      hasError = true;
                      db.run('ROLLBACK');
                      return res.status(500).json({ message: 'Failed to update stock' });
                    }

                    // Log inventory transaction
                    db.run(
                      'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?)',
                      [item.product_id, 'sale', -item.quantity, orderId, 'order', `Order ${order_number}`]
                    );

                    itemsProcessed++;
                    if (itemsProcessed === items.length && !hasError) {
                      db.run('COMMIT');
                      res.status(201).json({
                        message: 'Order created successfully',
                        order: { id: orderId, order_number, ...req.body }
                      });
                    }
                  }
                );
              }
            );
          });
        });
      }
    );
  });
});

// Update order status
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status } = req.body;
  const orderId = req.params.id;

  db.run(
    'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, orderId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to update order status' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.json({ message: 'Order status updated successfully' });
    }
  );
});

// Update payment status
router.put('/:id/payment', authenticateToken, [
  body('payment_status').isIn(['pending', 'paid', 'failed', 'refunded']).withMessage('Invalid payment status')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { payment_status, payment_method } = req.body;
  const orderId = req.params.id;

  const updates = ['payment_status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const values = [payment_status];

  if (payment_method) {
    updates.push('payment_method = ?');
    values.push(payment_method);
  }

  values.push(orderId);

  db.run(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to update payment status' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.json({ message: 'Payment status updated successfully' });
    }
  );
});

// Cancel order
router.delete('/:id', authenticateToken, (req, res) => {
  const orderId = req.params.id;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Get order items to restore stock
    db.all('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId], (err, items) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ message: 'Database error' });
      }

      // Restore stock for each item
      let itemsProcessed = 0;
      items.forEach(item => {
        db.run(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Failed to restore stock' });
            }

            // Log inventory transaction
            db.run(
              'INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?)',
              [item.product_id, 'return', item.quantity, orderId, 'order_cancellation', `Order ${orderId} cancelled`]
            );

            itemsProcessed++;
            if (itemsProcessed === items.length) {
              // Update order status to cancelled
              db.run(
                'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['cancelled', orderId],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ message: 'Failed to cancel order' });
                  }

                  db.run('COMMIT');
                  res.json({ message: 'Order cancelled successfully' });
                }
              );
            }
          }
        );
      });

      if (items.length === 0) {
        // No items to process, just update status
        db.run(
          'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['cancelled', orderId],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Failed to cancel order' });
            }

            db.run('COMMIT');
            res.json({ message: 'Order cancelled successfully' });
          }
        );
      }
    });
  });
});

module.exports = router;