import { NextRequest, NextResponse } from 'next/server';
import { run, get } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const SALT = 'fixed-salt';

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', SALT).update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    await run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const { action, email, password } = await request.json();

    if (!action || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (action === 'register') {
      const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) {
        return NextResponse.json({ error: 'User already exists' }, { status: 409 });
      }
      await run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashPassword(password)]);
      return NextResponse.json({ success: true }, { status: 201 });
    }

    if (action === 'login') {
      const user = await get('SELECT id, email, password FROM users WHERE email = ?', [email]);
      if (!user || hashPassword(password) !== user.password) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      const response = NextResponse.json({ success: true });
      response.cookies.set('user_session', email, { httpOnly: true, path: '/', sameSite: 'lax' });
      return response;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}