/**
 * Wearable Plugin Data Manager
 * Handles persistence for wearable activity data
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const dataFile = path.join(dataDir, 'wearable.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing data
let data = {
  sources: [],
  activities: [],
  goals: { steps: 10000, activeMinutes: 30, calories: 2000 }
};

try {
  if (fs.existsSync(dataFile)) {
    data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  }
} catch (e) {
  console.log('[Wearable] Starting with empty data');
}

function save() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

/**
 * Add or update a wearable source
 */
function addSource(source) {
  const existing = data.sources.find(s => s.id === source.id);
  if (existing) {
    Object.assign(existing, source);
  } else {
    data.sources.push({
      id: source.id || `source-${Date.now()}`,
      type: source.type || 'unknown',
      name: source.name || 'Unknown Device',
      addedAt: new Date().toISOString(),
      lastImportAt: null
    });
  }
  save();
  return data.sources.find(s => s.id === source.id);
}

/**
 * Update source last import time
 */
function updateSourceImportTime(sourceId) {
  const source = data.sources.find(s => s.id === sourceId);
  if (source) {
    source.lastImportAt = new Date().toISOString();
    save();
  }
}

/**
 * Add activity records (merge by date + source)
 */
function addActivities(activities, sourceId) {
  let added = 0;
  let updated = 0;

  for (const activity of activities) {
    activity.sourceId = sourceId;
    activity.importedAt = new Date().toISOString();

    // Check for duplicate (same date + source)
    const existingIdx = data.activities.findIndex(
      a => a.date === activity.date && a.sourceId === sourceId
    );

    if (existingIdx >= 0) {
      // Update existing
      data.activities[existingIdx] = { ...data.activities[existingIdx], ...activity };
      updated++;
    } else {
      activity.id = Date.now() + Math.random();
      data.activities.push(activity);
      added++;
    }
  }

  // Sort by date descending
  data.activities.sort((a, b) => b.date.localeCompare(a.date));
  save();

  updateSourceImportTime(sourceId);

  return { added, updated };
}

/**
 * Get activity for a specific date
 */
function getActivityForDate(date) {
  return data.activities.find(a => a.date === date);
}

/**
 * Get activities with optional filtering
 */
function getActivities(options = {}) {
  let activities = [...data.activities];

  if (options.from) {
    activities = activities.filter(a => a.date >= options.from);
  }
  if (options.to) {
    activities = activities.filter(a => a.date <= options.to);
  }
  if (options.sourceId) {
    activities = activities.filter(a => a.sourceId === options.sourceId);
  }
  if (options.limit) {
    activities = activities.slice(0, options.limit);
  }

  return activities;
}

/**
 * Calculate activity snapshot at a specific time
 * Interpolates stats based on time of day
 */
function calculateSnapshotAtTime(dayActivity, entryTime) {
  const dayStart = new Date(dayActivity.date + 'T00:00:00');
  const dayEnd = new Date(dayActivity.date + 'T23:59:59');
  const elapsed = Math.min(1, Math.max(0, (entryTime - dayStart) / (dayEnd - dayStart)));

  const stepsAtTime = Math.round((dayActivity.steps || 0) * elapsed);
  const caloriesAtTime = Math.round((dayActivity.calories || 0) * elapsed);

  // Find most recent exercise before entry time
  const pastExercises = (dayActivity.exercises || [])
    .filter(e => new Date(e.startTime) < entryTime)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const lastExercise = pastExercises[0] ? {
    type: pastExercises[0].type,
    minutesAgo: Math.round((entryTime - new Date(pastExercises[0].startTime)) / 60000)
  } : null;

  return {
    stepsAtTime,
    stepsToday: dayActivity.steps || 0,
    caloriesAtTime,
    caloriesTotal: dayActivity.calories || 0,
    activeMinutesToday: dayActivity.activeMinutes || 0,
    distanceToday: dayActivity.distance || 0,
    lastExercise,
    heartRateCurrent: dayActivity.heartRateAvg || null,
    dayProgress: {
      steps: (dayActivity.steps || 0) / (data.goals.steps || 10000),
      activeMinutes: (dayActivity.activeMinutes || 0) / (data.goals.activeMinutes || 30),
      calories: (dayActivity.calories || 0) / (data.goals.calories || 2000)
    }
  };
}

/**
 * Get digest contribution for daily/weekly digests
 */
function getDigestContribution(startDate, endDate) {
  const rangeActivities = data.activities.filter(
    a => a.date >= startDate && a.date <= endDate
  );

  if (rangeActivities.length === 0) {
    return null;
  }

  const totalSteps = rangeActivities.reduce((sum, a) => sum + (a.steps || 0), 0);
  const totalActiveMinutes = rangeActivities.reduce((sum, a) => sum + (a.activeMinutes || 0), 0);
  const totalCalories = rangeActivities.reduce((sum, a) => sum + (a.calories || 0), 0);
  const avgSteps = Math.round(totalSteps / rangeActivities.length);
  const goalDays = rangeActivities.filter(a => (a.steps || 0) >= data.goals.steps).length;

  return {
    plugin: 'wearable',
    title: 'Activity Summary',
    summary: `${rangeActivities.length} days tracked. ${avgSteps.toLocaleString()} avg steps/day. ${goalDays} days met step goal.`,
    details: {
      daysTracked: rangeActivities.length,
      totalSteps,
      avgStepsPerDay: avgSteps,
      totalActiveMinutes,
      totalCalories,
      goalDaysReached: goalDays
    }
  };
}

/**
 * Get weekly stats summary
 */
function getWeeklyStats() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const todayStr = today.toISOString().split('T')[0];
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const weekActivities = data.activities.filter(
    a => a.date >= weekAgoStr && a.date <= todayStr
  );

  // Daily breakdown for chart
  const dailyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const activity = weekActivities.find(a => a.date === dateStr);
    dailyData.push({
      date: dateStr,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      steps: activity?.steps || 0,
      calories: activity?.calories || 0,
      activeMinutes: activity?.activeMinutes || 0
    });
  }

  return {
    dailyData,
    totals: {
      steps: weekActivities.reduce((sum, a) => sum + (a.steps || 0), 0),
      calories: weekActivities.reduce((sum, a) => sum + (a.calories || 0), 0),
      activeMinutes: weekActivities.reduce((sum, a) => sum + (a.activeMinutes || 0), 0)
    },
    averages: {
      steps: Math.round(weekActivities.reduce((sum, a) => sum + (a.steps || 0), 0) / 7),
      calories: Math.round(weekActivities.reduce((sum, a) => sum + (a.calories || 0), 0) / 7),
      activeMinutes: Math.round(weekActivities.reduce((sum, a) => sum + (a.activeMinutes || 0), 0) / 7)
    }
  };
}

module.exports = {
  addSource,
  updateSourceImportTime,
  addActivities,
  getActivityForDate,
  getActivities,
  calculateSnapshotAtTime,
  getDigestContribution,
  getWeeklyStats,
  getSources: () => data.sources,
  getGoals: () => data.goals,
  setGoals: (goals) => { data.goals = { ...data.goals, ...goals }; save(); },
  getData: () => data
};
