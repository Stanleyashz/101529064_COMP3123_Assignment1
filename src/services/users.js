const bcrypt = require('bcryptjs');
const User = require('../models/User');

const SALT_ROUNDS = 12;
// Compared against when no account matches so a missing user and a wrong
// password take roughly the same time to answer.
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', SALT_ROUNDS);

async function createUser({ username, email, password }) {
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  return User.create({ username, email, password: hashed });
}

async function verifyCredentials({ username, email, password }) {
  const filter = username ? { username } : { email };
  const user = await User.findOne(filter).select('+password');
  const matches = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  return matches && user ? user : null;
}

function toPublicUser(user) {
  return { id: user.id, username: user.username, email: user.email, created_at: user.created_at };
}

module.exports = { createUser, verifyCredentials, toPublicUser };
