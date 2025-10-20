const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { db, dbWithTimeout } = require('../database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role = 'user' } = req.body;

    // Check if user already exists with timeout protection
    try {
      const user = await dbWithTimeout.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username], 5000);
      
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with timeout protection
      const result = await dbWithTimeout.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, role],
        5000
      );

      const newUser = {
        id: result.lastID,
        username,
        email,
        role
      };

      const token = generateToken(newUser);
      res.status(201).json({
        message: 'User created successfully',
        user: newUser,
        token
      });
    } catch (error) {
      console.error('Registration error:', error.message);
      if (error.message.includes('timeout')) {
        return res.status(408).json({ message: 'Database operation timed out. Please try again.' });
      }
      return res.status(500).json({ message: 'Database error during registration' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Find user with timeout protection - this is the equivalent of users.findOne()
      const user = await dbWithTimeout.get('SELECT * FROM users WHERE email = ?', [email], 5000);

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = generateToken(user);
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        message: 'Login successful',
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error('Login error:', error.message);
      if (error.message.includes('timeout')) {
        return res.status(408).json({ message: 'Database operation timed out. Please try again.' });
      }
      return res.status(500).json({ message: 'Database error during login' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbWithTimeout.get('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.user.id], 5000);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error.message);
    if (error.message.includes('timeout')) {
      return res.status(408).json({ message: 'Database operation timed out. Please try again.' });
    }
    return res.status(500).json({ message: 'Database error' });
  }
});

// Update profile
router.put('/profile', authenticateToken, [
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email } = req.body;
  const updates = [];
  const values = [];

  if (username) {
    updates.push('username = ?');
    values.push(username);
  }
  if (email) {
    updates.push('email = ?');
    values.push(email);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No updates provided' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.user.id);

  try {
    await dbWithTimeout.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values,
      5000
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error.message);
    if (error.message.includes('timeout')) {
      return res.status(408).json({ message: 'Database operation timed out. Please try again.' });
    }
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;