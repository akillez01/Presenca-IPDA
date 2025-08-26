import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: 'localhost',
  user: 'adminipda',
  password: 'IPDA@2025Admin',
  database: 'admin_ipda',
  port: 3306,
});
