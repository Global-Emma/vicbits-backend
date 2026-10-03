require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const run = async () => {
  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
  if (!email) throw new Error('Set ADMIN_BOOTSTRAP_EMAIL to an existing registered account.');
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL is required.');

  await mongoose.connect(process.env.MONGODB_URL);
  const user = await User.findOne({ email });
  if (!user) throw new Error(`No account found for ${email}. Register the account first.`);
  user.role = 'admin';
  await user.save();
  console.log(`Administrator access granted to ${email}.`);
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
