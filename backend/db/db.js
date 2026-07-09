const { Pool } = require('pg');
require('dotenv').config();

function getDbHost(connectionString) {
  if (!connectionString) return 'unknown-host';
  try {
    return new URL(connectionString).hostname;
  } catch {
    return 'unknown-host';
  }
}

function mapDbError(err) {
  const message = String(err?.message || 'Database error');
  if (err?.code === 'ENOTFOUND' || message.includes('getaddrinfo ENOTFOUND')) {
    const host = getDbHost(process.env.DATABASE_URL);
    const mapped = new Error(
      `Database host not found: ${host}. Use the Supabase Transaction Pooler connection string (IPv4) from Supabase Dashboard > Connect, then restart backend.`
    );
    mapped.code = 'DB_HOST_NOT_FOUND';
    return mapped;
  }
  return err;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 60000,
  statement_timeout: 30000,
});

pool.on('error', err => {
  const mapped = mapDbError(err);
  console.error('DB pool error:', mapped.message);
});

const baseQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  try {
    return await baseQuery(...args);
  } catch (err) {
    throw mapDbError(err);
  }
};

module.exports = pool;
