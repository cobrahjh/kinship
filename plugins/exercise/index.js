/**
 * Exercise Plugin for Kinship
 * MS-focused exercise companion based on neuroplasticity principles
 */

const path = require('path');
const routes = require('./routes');
const data = require('./data');

module.exports = {
  // Plugin metadata
  name: 'exercise',
  label: 'Exercise',
  version: '1.0.0',
  description: 'MS-focused exercise tracking with neuroplasticity principles',

  // Express router for API endpoints
  routes,

  // Path to static files (served at /plugins/exercise/)
  publicDir: path.join(__dirname, 'public'),

  // Lifecycle hooks
  init: async (context) => {
    console.log('[Exercise Plugin] Initialized');
  },

  // Integration hooks
  hooks: {
    /**
     * Called when a new voice entry is created
     * Detects exercise-related mentions in transcripts
     */
    onEntryCreated: async (entry) => {
      if (!entry.transcript) return null;

      const exerciseKeywords = [
        'exercise', 'workout', 'stretch', 'balance', 'walk', 'walking',
        'yoga', 'physical therapy', 'PT', 'movement', 'strength'
      ];

      const transcript = entry.transcript.toLowerCase();
      const mentions = exerciseKeywords.filter(kw => transcript.includes(kw));

      if (mentions.length > 0) {
        return {
          plugin: 'exercise',
          detected: true,
          keywords: mentions,
          suggestion: 'This entry mentions exercise. Consider logging a session!'
        };
      }
      return null;
    },

    /**
     * Called when entry is analyzed by Claude
     * Extracts exercise-related topics and action items
     */
    onEntryAnalyzed: async (entry) => {
      const exerciseTopics = ['exercise', 'fitness', 'health', 'workout'];
      const topics = entry.topics || [];
      const actionItems = entry.actionItems || [];

      const relatedTopics = topics.filter(t =>
        exerciseTopics.some(et => t.toLowerCase().includes(et))
      );

      const exerciseActions = actionItems.filter(a =>
        /exercise|workout|stretch|walk|PT/i.test(a)
      );

      if (relatedTopics.length > 0 || exerciseActions.length > 0) {
        return {
          plugin: 'exercise',
          topics: relatedTopics,
          actionItems: exerciseActions
        };
      }
      return null;
    },

    /**
     * Called when generating daily/weekly digests
     * Returns exercise activity summary for inclusion
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
