/**
 * Seekai Background Service Worker
 * Handles extension lifecycle, events, and background tasks
 */

// Installation handler
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Seekai installed!');
    
    // Set default settings
    await chrome.storage.sync.set({
      enableBookmarks: true,
      enableHistory: false,  // Disabled by default
      enableTabs: false,
      enableCommands: true,
      accentColor: 'cyan',
      customCommands: []
    });

    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/newtab.html')
    });
  } else if (details.reason === 'update') {
    console.log('Seekai updated!');
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    // Open new tab with Seekai
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/newtab.html')
    });
  }
});

// Listen for tab updates to keep index fresh
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Tab finished loading - could trigger re-index
    console.log('Tab updated:', tab.title);
  }
});

// Listen for tab creation
chrome.tabs.onCreated.addListener((tab) => {
  console.log('Tab created:', tab.id);
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log('Tab removed:', tabId);
});

// Listen for bookmark changes
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log('Bookmark created:', bookmark.title);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  console.log('Bookmark removed:', id);
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  console.log('Bookmark changed:', id, changeInfo);
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getData') {
    // Handle data requests
    handleDataRequest(request.dataType)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'executeCommand') {
    // Handle command execution
    handleCommandExecution(request.command)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'clearCache') {
    // Clear local cache
    chrome.storage.local.clear()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }


});

/**
 * Handle data requests
 * @param {string} dataType - Type of data to fetch
 * @returns {Promise<Array>}
 */
async function handleDataRequest(dataType) {
  switch (dataType) {
    case 'bookmarks':
      return await chrome.bookmarks.getTree();
    
    case 'history':
      // History disabled - return empty array
      return [];
    
    case 'tabs':
      return await chrome.tabs.query({});
    
    case 'settings':
      return await chrome.storage.sync.get({
        enableBookmarks: true,
        enableHistory: false,
        enableTabs: false,
        enableCommands: true,
        accentColor: 'cyan',
        customCommands: []
      });
    
    default:
      throw new Error('Unknown data type: ' + dataType);
  }
}

/**
 * Handle command execution
 * @param {Object} command - Command to execute
 * @returns {Promise<any>}
 */
async function handleCommandExecution(command) {
  const { action, params } = command;

  switch (action) {
    case 'openTab':
      return await chrome.tabs.create({ url: params.url });
    
    case 'closeTab':
      return await chrome.tabs.remove(params.tabId);
    
    case 'switchTab':
      await chrome.tabs.update(params.tabId, { active: true });
      if (params.windowId) {
        await chrome.windows.update(params.windowId, { focused: true });
      }
      return true;
    
    case 'createBookmark':
      return await chrome.bookmarks.create({
        title: params.title,
        url: params.url
      });
    
    case 'removeBookmark':
      return await chrome.bookmarks.remove(params.id);
    
    case 'clearHistory':
      // History disabled - return success without doing anything
      return true;
    
    default:
      throw new Error('Unknown command: ' + action);
  }
}

/**
 * Service Worker Lifecycle Events
 */

// Service worker activated
self.addEventListener('install', (event) => {
  console.log('Seekai service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Seekai service worker activated!');
  event.waitUntil(clients.claim());
});

console.log('Seekai background service worker loaded!');
