/**
 * Exercise Plugin Routes
 * API endpoints for exercise tracking
 */

const express = require('express');
const router = express.Router();
const data = require('./data');

/**
 * GET /sessions - List exercise sessions
 * Query params: from, to, category, limit
 */
router.get('/sessions', (req, res) => {
  const { from, to, category, limit } = req.query;
  const sessions = data.getSessions({
    from,
    to,
    category,
    limit: limit ? parseInt(limit) : undefined
  });
  res.json(sessions);
});

/**
 * POST /sessions - Log a new exercise session
 * Body: { category, exercises, duration, notes }
 */
router.post('/sessions', (req, res) => {
  const { category, exercises, duration, notes } = req.body;

  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }

  const session = data.logSession({
    category,
    exercises: exercises || [],
    duration: duration || 0,
    notes: notes || ''
  });

  res.json({ success: true, session });
});

/**
 * GET /stats - Get exercise statistics
 * Query params: days (default: 7)
 */
router.get('/stats', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const stats = data.getStats(days);
  res.json(stats);
});

/**
 * GET /streaks - Get current streak info
 */
router.get('/streaks', (req, res) => {
  const allData = data.getData();
  res.json(allData.streaks);
});

module.exports = router;
