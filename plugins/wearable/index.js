/**
 * Wearable Plugin for Kinship
 * Samsung Watch integration for activity tracking and context enrichment
 */

const path = require('path');
const routes = require('./routes');
const data = require('./data');

module.exports = {
  // Plugin metadata
  name: 'wearable',
  label: 'Wearable',
  version: '1.0.0',
  description: 'Samsung Watch integration for activity tracking',

  // Express router for API endpoints
  routes,

  // No separate public dir - UI integrated into main app
  // publicDir: path.join(__dirname, 'public'),

  // Lifecycle hooks
  init: async (context) => {
    console.log('[Wearable Plugin] Initialized');
  },

  // Integration hooks
  hooks: {
    /**
     * Called when a new voice entry is created
     * Attaches current activity context to the entry
     */
    onEntryCreated: async (entry) => {
      const entryDate = entry.timestamp.split('T')[0];
      const entryTime = new Date(entry.timestamp);
      const activity = data.getActivityForDate(entryDate);

      if (activity) {
        const snapshot = data.calculateSnapshotAtTime(activity, entryTime);

        return {
          plugin: 'wearable',
          attachContext: true,
          context: snapshot
        };
      }

      return null;
    },

    /**
     * Called when entry is analyzed by Claude
     * Adds activity-aware insights
     */
    onEntryAnalyzed: async (entry) => {
      if (!entry.wearableContext?.snapshot) return null;

      const { stepsToday, activeMinutesToday, dayProgress, lastExercise } = entry.wearableContext.snapshot;
      const insights = [];

      // Goal achievements
      if (dayProgress.steps >= 1) {
        insights.push('Step goal reached');
      } else if (dayProgress.steps >= 0.75) {
        insights.push('Near step goal');
      }

      if (dayProgress.activeMinutes >= 1) {
        insights.push('Activity goal met');
      }

      // Recent exercise context
      if (lastExercise && lastExercise.minutesAgo < 60) {
        insights.push(`Recently did ${lastExercise.type}`);
      }

      if (insights.length > 0) {
        return {
          plugin: 'wearable',
          activityInsights: insights,
          summary: `Activity: ${stepsToday.toLocaleString()} steps, ${activeMinutesToday} active min`
        };
      }

      return null;
    },

    /**
     * Called when generating daily/weekly digests
     * Returns activity summary for inclusion
     */
    contributeToDigest: async (entries, dateRange) => {
      const contribution = data.getDigestContribution(
        dateRange.start,
        dateRange.end
      );
      return contribution;
    }
  }
};
