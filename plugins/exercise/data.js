/**
 * Exercise Plugin Data Manager
 * Handles persistence for exercise sessions
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const dataFile = path.join(dataDir, 'exercise.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing data
let data = {
  sessions: [],
  streaks: { current: 0, longest: 0, lastDate: null }
};

try {
  if (fs.existsSync(dataFile)) {
    data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  }
} catch (e) {
  console.log('[Exercise] Starting with empty data');
}

function save() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

/**
 * Log an exercise session
 */
function logSession(session) {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    category: session.category,
    exercises: session.exercises || [],
    duration: session.duration || 0,
    notes: session.notes || ''
  };

  data.sessions.push(entry);
  updateStreaks(entry.timestamp);
  save();

  return entry;
}

/**
 * Update streak tracking
 */
function updateStreaks(timestamp) {
  const today = timestamp.split('T')[0];
  const lastDate = data.streaks.lastDate;

  if (!lastDate) {
    // First session ever
    data.streaks.current = 1;
    data.streaks.longest = 1;
  } else if (lastDate === today) {
    // Already logged today, no change
  } else {
    const last = new Date(lastDate);
    const now = new Date(today);
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      data.streaks.current++;
      if (data.streaks.current > data.streaks.longest) {
        data.streaks.longest = data.streaks.current;
      }
    } else if (diffDays > 1) {
      // Streak broken
      data.streaks.current = 1;
    }
  }

  data.streaks.lastDate = today;
}

/**
 * Get all sessions
 */
function getSessions(options = {}) {
  let sessions = [...data.sessions];

  if (options.from) {
    sessions = sessions.filter(s => s.timestamp >= options.from);
  }
  if (options.to) {
    sessions = sessions.filter(s => s.timestamp <= options.to);
  }
  if (options.category) {
    sessions = sessions.filter(s => s.category === options.category);
  }

  // Sort by timestamp descending (most recent first)
  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (options.limit) {
    sessions = sessions.slice(0, options.limit);
  }

  return sessions;
}

/**
 * Get statistics for a date range
 */
function getStats(days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const recentSessions = data.sessions.filter(s => s.timestamp >= cutoffStr);

  // Count sessions by category
  const byCategory = {};
  recentSessions.forEach(s => {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
  });

  // Total duration
  const totalDuration = recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  // Days with exercise
  const uniqueDays = [...new Set(recentSessions.map(s => s.timestamp.split('T')[0]))];

  return {
    period: { days, sessionsCount: recentSessions.length },
    byCategory,
    totalDuration,
    daysActive: uniqueDays.length,
    streaks: data.streaks
  };
}

/**
 * Get digest contribution for daily/weekly digests
 */
function getDigestContribution(startDate, endDate) {
  const sessions = data.sessions.filter(s => {
    const date = s.timestamp.split('T')[0];
    return date >= startDate && date <= endDate;
  });

  if (sessions.length === 0) {
    return null;
  }

  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const categories = [...new Set(sessions.map(s => s.category))];

  return {
    plugin: 'exercise',
    title: 'Exercise Activity',
    summary: `${sessions.length} exercise session${sessions.length !== 1 ? 's' : ''} (${Math.round(totalDuration / 60)} minutes)`,
    details: {
      sessions: sessions.length,
      totalMinutes: Math.round(totalDuration / 60),
      categories,
      streak: data.streaks.current
    }
  };
}

module.exports = {
  logSession,
  getSessions,
  getStats,
  getDigestContribution,
  getData: () => data
};
