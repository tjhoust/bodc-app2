const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

/**
 * Execute a query with org-level row security context set.
 * Always use this instead of pool.query() in route handlers.
 */
async function query(text, params, orgId = null, isSuperAdmin = false) {
  const client = await pool.connect();
  try {
    if (orgId) {
      await client.query(`SET app.current_org_id = '${orgId}'`);
    }
    await client.query(`SET app.is_super_admin = '${isSuperAdmin}'`);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * Run multiple queries in a transaction.
 */
async function transaction(fn, orgId = null, isSuperAdmin = false) {
  const client = await pool.connect();
  try {
    if (orgId) {
      await client.query(`SET app.current_org_id = '${orgId}'`);
    }
    await client.query(`SET app.is_super_admin = '${isSuperAdmin}'`);
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
