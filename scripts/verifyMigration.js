/**
 * Automated verification script for the MongoDB Auth & database migration.
 * Uses native Node.js fetch (Node 18+).
 */

const mongoose = require('mongoose');

const API_BASE = 'http://localhost:9002';
const MONGODB_URI = 'mongodb://127.0.0.1:27017/shopx';

async function run() {
  try {
    console.log('🔧 Starting migration verification script...');

    // 1. Log in (triggers automatic migration of the existing shop owner)
    console.log('🔑 Attempting to log in as existing shop owner hadipullan2003@gmail.com...');
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hadipullan2003@gmail.com',
        password: 'password123'
      })
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Login failed with status ${loginRes.status}: ${errText}`);
    }

    const loginData = await loginRes.json();
    console.log('✅ Logged in successfully. User data:', loginData.user);

    const userId = loginData.user.uid;
    const cookieHeader = loginRes.headers.get('set-cookie');

    // 2. Add a test product using the userId header and session cookie
    console.log('📦 Creating a new product...');
    const productPayload = {
      name: 'Verification Product ' + Date.now(),
      sku: 'VP-' + Math.floor(Math.random() * 1000),
      purchasePrice: 10.00,
      sellingPrice: 15.00,
      stock: 30,
      minStock: 5,
      category: 'Test'
    };

    const productRes = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'Cookie': cookieHeader || ''
      },
      body: JSON.stringify(productPayload)
    });

    if (!productRes.ok) {
      const errText = await productRes.text();
      throw new Error(`Failed to create product: ${errText}`);
    }

    const productData = await productRes.json();
    console.log('✅ Product created successfully:', productData);

    // 3. Connect to MongoDB directly and verify that the user record was created,
    // and that the new product is correctly stored under the correct userId.
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({ _id: String }, { strict: false }));
    const Product = mongoose.model('Product', new mongoose.Schema({ _id: String }, { strict: false }));
    const Shop = mongoose.model('Shop', new mongoose.Schema({ _id: String }, { strict: false }));

    const userDoc = await User.findById(userId).lean();
    if (!userDoc) {
      throw new Error(`User document for UID ${userId} not found in MongoDB`);
    }
    console.log('✅ MongoDB verification: User document found:', userDoc);

    const productDoc = await Product.findOne({ userId, sku: productPayload.sku }).lean();
    if (!productDoc) {
      throw new Error(`Product document with SKU ${productPayload.sku} not found under userId ${userId} in MongoDB`);
    }
    console.log('✅ MongoDB verification: Product document found:', productDoc);

    const shopDoc = await Shop.findOne({ userId }).lean();
    if (!shopDoc) {
      throw new Error(`Shop document not found for userId ${userId} in MongoDB`);
    }
    console.log('✅ MongoDB verification: Shop document found:', shopDoc);

    console.log('\n🎉 ALL VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('🎉 MongoDB-backed auth and session flow is 100% operational!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

run();
