const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'wasm' to the list of strictly resolved assets so the web bundler can load expo-sqlite's WebAssembly core.
config.resolver.assetExts.push('wasm');

module.exports = config;
