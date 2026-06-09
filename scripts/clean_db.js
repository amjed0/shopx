const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/shopx';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const result = await User.deleteMany({});
    console.log('Deleted users:', result);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
