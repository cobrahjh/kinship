/**
 * Wearable Plugin API Routes
 * Handles import, query, and management of wearable data
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const data = require('./data');
const { parseSamsungExport, parseGenericExport } = require('./parsers/samsung');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/**
 * POST /import
 * Import wearable data from exported JSON file
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    let exportData;
    let sourceType = req.body.source || 'samsung-health';

    // Parse uploaded file or JSON body
    if (req.file) {
      const content = req.file.buffer.toString('utf8');
      exportData = JSON.parse(content);
    } else if (req.body.data) {
      exportData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    // Get or create source
    const sourceId = req.body.sourceId || `${sourceType}-${Date.now()}`;
    const sourceName = req.body.sourceName || 'Samsung Galaxy Watch';

    data.addSource({
      id: sourceId,
      type: sourceType,
      name: sourceName
    });

    // Parse based on source type
    let activities;
    if (sourceType === 'samsung-health' || sourceType === 'samsung') {
      activities = parseSamsungExport(exportData);
    } else {
      activities = parseGenericExport(exportData);
    }

    if (activities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No activity data found in import'
      });
    }

    // Store activities
    const result = data.addActivities(activities, sourceId);

    // Calculate date range
    const dates = activities.map(a => a.date).sort();
    const dateRange = {
      from: dates[0],
      to: dates[dates.length - 1]
    };

    res.json({
      success: true,
      imported: {
        days: activities.length,
        added: result.added,
        updated: result.updated
      },
      dateRange
    });

  } catch (err) {
    console.error('[Wearable] Import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /activity
 * Receive real-time activity data (for companion app)
 */
router.post('/activity', async (req, res) => {
  try {
    const { sourceId, date, steps, calories, distance, activeMinutes, heartRate } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }

    const activity = {
      date,
      timestamp: date + 'T23:59:59.000Z',
      steps: steps || 0,
      calories: calories || 0,
      distance: distance || 0,
      distanceUnit: 'km',
      activeMinutes: activeMinutes || 0,
      exercises: req.body.exercises || []
    };

    if (heartRate) {
      activity.heartRateAvg = heartRate.avg || heartRate.current;
      activity.heartRateMin = heartRate.min;
      activity.heartRateMax = heartRate.max;
    }

    const result = data.addActivities([activity], sourceId || 'companion-app');

    res.json({
      success: true,
      activity,
      result
    });

  } catch (err) {
    console.error('[Wearable] Activity post error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /activities
 * List activity records with optional filtering
 */
router.get('/activities', (req, res) => {
  const options = {
    from: req.query.from,
    to: req.query.to,
    sourceId: req.query.sourceId,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined
  };

  const activities = data.getActivities(options);
  res.json(activities);
});

/**
 * GET /activities/:date
 * Get activity for a specific date
 */
router.get('/activities/:date', (req, res) => {
  const activity = data.getActivityForDate(req.params.date);

  if (!activity) {
    return res.status(404).json({
      success: false,
      error: 'No activity found for this date'
    });
  }

  res.json(activity);
});

/**
 * GET /today
 * Get today's activity
 */
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const activity = data.getActivityForDate(today);
  const goals = data.getGoals();

  res.json({
    date: today,
    activity: activity || {
      date: today,
      steps: 0,
      calories: 0,
      distance: 0,
      activeMinutes: 0
    },
    goals,
    progress: activity ? {
      steps: (activity.steps || 0) / goals.steps,
      calories: (activity.calories || 0) / goals.calories,
      activeMinutes: (activity.activeMinutes || 0) / goals.activeMinutes
    } : { steps: 0, calories: 0, activeMinutes: 0 }
  });
});

/**
 * GET /stats
 * Get summary statistics
 */
router.get('/stats', (req, res) => {
  const weeklyStats = data.getWeeklyStats();
  const sources = data.getSources();
  const goals = data.getGoals();
  const allActivities = data.getActivities({ limit: 1 });

  res.json({
    connected: sources.length > 0,
    sources,
    lastImport: sources.length > 0 ? sources.reduce((latest, s) =>
      s.lastImportAt > (latest || '') ? s.lastImportAt : latest, null
    ) : null,
    totalDays: data.getActivities().length,
    weekly: weeklyStats,
    goals
  });
});

/**
 * GET /sources
 * List connected wearable sources
 */
router.get('/sources', (req, res) => {
  res.json(data.getSources());
});

/**
 * POST /sources
 * Add a new wearable source
 */
router.post('/sources', (req, res) => {
  const source = data.addSource({
    id: req.body.id,
    type: req.body.type,
    name: req.body.name
  });
  res.json({ success: true, source });
});

/**
 * DELETE /sources/:id
 * Remove a wearable source
 */
router.delete('/sources/:id', (req, res) => {
  // Note: This doesn't delete historical data, just the source reference
  const sources = data.getSources();
  const idx = sources.findIndex(s => s.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Source not found' });
  }

  sources.splice(idx, 1);
  res.json({ success: true });
});

/**
 * GET /goals
 * Get activity goals
 */
router.get('/goals', (req, res) => {
  res.json(data.getGoals());
});

/**
 * PUT /goals
 * Update activity goals
 */
router.put('/goals', (req, res) => {
  const goals = {};

  if (req.body.steps !== undefined) goals.steps = parseInt(req.body.steps);
  if (req.body.activeMinutes !== undefined) goals.activeMinutes = parseInt(req.body.activeMinutes);
  if (req.body.calories !== undefined) goals.calories = parseInt(req.body.calories);

  data.setGoals(goals);
  res.json({ success: true, goals: data.getGoals() });
});

module.exports = router;
