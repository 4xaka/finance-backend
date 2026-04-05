const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All user management is admin-only
router.use(authenticate, requireRole('admin'));

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['viewer', 'analyst', 'admin']).default('viewer'),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['viewer', 'analyst', 'admin']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// GET /api/users — list all users
router.get('/', (req, res) => {
  const db = getDb();
  const users = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.json({ users });
});

// POST /api/users — create a new user
router.post('/', validate(createUserSchema), (req, res) => {
  const { name, email, password, role } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, role);

  const user = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ user });
});

// PATCH /api/users/:id — update name, role, or status
router.patch('/:id', validate(updateUserSchema), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, role, status } = req.body;
  db.prepare(`
    UPDATE users
    SET name   = COALESCE(?, name),
        role   = COALESCE(?, role),
        status = COALESCE(?, status)
    WHERE id = ?
  `).run(name ?? null, role ?? null, status ?? null, req.params.id);

  const updated = db
    .prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?')
    .get(req.params.id);

  res.json({ user: updated });
});

// DELETE /api/users/:id — deactivate (soft delete)
router.delete('/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare("UPDATE users SET status = 'inactive' WHERE id = ?").run(req.params.id);
  res.json({ message: 'User deactivated successfully' });
});

module.exports = router;
