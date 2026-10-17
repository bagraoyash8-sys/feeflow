const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let poolConfig;

if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  poolConfig = {
    uri: dbUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: (process.env.DB_SSL === 'false') ? undefined : { rejectUnauthorized: false }
  };
} else {
  const isCloudHost = process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST);
  const isSsl = process.env.DB_SSL === 'true' || isCloudHost;
  
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'feeflow',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined
  };
}

const pool = mysql.createPool(poolConfig);

// Test connectivity on startup (non-fatal warning if offline/pending cloud setup)
pool.getConnection()
  .then(conn => {
    console.log(`✅ Database connected successfully [Host: ${poolConfig.host || 'Cloud URI'}]`);
    conn.release();
  })
  .catch(err => {
    console.warn('⚠️  Database connection warning:', err.message);
    console.warn('💡 If deployed on Render or Cloud, ensure DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (or DATABASE_URL) are configured in your Environment Variables.');
  });

module.exports = pool;
