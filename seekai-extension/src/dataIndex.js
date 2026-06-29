/**
 * Seekai Data Indexer
 * Manages and indexes bookmarks, history, tabs, and custom commands
 * Updated: 2026-01-31
 */

class DataIndexer {
  constructor() {
    this.cache = {
      bookmarks: [],
      history: [],
      tabs: [],
      commands: [],
      combined: []
    };
    
    this.settings = {
      enableBookmarks: true,
      enableTabs: false,
      enableCommands: true,
      zenMode: false,
      maxResults: '10',
      defaultSearchEngine: 'google'
    };

    this.pinnedLinks = new Set();
    this.usageStats = {};

    this.lastUpdate = 0;
    this.updateInterval = 5000; // 5 seconds
  }

  /**
   * Initialize the indexer with user settings
   */
  async init() {
    await this.loadSettings();
    await this.indexAll();
  }

  /**
   * Load settings from chrome.storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        enableBookmarks: true,
        enableTabs: false,
        enableCommands: true,
        zenMode: false,
        maxResults: '10',
        defaultSearchEngine: 'google'
      });
      
      this.settings = result;

      // Load pinned links and usage stats from local storage
      const localData = await chrome.storage.local.get(['pinnedLinks', 'usageStats']);
      this.pinnedLinks = new Set(localData.pinnedLinks || []);
      this.usageStats = localData.usageStats || {};
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Index all data sources
   */
  async indexAll() {
    const now = Date.now();
    
    // Throttle updates
    if (now - this.lastUpdate < this.updateInterval) {
      return this.cache.combined;
    }

    this.lastUpdate = now;

    const promises = [];

    if (this.settings.enableBookmarks) {
      promises.push(this.indexBookmarks());
    }

    // History indexing disabled
    // if (this.settings.enableHistory) {
    //   promises.push(this.indexHistory());
    // }

    if (this.settings.enableTabs) {
      promises.push(this.indexTabs());
    }

    await Promise.all(promises);

    this.combineResults();
    return this.cache.combined;
  }

  /**
   * Index all bookmarks
   */
  async indexBookmarks() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      this.cache.bookmarks = [];
      
      // Get usage stats from storage
      const { bookmarkStats = {} } = await chrome.storage.local.get('bookmarkStats');
      
      this.traverseBookmarks(bookmarkTree, bookmarkStats);
      
      // Sort bookmarks by usage count (most used first)
      this.cache.bookmarks.sort((a, b) => {
        const countA = a.useCount || 0;
        const countB = b.useCount || 0;
        if (countB !== countA) {
          return countB - countA; // Higher use count first
        }
        // If same use count, sort by date added (newer first)
        return (b.dateAdded || 0) - (a.dateAdded || 0);
      });
      
    } catch (error) {
      console.error('Failed to index bookmarks:', error);
      this.cache.bookmarks = [];
    }
  }

  /**
   * Recursively traverse bookmark tree
   * @param {Array} nodes - Bookmark tree nodes
   * @param {Object} stats - Usage statistics
   */
  traverseBookmarks(nodes, stats = {}) {
    for (const node of nodes) {
      if (node.url) {
        const bookmarkId = node.id;
        const usageData = stats[bookmarkId] || { count: 0, lastUsed: 0 };
        
        this.cache.bookmarks.push({
          id: node.id,
          title: node.title || 'Untitled',
          url: node.url,
          type: 'bookmark',
          icon: this.getFaviconUrl(node.url),
          dateAdded: node.dateAdded,
          useCount: usageData.count || 0,
          lastUsed: usageData.lastUsed || node.dateAdded
        });
      }
      
      if (node.children) {
        this.traverseBookmarks(node.children, stats);
      }
    }
  }

  /**
   * Index browser history (DISABLED)
   */
  async indexHistory() {
    // History indexing disabled - keeping function for compatibility
    this.cache.history = [];
  }

  /**
   * Index open tabs
   */
  async indexTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      
      this.cache.tabs = tabs
        .filter(tab => tab.url && tab.title && tab.title !== 'Seekai' && !tab.url.includes('newtab.html'))
        .map(tab => ({
          id: tab.id,
          title: tab.title || 'Untitled',
          url: tab.url,
          type: 'tab',
          icon: tab.favIconUrl || this.getFaviconUrl(tab.url),
          windowId: tab.windowId,
          active: tab.active,
          pinned: tab.pinned,
          lastVisitTime: Date.now()
        }));

    } catch (error) {
      console.error('Failed to index tabs:', error);
      this.cache.tabs = [];
    }
  }

  /**
   * Combine all indexed data with priority weighting
   */
  combineResults() {
    const combined = [];

    // Add tabs (highest priority)
    combined.push(...this.cache.tabs);

    // Add bookmarks
    combined.push(...this.cache.bookmarks);

    // Add recent history (filter out duplicates)
    const existingUrls = new Set(combined.map(item => item.url));
    for (const item of this.cache.history) {
      if (!existingUrls.has(item.url)) {
        combined.push(item);
        existingUrls.add(item.url);
      }
    }

    this.cache.combined = combined;
  }

  /**
   * Get combined indexed data
   */
  getCombinedData() {
    return this.cache.combined;
  }

  /**
   * Get data by type
   * @param {string} type - Data type (bookmarks, history, tabs, commands)
   */
  getDataByType(type) {
    return this.cache[type] || [];
  }

  /**
   * Get frequently visited items
   * @param {number} limit - Number of items to return
   */
  getFrequentItems(limit = 10) {
    return this.cache.history
      .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
      .slice(0, limit);
  }

  /**
   * Get recently visited items
   * @param {number} limit - Number of items to return
   */
  getRecentItems(limit = 10) {
    const recent = [...this.cache.history, ...this.cache.bookmarks]
      .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0))
      .slice(0, limit);
    
    return recent;
  }

  /**
   * Get favicon URL for a given page URL
   * @param {string} url - Page URL
   * @returns {string}
   */
  getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Only attempt to fetch favicons for valid http/https public domains
      if (!['http:', 'https:'].includes(urlObj.protocol)) return '';
      if (!urlObj.hostname.includes('.') || urlObj.hostname.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
        return '';
      }
      
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch (error) {
      return '';
    }
  }

  /**
   * Track bookmark usage
   * @param {string} bookmarkId - Bookmark ID
   */
  async trackBookmarkUsage(bookmarkId) {
    try {
      // Get current stats
      const { bookmarkStats = {} } = await chrome.storage.local.get('bookmarkStats');
      
      // Update stats for this bookmark
      if (!bookmarkStats[bookmarkId]) {
        bookmarkStats[bookmarkId] = { count: 0, lastUsed: 0 };
      }
      
      bookmarkStats[bookmarkId].count = (bookmarkStats[bookmarkId].count || 0) + 1;
      bookmarkStats[bookmarkId].lastUsed = Date.now();
      
      // Save updated stats
      await chrome.storage.local.set({ bookmarkStats });
      
      console.log(`Bookmark ${bookmarkId} usage tracked:`, bookmarkStats[bookmarkId]);
    } catch (error) {
      console.error('Failed to track bookmark usage:', error);
    }
  }

  /**
   * Force refresh all data
   */
  async forceRefresh() {
    this.lastUpdate = 0;
    return await this.indexAll();
  }

  /**
   * Toggle pin status of a link
   * @param {string} id - Item ID
   */
  async togglePin(id) {
    if (this.pinnedLinks.has(id)) {
      this.pinnedLinks.delete(id);
    } else {
      this.pinnedLinks.add(id);
    }
    
    // Save to storage
    await chrome.storage.local.set({
      pinnedLinks: Array.from(this.pinnedLinks)
    });
  }

  /**
   * Check if a link is pinned
   * @param {string} id - Item ID
   */
  isPinned(id) {
    return this.pinnedLinks.has(id);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = {
      bookmarks: [],
      history: [],
      tabs: [],
      commands: [],
      combined: []
    };
    this.lastUpdate = 0;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataIndexer;
}
