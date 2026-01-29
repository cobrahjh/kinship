// Behavioral Science Features for MS Exercise Companion

// Extended state properties
const behaviorState = {
  energyLevel: null,
  showEnergyCheck: false,
  restDaysTaken: JSON.parse(localStorage.getItem('msRestDays') || '[]'),
  exerciseTimeLog: JSON.parse(localStorage.getItem('msExerciseTimes') || '[]')
};

// Merge into main state
Object.assign(state, behaviorState);

// Energy check functions
function showEnergyCheck() {
  state.showEnergyCheck = true;
  render();
}

function hideEnergyCheck() {
  state.showEnergyCheck = false;
  render();
}

function setEnergy(level) {
  state.energyLevel = level;
  state.showEnergyCheck = false;
  localStorage.setItem('msLastEnergy', JSON.stringify({level, time: Date.now()}));

  // Log exercise time for pattern learning
  const hour = new Date().getHours();
  state.exerciseTimeLog.push({hour, energy: level, date: new Date().toISOString().split('T')[0]});
  localStorage.setItem('msExerciseTimes', JSON.stringify(state.exerciseTimeLog.slice(-100)));

  render();
}

function getBestExerciseTime() {
  if (state.exerciseTimeLog.length < 5) return null;

  const hourStats = {};
  state.exerciseTimeLog.forEach(log => {
    if (!hourStats[log.hour]) hourStats[log.hour] = {total: 0, count: 0};
    hourStats[log.hour].total += log.energy;
    hourStats[log.hour].count++;
  });

  let bestHour = null, bestAvg = 0;
  Object.entries(hourStats).forEach(([hour, stats]) => {
    const avg = stats.total / stats.count;
    if (avg > bestAvg && stats.count >= 2) {
      bestAvg = avg;
      bestHour = parseInt(hour);
    }
  });

  if (bestHour !== null) {
    const period = bestHour < 12 ? 'morning' : bestHour < 17 ? 'afternoon' : 'evening';
    const timeStr = bestHour <= 12 ? (bestHour || 12) + 'am' : (bestHour - 12) + 'pm';
    return {hour: bestHour, period, timeStr, avgEnergy: bestAvg.toFixed(1)};
  }
  return null;
}

// Rest day functions
function takeRestDay() {
  const today = new Date().toISOString().split('T')[0];
  if (!state.restDaysTaken.includes(today)) {
    state.restDaysTaken.push(today);
    localStorage.setItem('msRestDays', JSON.stringify(state.restDaysTaken.slice(-30)));

    // Keep streak alive
    if (typeof sampleStats !== 'undefined') {
      sampleStats.streaks.lastDate = today;
      state.stats = sampleStats;
    }
  }
  render();
  setTimeout(() => alert('Rest day logged! Your streak is safe. Recovery is part of progress.'), 100);
}

function isRestDayToday() {
  const today = new Date().toISOString().split('T')[0];
  return state.restDaysTaken.includes(today);
}

// Streak protection
function isStreakAtRisk() {
  if (!state.stats || !state.stats.streaks) return false;
  const lastDate = state.stats.streaks.lastDate;
  if (!lastDate) return false;

  const last = new Date(lastDate);
  const now = new Date();
  now.setHours(0,0,0,0);
  last.setHours(0,0,0,0);
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));

  return diffDays >= 1 && state.stats.streaks.current > 0 && !isRestDayToday();
}

function doQuickExercise() {
  const today = new Date().toISOString().split('T')[0];
  if (!state.completedToday.includes('quick-save')) {
    state.completedToday.push('quick-save');
    saveState();

    if (typeof sampleStats !== 'undefined') {
      sampleStats.streaks.current++;
      sampleStats.streaks.lastDate = today;
      if (sampleStats.streaks.current > sampleStats.streaks.longest) {
        sampleStats.streaks.longest = sampleStats.streaks.current;
      }
      state.stats = sampleStats;
    }
  }
  render();
  setTimeout(() => alert('Streak saved! Even small movement counts.'), 100);
}

// Mood correlation (simulated - would connect to Kinship API)
function getMoodCorrelation() {
  const exerciseDays = state.exerciseTimeLog.length;
  if (exerciseDays < 3) return null;

  // Simulated data - in real app, fetch from /api/lifelog/patterns
  return {
    moodBoost: 23,
    bestMoodExercise: 'stretching',
    avgMoodWithExercise: 0.72,
    avgMoodWithout: 0.58
  };
}

function getEnergyBasedSuggestion() {
  if (!state.energyLevel) return null;

  if (state.energyLevel <= 2) {
    return {
      title: "Low Energy Day",
      message: "Try gentle seated exercises or stretching. Even 5 minutes helps!",
      suggested: "stretching",
      icon: "🌙"
    };
  } else if (state.energyLevel <= 3) {
    return {
      title: "Moderate Energy",
      message: "Balance or upper body exercises would be great today.",
      suggested: "balance",
      icon: "☀️"
    };
  } else {
    return {
      title: "Good Energy!",
      message: "Perfect for aerobic exercises or a full routine.",
      suggested: "aerobic",
      icon: "⚡"
    };
  }
}

console.log('[Behavior] Module loaded');
