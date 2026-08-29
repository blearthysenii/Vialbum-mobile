const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prefer macOS FSEvents when Watchman is unavailable or not running.
config.resolver.useWatchman = false;

module.exports = config;
