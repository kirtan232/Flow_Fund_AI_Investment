/**
 * Single source of truth for DB connection.
 * Railway: MYSQL_PUBLIC_URL or DATABASE_URL. Local: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
 */
require('dotenv').config();

const connectionUrl =
  process.env.MYSQL_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL;

function getPoolConfig() {
  const tz = { timezone: '+00:00' };
  if (connectionUrl) {
    const url = new URL(connectionUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.replace('/', ''),
      ...tz,
    };
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...tz,
  };
}

module.exports = { getPoolConfig, connectionUrl };
