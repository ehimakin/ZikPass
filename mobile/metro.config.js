const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Share pure credential code without resolving the website's React installation.
config.watchFolders = [path.resolve(__dirname, '../lib')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
