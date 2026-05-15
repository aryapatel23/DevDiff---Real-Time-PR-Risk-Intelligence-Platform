const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate({ closePool = false } = {}) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    console.log('[DevDiff] PostgreSQL migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DevDiff] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    if (closePool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  migrate({ closePool: true });
}

module.exports = { migrate };
