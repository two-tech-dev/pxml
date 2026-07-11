import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
export const dynamic = 'force-dynamic';

db.exec(`CREATE TABLE IF NOT EXISTS cart (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER UNIQUE,
  quantity INTEGER
)`);

export async function GET() {
  try {
    const items = db.all(`
      SELECT cart.id, cart.productId, cart.quantity,
             products.name, products.price, products.image
      FROM cart
      JOIN products ON cart.productId = products.id
    `);
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity } = body;
    if (!productId || typeof quantity !== 'number' || quantity < 1) {
      return NextResponse.json({ error: 'Invalid productId or quantity' }, { status: 400 });
    }
    db.run(
      `INSERT INTO cart (productId, quantity) VALUES (?, ?)
       ON CONFLICT(productId) DO UPDATE SET quantity = quantity + ?`,
      [productId, quantity, quantity]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity } = body;
    if (!productId || typeof quantity !== 'number') {
      return NextResponse.json({ error: 'Invalid productId or quantity' }, { status: 400 });
    }
    db.run('UPDATE cart SET quantity = ? WHERE productId = ?', [quantity, productId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let productId: number | undefined;
    try {
      const body = await request.json();
      productId = body.productId;
    } catch {
      // no body -> clear all
    }
    if (productId !== undefined) {
      db.run('DELETE FROM cart WHERE productId = ?', [productId]);
    } else {
      db.run('DELETE FROM cart');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item(s)' }, { status: 500 });
  }
}