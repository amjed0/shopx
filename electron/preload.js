/**
 * Electron Preload Script
 * Runs in an isolated context before the renderer page loads.
 * Exposes safe APIs to the renderer via contextBridge if needed.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('shopxElectron', {
  platform: process.platform,
  version: process.versions.electron,
});
