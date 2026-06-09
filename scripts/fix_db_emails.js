const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/shopx';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Shop = mongoose.model('Shop', new mongoose.Schema({}, { strict: false }));

    // Update User
    const userUpdate = await User.updateOne(
      { email: 'amjedhadi90@gmailcom' },
      { $set: { email: 'amjedhadi90@gmail.com' } }
    );
    console.log('User update result:', userUpdate);

    // Update Shop
    const shopUpdate = await Shop.updateOne(
      { email: 'amjedhadi90@gmailcom' },
      { $set: { email: 'amjedhadi90@gmail.com' } }
    );
    console.log('Shop update result:', shopUpdate);

    console.log('Database email fixes completed.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
