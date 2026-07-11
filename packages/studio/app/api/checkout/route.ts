import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      totalAmount REAL,
      itemsCount INTEGER,
      date TEXT,
      fullName TEXT,
      address TEXT
    )
  `);

  const cartItems = db.all('SELECT price, quantity FROM cart') as { price: number; quantity: number }[];
  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const date = new Date().toISOString();

  const body = await request.json();
  const { fullName, address } = body;

  const result = db.run(
    'INSERT INTO orders (totalAmount, itemsCount, date, fullName, address) VALUES (?, ?, ?, ?, ?)',
    totalAmount,
    itemsCount,
    date,
    fullName,
    address
  );

  db.run('DELETE FROM cart');

  return NextResponse.json({ orderId: (result as any).lastInsertRowid });
}

export async function GET() {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      totalAmount REAL,
      itemsCount INTEGER,
      date TEXT,
      fullName TEXT,
      address TEXT
    )
  `);

  const orders = db.all('SELECT * FROM orders ORDER BY date DESC');
  return NextResponse.json(orders);
}