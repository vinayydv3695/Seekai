/**
 * Seekai Command Handler
 * Executes custom commands and special actions
 */

class CommandHandler {
  constructor() {
    this.commands = new Map();
    this.registerBuiltInCommands();
  }

  /**
   * Register built-in commands
   */
  registerBuiltInCommands() {
    // Settings command
    this.registerCommand('seekai://settings', async () => {
      chrome.runtime.openOptionsPage();
    });

    // Close tab command
    this.registerCommand('seekai://close-tab', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        await chrome.tabs.remove(tabs[0].id);
      }
    });

    // New tab command
    this.registerCommand('seekai://new-tab', async () => {
      await chrome.tabs.create({});
    });

    // Clear cache command
    this.registerCommand('seekai://clear-cache', async () => {
      await chrome.storage.local.clear();
      window.location.reload();
    });

    // Close other tabs
    this.registerCommand('seekai://close-other-tabs', async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabsToClose = tabs.filter(tab => tab.id !== currentTab[0].id && !tab.pinned);
      const tabIds = tabsToClose.map(tab => tab.id);
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
    });

    // Close all tabs
    this.registerCommand('seekai://close-all-tabs', async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabIds = tabs.filter(tab => !tab.pinned).map(tab => tab.id);
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
    });

    // Reopen closed tab
    this.registerCommand('seekai://reopen-tab', async () => {
      const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
      if (sessions.length > 0) {
        const session = sessions[0];
        if (session.tab) {
          await chrome.sessions.restore(session.tab.sessionId);
        } else if (session.window) {
          await chrome.sessions.restore(session.window.sessionId);
        }
      }
    });

    // Bookmark current page
    this.registerCommand('seekai://bookmark-page', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        const tab = tabs[0];
        await chrome.bookmarks.create({
          title: tab.title,
          url: tab.url
        });
        this.showNotification('Page bookmarked!');
      }
    });

    // Duplicate tab
    this.registerCommand('seekai://duplicate-tab', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        await chrome.tabs.duplicate(tabs[0].id);
      }
    });

    // Pin/Unpin tab
    this.registerCommand('seekai://toggle-pin-tab', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        const tab = tabs[0];
        await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
      }
    });

    // Mute/Unmute tab
    this.registerCommand('seekai://toggle-mute-tab', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        const tab = tabs[0];
        await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo.muted });
      }
    });

    // Clear browsing data
    this.registerCommand('seekai://clear-browsing-data', async () => {
      const since = new Date().getTime() - (24 * 60 * 60 * 1000); // Last 24 hours
      await chrome.browsingData.remove({
        since: since
      }, {
        cache: true,
        cookies: false,
        downloads: false,
        history: false
      });
      this.showNotification('Cache cleared!');
    });
  }

  /**
   * Register a custom command
   * @param {string} pattern - Command pattern (e.g., "seekai://command")
   * @param {Function} handler - Command handler function
   */
  registerCommand(pattern, handler) {
    this.commands.set(pattern, handler);
  }

  /**
   * Execute a command
   * @param {Object} item - Command item
   */
  async executeCommand(item) {
    const url = item.url || item.action;

    // Check if it's a built-in command
    if (this.commands.has(url)) {
      const handler = this.commands.get(url);
      try {
        await handler(item);
      } catch (error) {
        console.error('Command execution failed:', error);
        this.showNotification('Command failed: ' + error.message);
      }
      return;
    }

    // Check if it's a URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.location.href = url;
      return;
    }

    // Check if it's a custom protocol
    if (url.includes('://')) {
      window.location.href = url;
      return;
    }

    // Check if it's a search query
    if (item.type === 'search') {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      window.location.href = searchUrl;
      return;
    }

    // Default: try to open as URL
    try {
      window.location.href = url;
    } catch (error) {
      console.error('Failed to execute command:', error);
      this.showNotification('Invalid command or URL');
    }
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   */
  showNotification(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(139, 92, 246, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      animation: slideInUp 0.3s ease, fadeOut 0.3s ease 2.7s;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Get all registered commands
   * @returns {Array} - List of command patterns
   */
  getRegisteredCommands() {
    return Array.from(this.commands.keys());
  }

  /**
   * Check if a command exists
   * @param {string} pattern - Command pattern
   * @returns {boolean}
   */
  hasCommand(pattern) {
    return this.commands.has(pattern);
  }

  /**
   * Unregister a command
   * @param {string} pattern - Command pattern
   */
  unregisterCommand(pattern) {
    this.commands.delete(pattern);
  }

  /**
   * Save custom command
   * @param {Object} command - Command object
   */
  async saveCustomCommand(command) {
    try {
      const result = await chrome.storage.sync.get({ customCommands: [] });
      const commands = result.customCommands;

      // Check if command already exists
      const existingIndex = commands.findIndex(cmd => cmd.id === command.id);
      
      if (existingIndex >= 0) {
        // Update existing command
        commands[existingIndex] = command;
      } else {
        // Add new command
        commands.push(command);
      }

      await chrome.storage.sync.set({ customCommands: commands });
      return true;
    } catch (error) {
      console.error('Failed to save custom command:', error);
      return false;
    }
  }

  /**
   * Delete custom command
   * @param {string} commandId - Command ID
   */
  async deleteCustomCommand(commandId) {
    try {
      const result = await chrome.storage.sync.get({ customCommands: [] });
      const commands = result.customCommands.filter(cmd => cmd.id !== commandId);
      await chrome.storage.sync.set({ customCommands: commands });
      return true;
    } catch (error) {
      console.error('Failed to delete custom command:', error);
      return false;
    }
  }

  /**
   * Get all custom commands
   * @returns {Array} - List of custom commands
   */
  async getCustomCommands() {
    try {
      const result = await chrome.storage.sync.get({ customCommands: [] });
      return result.customCommands;
    } catch (error) {
      console.error('Failed to get custom commands:', error);
      return [];
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CommandHandler;
}
