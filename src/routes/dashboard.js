const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All dashboard routes require authentication; all roles (viewer, analyst, admin) can access
router.use(authenticate);

// GET /api/dashboard/summary — total income, expenses, net balance, record count
router.get('/summary', (req, res) => {
  const db = getDb();
  const summary = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END), 0) AS net_balance,
        COUNT(*) AS total_records
      FROM financial_records
      WHERE deleted_at IS NULL
    `)
    .get();

  res.json({ summary });
});

// GET /api/dashboard/categories — totals grouped by category and type
router.get('/categories', (req, res) => {
  const db = getDb();
  const categories = db
    .prepare(`
      SELECT
        category,
        type,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
      FROM financial_records
      WHERE deleted_at IS NULL
      GROUP BY category, type
      ORDER BY total DESC
    `)
    .all();

  res.json({ categories });
});

// GET /api/dashboard/trends — monthly income vs expenses for the last 12 months
router.get('/trends', (req, res) => {
  const db = getDb();
  const trends = db
    .prepare(`
      SELECT
        strftime('%Y-%m', date) AS month,
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END), 0) AS net
      FROM financial_records
      WHERE deleted_at IS NULL
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `)
    .all();

  res.json({ trends });
});

// GET /api/dashboard/recent — 10 most recently created records
router.get('/recent', (req, res) => {
  const db = getDb();
  const recent = db
    .prepare(`
      SELECT r.*, u.name AS created_by_name
      FROM financial_records r
      JOIN users u ON r.created_by = u.id
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 10
    `)
    .all();

  res.json({ recent });
});

module.exports = router;
