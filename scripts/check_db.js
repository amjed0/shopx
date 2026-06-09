const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/shopx';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Shop = mongoose.model('Shop', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({}).lean();
    console.log('--- Users collection ---');
    console.log(users);

    const shops = await Shop.find({}).lean();
    console.log('--- Shops collection ---');
    console.log(shops);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
