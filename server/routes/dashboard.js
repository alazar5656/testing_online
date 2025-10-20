const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard overview
router.get('/overview', authenticateToken, (req, res) => {
  const queries = {
    totalRevenue: `
      SELECT COALESCE(SUM(total_amount), 0) as revenue 
      FROM orders 
      WHERE status != 'cancelled' AND payment_status = 'paid'
    `,
    totalOrders: 'SELECT COUNT(*) as count FROM orders WHERE status != "cancelled"',
    totalCustomers: 'SELECT COUNT(*) as count FROM customers',
    totalProducts: 'SELECT COUNT(*) as count FROM products WHERE status = "active"',
    pendingOrders: 'SELECT COUNT(*) as count FROM orders WHERE status = "pending"',
    lowStockProducts: 'SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock_level AND status = "active"',
    todayRevenue: `
      SELECT COALESCE(SUM(total_amount), 0) as revenue 
      FROM orders 
      WHERE DATE(created_at) = DATE('now') AND status != 'cancelled' AND payment_status = 'paid'
    `,
    todayOrders: 'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = DATE("now") AND status != "cancelled"'
  };

  const results = {};
  let completed = 0;
  const total = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [], (err, result) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        return res.status(500).json({ message: 'Database error' });
      }

      results[key] = result.revenue !== undefined ? result.revenue : result.count || 0;
      completed++;

      if (completed === total) {
        res.json({
          overview: {
            total_revenue: results.totalRevenue,
            total_orders: results.totalOrders,
            total_customers: results.totalCustomers,
            total_products: results.totalProducts,
            pending_orders: results.pendingOrders,
            low_stock_products: results.lowStockProducts,
            today_revenue: results.todayRevenue,
            today_orders: results.todayOrders
          }
        });
      }
    });
  });
});

// Get sales analytics
router.get('/sales', authenticateToken, (req, res) => {
  const { period = '7d' } = req.query;
  
  let dateFilter = '';
  switch (period) {
    case '7d':
      dateFilter = "DATE(created_at) >= DATE('now', '-7 days')";
      break;
    case '30d':
      dateFilter = "DATE(created_at) >= DATE('now', '-30 days')";
      break;
    case '90d':
      dateFilter = "DATE(created_at) >= DATE('now', '-90 days')";
      break;
    case '1y':
      dateFilter = "DATE(created_at) >= DATE('now', '-1 year')";
      break;
    default:
      dateFilter = "DATE(created_at) >= DATE('now', '-7 days')";
  }

  const salesByDayQuery = `
    SELECT DATE(created_at) as date,
           COUNT(*) as orders,
           COALESCE(SUM(total_amount), 0) as revenue
    FROM orders 
    WHERE ${dateFilter} AND status != 'cancelled'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  const salesByStatusQuery = `
    SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
    FROM orders 
    WHERE ${dateFilter}
    GROUP BY status
    ORDER BY count DESC
  `;

  const topProductsQuery = `
    SELECT p.name, p.sku, SUM(oi.quantity) as quantity_sold, SUM(oi.total_price) as revenue
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE ${dateFilter.replace('created_at', 'o.created_at')} AND o.status != 'cancelled'
    GROUP BY p.id, p.name, p.sku
    ORDER BY quantity_sold DESC
    LIMIT 10
  `;

  db.all(salesByDayQuery, [], (err, salesByDay) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    db.all(salesByStatusQuery, [], (err, salesByStatus) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      db.all(topProductsQuery, [], (err, topProducts) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }

        res.json({
          sales_by_day: salesByDay,
          sales_by_status: salesByStatus,
          top_products: topProducts
        });
      });
    });
  });
});

// Get customer analytics
router.get('/customers', authenticateToken, (req, res) => {
  const topCustomersQuery = `
    SELECT c.first_name || ' ' || c.last_name as name,
           c.email,
           COUNT(o.id) as total_orders,
           COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'cancelled'
    GROUP BY c.id, c.first_name, c.last_name, c.email
    HAVING total_orders > 0
    ORDER BY total_spent DESC
    LIMIT 10
  `;

  const customerGrowthQuery = `
    SELECT DATE(created_at) as date, COUNT(*) as new_customers
    FROM customers
    WHERE DATE(created_at) >= DATE('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  db.all(topCustomersQuery, [], (err, topCustomers) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    db.all(customerGrowthQuery, [], (err, customerGrowth) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        top_customers: topCustomers,
        customer_growth: customerGrowth
      });
    });
  });
});

// Get inventory analytics
router.get('/inventory', authenticateToken, (req, res) => {
  const inventoryValueQuery = `
    SELECT c.name as category,
           COUNT(p.id) as product_count,
           SUM(p.stock_quantity) as total_quantity,
           SUM(p.price * p.stock_quantity) as total_value
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'active'
    GROUP BY c.id, c.name
    ORDER BY total_value DESC
  `;

  const stockAlertsQuery = `
    SELECT p.name, p.sku, p.stock_quantity, p.min_stock_level,
           CASE 
             WHEN p.stock_quantity = 0 THEN 'out_of_stock'
             WHEN p.stock_quantity <= p.min_stock_level THEN 'low_stock'
           END as alert_type
    FROM products p
    WHERE (p.stock_quantity = 0 OR p.stock_quantity <= p.min_stock_level) 
    AND p.status = 'active'
    ORDER BY p.stock_quantity ASC
    LIMIT 20
  `;

  const recentTransactionsQuery = `
    SELECT it.transaction_type, it.quantity, it.created_at, it.notes,
           p.name as product_name, p.sku as product_sku
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.id
    ORDER BY it.created_at DESC
    LIMIT 10
  `;

  db.all(inventoryValueQuery, [], (err, inventoryValue) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    db.all(stockAlertsQuery, [], (err, stockAlerts) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      db.all(recentTransactionsQuery, [], (err, recentTransactions) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }

        res.json({
          inventory_by_category: inventoryValue,
          stock_alerts: stockAlerts,
          recent_transactions: recentTransactions
        });
      });
    });
  });
});

module.exports = router;