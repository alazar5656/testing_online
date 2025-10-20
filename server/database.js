const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'store_management.db');

// Create database connection with error handling and optimization
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    throw err;
  }
  console.log('Connected to SQLite database');
});

// Configure database for better performance and to prevent locking issues
db.configure('busyTimeout', 10000); // 10 second timeout for busy database
db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging for better concurrency
db.run('PRAGMA synchronous = NORMAL'); // Balance between safety and performance
db.run('PRAGMA cache_size = 10000'); // Increase cache size
db.run('PRAGMA temp_store = MEMORY'); // Store temporary tables in memory

// Initialize database with tables
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Categories table
      db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Products table
      db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        sku TEXT UNIQUE NOT NULL,
        category_id INTEGER,
        price DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2),
        stock_quantity INTEGER DEFAULT 0,
        min_stock_level INTEGER DEFAULT 10,
        image_url TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      )`);

      // Customers table
      db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        city TEXT,
        postal_code TEXT,
        country TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Orders table
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        order_number TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      )`);

      // Order items table
      db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )`);

      // Inventory transactions table
      db.run(`CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reference_id INTEGER,
        reference_type TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )`);

      // Suppliers table
      db.run(`CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Create default admin user
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT OR IGNORE INTO users (username, email, password, role) 
              VALUES ('admin', 'admin@store.com', ?, 'admin')`, [hashedPassword]);

      // Create default categories
      db.run(`INSERT OR IGNORE INTO categories (name, description) VALUES 
              ('Electronics', 'Electronic devices and accessories'),
              ('Clothing', 'Apparel and fashion items'),
              ('Books', 'Books and educational materials'),
              ('Home & Garden', 'Home improvement and garden supplies'),
              ('Sports', 'Sports equipment and accessories')`);

      console.log('Database initialized successfully');
      resolve();
    });
  });
};

// Wrapper function for database queries with timeout handling
const queryWithTimeout = (method, query, params = [], timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Database query timeout after ${timeout}ms: ${query}`));
    }, timeout);

    const callback = (err, result) => {
      clearTimeout(timer);
      if (err) {
        console.error('Database query error:', err.message);
        reject(err);
      } else {
        resolve(result);
      }
    };

    try {
      if (method === 'get') {
        db.get(query, params, callback);
      } else if (method === 'all') {
        db.all(query, params, callback);
      } else if (method === 'run') {
        db.run(query, params, function(err) {
          callback(err, { lastID: this.lastID, changes: this.changes });
        });
      }
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
};

// Enhanced database methods with timeout protection
const dbWithTimeout = {
  get: (query, params, timeout) => queryWithTimeout('get', query, params, timeout),
  all: (query, params, timeout) => queryWithTimeout('all', query, params, timeout),
  run: (query, params, timeout) => queryWithTimeout('run', query, params, timeout)
};

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

module.exports = { db, dbWithTimeout, initializeDatabase };