const express = require('express');
const { z } = require('zod');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roles');
const { validate, validateQuery } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

const recordSchema = z.object({
  amount: z.number().positive({ message: 'Amount must be a positive number' }),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().max(500).optional(),
});

const updateRecordSchema = recordSchema.partial();

const querySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/records — analyst and admin can list records (with filters + pagination)
router.get('/', requireMinRole('analyst'), validateQuery(querySchema), (req, res) => {
  const db = getDb();
  const { type, category, from, to, page, limit } = req.query;
  const offset = (page - 1) * limit;

  const conditions = ['r.deleted_at IS NULL'];
  const params = [];

  if (type)     { conditions.push('r.type = ?');     params.push(type); }
  if (category) { conditions.push('r.category = ?'); params.push(category); }
  if (from)     { conditions.push('r.date >= ?');    params.push(from); }
  if (to)       { conditions.push('r.date <= ?');    params.push(to); }

  const where = 'WHERE ' + conditions.join(' AND ');

  const { count: total } = db
    .prepare(`SELECT COUNT(*) as count FROM financial_records r ${where}`)
    .get(...params);

  const records = db
    .prepare(`
      SELECT r.*, u.name AS created_by_name
      FROM financial_records r
      JOIN users u ON r.created_by = u.id
      ${where}
      ORDER BY r.date DESC, r.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  res.json({
    records,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// POST /api/records — admin only
router.post('/', requireRole('admin'), validate(recordSchema), (req, res) => {
  const db = getDb();
  const { amount, type, category, date, notes } = req.body;

  const result = db
    .prepare(`
      INSERT INTO financial_records (amount, type, category, date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(amount, type, category, date, notes ?? null, req.user.id);

  const record = db
    .prepare('SELECT * FROM financial_records WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ record });
});

// PATCH /api/records/:id — admin only
router.patch('/:id', requireRole('admin'), validate(updateRecordSchema), (req, res) => {
  const db = getDb();
  const record = db
    .prepare('SELECT * FROM financial_records WHERE id = ? AND deleted_at IS NULL')
    .get(req.params.id);

  if (!record) return res.status(404).json({ error: 'Record not found' });

  const { amount, type, category, date, notes } = req.body;
  db.prepare(`
    UPDATE financial_records
    SET amount   = COALESCE(?, amount),
        type     = COALESCE(?, type),
        category = COALESCE(?, category),
        date     = COALESCE(?, date),
        notes    = COALESCE(?, notes),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(amount ?? null, type ?? null, category ?? null, date ?? null, notes ?? null, req.params.id);

  const updated = db
    .prepare('SELECT * FROM financial_records WHERE id = ?')
    .get(req.params.id);

  res.json({ record: updated });
});

// DELETE /api/records/:id — soft delete, admin only
router.delete('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const record = db
    .prepare('SELECT * FROM financial_records WHERE id = ? AND deleted_at IS NULL')
    .get(req.params.id);

  if (!record) return res.status(404).json({ error: 'Record not found' });

  db.prepare("UPDATE financial_records SET deleted_at = datetime('now') WHERE id = ?").run(
    req.params.id
  );

  res.json({ message: 'Record deleted successfully' });
});

module.exports = router;
