const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '127.0.0.1',
  user: 'Ashton',
  password: 'AshtonMares1!',
  database: 'reservation_system'
});

// Connect and check
connection.connect(err => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

module.exports = connection;

