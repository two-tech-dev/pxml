import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.resolve(process.cwd(), 'shop.db'), {
  busyTimeout: 5000,
});

export default db;