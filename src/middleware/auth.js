const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, name, email, role, status FROM users WHERE id = ?')
    .get(payload.sub);

  if (!user || user.status === 'inactive') {
    return res.status(401).json({ error: 'Account not found or inactive' });
  }

  req.user = user;
  next();
}

module.exports = { authenticate, JWT_SECRET };
