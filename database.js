// database.js

const { Pool } = require('pg');

// Debug: Log the connection string to verify it's loaded
console.log("DATABASE_URL =", process.env.DATABASE_URL);

// Create a new Pool using the connection string from DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // The following SSL option is generally used, but because we're also setting
  // NODE_TLS_REJECT_UNAUTHORIZED=0 in .env, it should allow the connection.
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,                // Optional: maximum number of connections
  idleTimeoutMillis: 30000 // Optional: idle timeout
});

/**
 * Initialize the required tables if they do not exist.
 */
async function initDB() {
  try {
    // Create the admin table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create the projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        whatsapp_phone_number_id VARCHAR(50) UNIQUE NOT NULL,
        whatsapp_token TEXT NOT NULL,
        system_prompt TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create the messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        from_number VARCHAR(50) NOT NULL,
        to_number VARCHAR(50) NOT NULL,
        message_body TEXT NOT NULL,
        direction VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        metadata JSONB DEFAULT '{}'
      );
    `);

    console.log('Database initialization complete. Tables are ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

module.exports = {
  pool,
  initDB
};
