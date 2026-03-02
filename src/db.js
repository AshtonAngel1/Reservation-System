const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'reserve_sys_user',
  password: 'SoftwareEngineering3339!',
  database: 'reservation_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Connect and check
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database');
    connection.release();
  } catch (err) {
    console.error('Database connection failed:', err);
  }
})();

module.exports = pool;

