import mysql from 'mysql2/promise';

const host = process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost';
const user = process.env.MYSQL_USER || process.env.DB_USER || '';
const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || '';
const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);

if (!user || !password || !database) {
  // Aviso para ambiente sem configuração de MySQL.
  // Evita credenciais hardcoded e força uso de variáveis de ambiente.
  // eslint-disable-next-line no-console
  console.warn('MySQL não configurado: defina MYSQL_USER, MYSQL_PASSWORD e MYSQL_DATABASE.');
}

export const db = mysql.createPool({
  host,
  user,
  password,
  database,
  port,
});
