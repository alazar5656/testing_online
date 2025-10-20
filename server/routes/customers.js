const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all customers with pagination and search
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (search) {
    whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const query = `
    SELECT c.*, 
           COUNT(o.id) as total_orders,
           COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
    ${whereClause}
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `SELECT COUNT(*) as total FROM customers ${whereClause}`;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    db.all(query, [...params, parseInt(limit), parseInt(offset)], (err, customers) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        customers,
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

// Get single customer
router.get('/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT c.*, 
           COUNT(o.id) as total_orders,
           COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
    WHERE c.id = ?
    GROUP BY c.id
  `;

  db.get(query, [req.params.id], (err, customer) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get recent orders
    db.all(
      'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.params.id],
      (err, orders) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }

        res.json({ customer: { ...customer, recent_orders: orders } });
      }
    );
  });
});

// Create customer
router.post('/', authenticateToken, [
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('email').optional().isEmail().withMessage('Please provide a valid email')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    first_name,
    last_name,
    email,
    phone,
    address,
    city,
    postal_code,
    country
  } = req.body;

  db.run(
    `INSERT INTO customers (first_name, last_name, email, phone, address, city, postal_code, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [first_name, last_name, email, phone, address, city, postal_code, country],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ message: 'Email already exists' });
        }
        return res.status(500).json({ message: 'Failed to create customer' });
      }

      res.status(201).json({
        message: 'Customer created successfully',
        customer: { id: this.lastID, ...req.body }
      });
    }
  );
});

// Update customer
router.put('/:id', authenticateToken, [
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'postal_code', 'country'];
  const updates = [];
  const values = [];

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
  values.push(req.params.id);

  db.run(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ message: 'Email already exists' });
        }
        return res.status(500).json({ message: 'Failed to update customer' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json({ message: 'Customer updated successfully' });
    }
  );
});

// Delete customer
router.delete('/:id', authenticateToken, (req, res) => {
  const customerId = req.params.id;

  // Check if customer has orders
  db.get('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?', [customerId], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.count > 0) {
      return res.status(400).json({ message: 'Cannot delete customer with existing orders' });
    }

    db.run('DELETE FROM customers WHERE id = ?', [customerId], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to delete customer' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      res.json({ message: 'Customer deleted successfully' });
    });
  });
});

module.exports = router;