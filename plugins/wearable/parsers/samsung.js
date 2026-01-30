/**
 * Samsung Health JSON Export Parser
 * Parses exported data from Samsung Health app
 *
 * Export format: ZIP file with JSON files in /jsons/ folder
 * Key files:
 * - com.samsung.shealth.step_daily_trend.json
 * - com.samsung.shealth.calories_burned.details.json
 * - com.samsung.shealth.exercise.json
 * - com.samsung.shealth.heart_rate.json
 */

/**
 * Parse Samsung Health export data
 * @param {object} exportData - Parsed JSON from Samsung Health export
 * @returns {Array} Array of activity records
 */
function parseSamsungExport(exportData) {
  const activitiesMap = new Map();

  // Helper to get or create activity for a date
  const getActivity = (date) => {
    if (!activitiesMap.has(date)) {
      activitiesMap.set(date, {
        date,
        timestamp: date + 'T23:59:59.000Z',
        steps: 0,
        calories: 0,
        distance: 0,
        distanceUnit: 'km',
        activeMinutes: 0,
        exercises: [],
        heartRates: []
      });
    }
    return activitiesMap.get(date);
  };

  // Parse daily step data
  const stepData = exportData['com.samsung.shealth.step_daily_trend'] ||
                   exportData['step_daily_trend'] ||
                   exportData.steps ||
                   [];

  for (const record of stepData) {
    const date = extractDate(record.day_time || record.create_time || record.date);
    if (!date) continue;

    const activity = getActivity(date);
    activity.steps = Math.max(activity.steps, record.count || record.steps || 0);
    activity.distance = Math.max(activity.distance, ((record.distance || 0) / 1000)); // meters to km
    activity.calories += record.calorie || 0;
  }

  // Parse calorie data
  const calorieData = exportData['com.samsung.shealth.calories_burned.details'] ||
                      exportData['calories_burned'] ||
                      exportData.calories ||
                      [];

  for (const record of calorieData) {
    const date = extractDate(record.day_time || record.create_time || record.date);
    if (!date) continue;

    const activity = getActivity(date);
    if (record.total_calorie) {
      activity.calories = record.total_calorie;
    }
  }

  // Parse exercise sessions
  const exerciseData = exportData['com.samsung.shealth.exercise'] ||
                       exportData.exercise ||
                       exportData.workouts ||
                       [];

  for (const record of exerciseData) {
    const date = extractDate(record.start_time || record.date);
    if (!date) continue;

    const activity = getActivity(date);

    const exercise = {
      type: mapExerciseType(record.exercise_type || record.type),
      startTime: record.start_time || new Date(date + 'T12:00:00').toISOString(),
      duration: record.duration || 0,
      calories: record.calorie || record.calories || 0,
      distance: record.distance || 0
    };

    activity.exercises.push(exercise);
    activity.activeMinutes += Math.round((record.duration || 0) / 60000);
  }

  // Parse heart rate data
  const heartRateData = exportData['com.samsung.shealth.heart_rate'] ||
                        exportData.heart_rate ||
                        exportData.heartRate ||
                        [];

  for (const record of heartRateData) {
    const date = extractDate(record.start_time || record.create_time || record.date);
    if (!date) continue;

    const activity = getActivity(date);
    const hr = record.heart_rate || record.value || record.bpm;
    if (hr && typeof hr === 'number') {
      activity.heartRates.push(hr);
    }
  }

  // Calculate heart rate stats and clean up
  const activities = Array.from(activitiesMap.values());

  for (const activity of activities) {
    if (activity.heartRates.length > 0) {
      activity.heartRateAvg = Math.round(
        activity.heartRates.reduce((a, b) => a + b, 0) / activity.heartRates.length
      );
      activity.heartRateMin = Math.min(...activity.heartRates);
      activity.heartRateMax = Math.max(...activity.heartRates);
    }
    delete activity.heartRates; // Clean up raw data
  }

  // Sort by date descending
  activities.sort((a, b) => b.date.localeCompare(a.date));

  return activities;
}

/**
 * Extract date string from various timestamp formats
 */
function extractDate(timestamp) {
  if (!timestamp) return null;

  // Handle millisecond timestamps
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString().split('T')[0];
  }

  // Handle ISO strings or date strings
  if (typeof timestamp === 'string') {
    // Already a date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
      return timestamp;
    }
    // ISO string or datetime
    try {
      return new Date(timestamp).toISOString().split('T')[0];
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Map Samsung exercise type codes to readable names
 */
function mapExerciseType(samsungType) {
  // Samsung Health exercise type codes
  const typeMap = {
    // Walking & Running
    1001: 'walking',
    1002: 'running',
    1003: 'treadmill',

    // Cycling
    2001: 'cycling',
    2002: 'stationary_bike',

    // Hiking & Outdoor
    3001: 'hiking',
    3002: 'mountain_climbing',

    // Swimming
    11001: 'swimming',
    11002: 'pool_swimming',

    // Gym & Strength
    10001: 'strength',
    10002: 'weight_training',
    10003: 'circuit_training',

    // Yoga & Flexibility
    14001: 'yoga',
    14002: 'pilates',
    14003: 'stretching',

    // Sports
    4001: 'tennis',
    4002: 'badminton',
    5001: 'soccer',
    5002: 'basketball',

    // Other
    15001: 'dancing',
    16001: 'aerobics',
    0: 'other'
  };

  // Handle string types
  if (typeof samsungType === 'string') {
    const lower = samsungType.toLowerCase();
    if (lower.includes('walk')) return 'walking';
    if (lower.includes('run')) return 'running';
    if (lower.includes('cycl') || lower.includes('bike')) return 'cycling';
    if (lower.includes('swim')) return 'swimming';
    if (lower.includes('yoga')) return 'yoga';
    if (lower.includes('strength') || lower.includes('weight')) return 'strength';
    return lower;
  }

  return typeMap[samsungType] || 'other';
}

/**
 * Parse a generic activity JSON format
 * Fallback for non-Samsung data
 */
function parseGenericExport(exportData) {
  const activities = [];

  // Handle array of daily records
  if (Array.isArray(exportData)) {
    for (const record of exportData) {
      const date = extractDate(record.date || record.timestamp || record.day);
      if (!date) continue;

      activities.push({
        date,
        timestamp: date + 'T23:59:59.000Z',
        steps: record.steps || 0,
        calories: record.calories || record.caloriesBurned || 0,
        distance: record.distance || record.distanceKm || 0,
        distanceUnit: 'km',
        activeMinutes: record.activeMinutes || record.active_minutes || 0,
        exercises: record.exercises || record.workouts || [],
        heartRateAvg: record.heartRate || record.avgHeartRate || null
      });
    }
  }

  return activities;
}

module.exports = {
  parseSamsungExport,
  parseGenericExport,
  extractDate,
  mapExerciseType
};
