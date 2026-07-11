import db from '@/lib/db';

export const dynamic = 'force-dynamic';

const seedData = [
  { name: 'Ergonomic Chair', price: 299.99, description: 'Comfortable office chair with lumbar support', image: '/images/chair.jpg', category: 'Furniture', rating: 4.7, reviewsCount: 128 },
  { name: 'Wireless Mouse', price: 49.99, description: 'Bluetooth mouse with long battery life', image: '/images/mouse.jpg', category: 'Electronics', rating: 4.5, reviewsCount: 89 },
  { name: 'Mechanical Keyboard', price: 129.99, description: 'RGB mechanical keyboard with Cherry MX switches', image: '/images/keyboard.jpg', category: 'Electronics', rating: 4.8, reviewsCount: 215 },
  { name: 'Laptop Stand', price: 39.99, description: 'Adjustable aluminum laptop stand', image: '/images/stand.jpg', category: 'Accessories', rating: 4.3, reviewsCount: 56 },
  { name: 'USB-C Hub', price: 34.99, description: '7-in-1 USB-C hub with HDMI', image: '/images/hub.jpg', category: 'Electronics', rating: 4.2, reviewsCount: 143 },
  { name: 'Desk Lamp', price: 59.99, description: 'LED desk lamp with adjustable brightness', image: '/images/lamp.jpg', category: 'Furniture', rating: 4.6, reviewsCount: 72 },
  { name: 'Noise Cancelling Headphones', price: 249.99, description: 'Over-ear headphones with ANC', image: '/images/headphones.jpg', category: 'Electronics', rating: 4.9, reviewsCount: 310 },
  { name: 'Monitor Arm', price: 89.99, description: 'Heavy-duty monitor arm for dual setup', image: '/images/monitor-arm.jpg', category: 'Accessories', rating: 4.4, reviewsCount: 41 },
  { name: 'Webcam', price: 79.99, description: '1080p webcam with autofocus', image: '/images/webcam.jpg', category: 'Electronics', rating: 4.1, reviewsCount: 97 },
  { name: 'Cable Management Kit', price: 19.99, description: 'Adhesive cable clips and sleeves', image: '/images/cable-kit.jpg', category: 'Accessories', rating: 4.0, reviewsCount: 203 },
  { name: 'Standing Desk', price: 499.99, description: 'Electric standing desk with memory presets', image: '/images/standing-desk.jpg', category: 'Furniture', rating: 4.8, reviewsCount: 68 },
];

async function initDb() {
  const exists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
  if (!exists) {
    await db.exec(`CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      price REAL,
      description TEXT,
      image TEXT,
      category TEXT,
      rating REAL,
      reviewsCount INTEGER
    )`);
  }
  const count = await db.get('SELECT COUNT(*) as count FROM products');
  if (count.count === 0) {
    for (const item of seedData) {
      await db.run(
        'INSERT INTO products (name, price, description, image, category, rating, reviewsCount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        item.name, item.price, item.description, item.image, item.category, item.rating, item.reviewsCount
      );
    }
  }
}

export async function GET() {
  await initDb();
  const products = await db.all('SELECT * FROM products ORDER BY id ASC');
  return Response.json(products);
}

export async function POST(request) {
  await initDb();
  const { name, price, description, image, category, rating, reviewsCount } = await request.json();
  const result = await db.run(
    'INSERT INTO products (name, price, description, image, category, rating, reviewsCount) VALUES (?, ?, ?, ?, ?, ?, ?)',
    name, price, description, image, category, rating, reviewsCount
  );
  const created = await db.get('SELECT * FROM products WHERE id = ?', result.lastInsertRowid);
  return Response.json(created, { status: 201 });
}