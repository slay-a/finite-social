// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The `ws` package is a Node.js WebSocket library used by @supabase/realtime-js.
// React Native already provides a global WebSocket implementation, so we shim
// `ws` to an empty object to prevent Metro from trying to bundle Node-only modules
// (net, tls, etc.) that don't exist in the React Native / Hermes environment.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: require.resolve('./ws-shim.js'),
};

module.exports = config;
