/**
 * Plugin Loader for Kinship
 * Discovers, validates, and loads plugins from the plugins directory
 */

const fs = require('fs');
const path = require('path');

// Runtime registry of loaded plugins
const registry = [];

/**
 * Load all plugins from the plugins directory
 * @param {string} pluginsDir - Path to plugins directory
 * @param {object} context - Shared context passed to plugins (entries, saveEntries, log, etc.)
 * @returns {Promise<Array>} Array of loaded plugin objects
 */
async function loadPlugins(pluginsDir, context = {}) {
  const absoluteDir = path.resolve(pluginsDir);

  if (!fs.existsSync(absoluteDir)) {
    console.log('[Plugins] No plugins directory found');
    return [];
  }

  const items = fs.readdirSync(absoluteDir);

  for (const item of items) {
    const itemPath = path.join(absoluteDir, item);
    const stat = fs.statSync(itemPath);

    // Skip non-directories and the loader itself
    if (!stat.isDirectory()) continue;

    const indexPath = path.join(itemPath, 'index.js');

    // Check if plugin has an index.js
    if (!fs.existsSync(indexPath)) {
      console.log(`[Plugins] Skipping ${item}: no index.js found`);
      continue;
    }

    try {
      const plugin = require(indexPath);

      // Validate plugin interface
      if (!validatePlugin(plugin, item)) {
        continue;
      }

      // Initialize plugin if it has an init function
      if (typeof plugin.init === 'function') {
        await plugin.init(context);
        console.log(`[Plugins] Initialized: ${plugin.name}`);
      }

      registry.push(plugin);
      console.log(`[Plugins] Loaded: ${plugin.name} v${plugin.version}`);

    } catch (err) {
      console.error(`[Plugins] Failed to load ${item}:`, err.message);
    }
  }

  return registry;
}

/**
 * Validate that a plugin has the required interface
 */
function validatePlugin(plugin, folderName) {
  const required = ['name', 'label', 'version'];

  for (const field of required) {
    if (!plugin[field]) {
      console.error(`[Plugins] ${folderName}: missing required field '${field}'`);
      return false;
    }
  }

  // Ensure routes is an Express router if provided
  if (plugin.routes && typeof plugin.routes !== 'function') {
    console.error(`[Plugins] ${folderName}: routes must be an Express router`);
    return false;
  }

  return true;
}

/**
 * Get all registered plugins
 */
function getPluginRegistry() {
  return registry;
}

/**
 * Get a specific plugin by name
 */
function getPlugin(name) {
  return registry.find(p => p.name === name);
}

/**
 * Call a hook on all plugins that implement it
 * @param {string} hookName - Name of the hook (e.g., 'onEntryCreated')
 * @param {...any} args - Arguments to pass to the hook
 */
async function callHook(hookName, ...args) {
  const results = [];

  for (const plugin of registry) {
    if (plugin.hooks && typeof plugin.hooks[hookName] === 'function') {
      try {
        const result = await plugin.hooks[hookName](...args);
        if (result !== undefined) {
          results.push({ plugin: plugin.name, result });
        }
      } catch (err) {
        console.error(`[Plugins] Hook ${hookName} failed for ${plugin.name}:`, err.message);
      }
    }
  }

  return results;
}

module.exports = {
  loadPlugins,
  getPluginRegistry,
  getPlugin,
  callHook
};
