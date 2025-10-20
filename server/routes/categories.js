const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all categories
router.get('/', authenticateToken, (req, res) => {
  const query = `
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    GROUP BY c.id
    ORDER BY c.name
  `;

  db.all(query, [], (err, categories) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ categories });
  });
});

// Get single category
router.get('/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    WHERE c.id = ?
    GROUP BY c.id
  `;

  db.get(query, [req.params.id], (err, category) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ category });
  });
});

// Create category
router.post('/', authenticateToken, [
  body('name').notEmpty().withMessage('Category name is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description } = req.body;

  db.run(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    [name, description],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ message: 'Category name already exists' });
        }
        return res.status(500).json({ message: 'Failed to create category' });
      }

      res.status(201).json({
        message: 'Category created successfully',
        category: { id: this.lastID, name, description }
      });
    }
  );
});

// Update category
router.put('/:id', authenticateToken, [
  body('name').optional().notEmpty().withMessage('Category name cannot be empty')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No updates provided' });
  }

  values.push(req.params.id);

  db.run(
    `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ message: 'Category name already exists' });
        }
        return res.status(500).json({ message: 'Failed to update category' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Category not found' });
      }

      res.json({ message: 'Category updated successfully' });
    }
  );
});

// Delete category
router.delete('/:id', authenticateToken, (req, res) => {
  const categoryId = req.params.id;

  // Check if category has products
  db.get('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [categoryId], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.count > 0) {
      return res.status(400).json({ message: 'Cannot delete category with existing products' });
    }

    db.run('DELETE FROM categories WHERE id = ?', [categoryId], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to delete category' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Category not found' });
      }

      res.json({ message: 'Category deleted successfully' });
    });
  });
});

module.exports = router;