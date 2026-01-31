/**
 * Seekai Main Application
 * Orchestrates all components and manages app lifecycle
 */

class SeekaiApp {
  constructor() {
    this.fuzzyEngine = new FuzzyEngine();
    this.dataIndexer = new DataIndexer();
    this.uiController = new UIController();
    this.commandHandler = new CommandHandler();
    
    this.isInitialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Initialize UI first (must cache elements before using them)
      this.uiController.init();

      // Show loading after UI is initialized
      this.uiController.showLoading();

      // Set up callbacks
      this.setupCallbacks();

      // Initialize data indexer
      await this.dataIndexer.init();

      // Set initial data for fuzzy search
      const data = this.dataIndexer.getCombinedData();
      this.fuzzyEngine.setItems(data);

      // Render initial state
      await this.renderInitialState();

      // Hide loading
      this.uiController.hideLoading();

      this.isInitialized = true;

      // Ensure search input is focused after everything loads
      this.uiController.focusSearchInput();

      // Auto-refresh data periodically
      this.startAutoRefresh();

    } catch (error) {
      console.error('Failed to initialize Seekai:', error);
      if (this.uiController.elements.loadingOverlay) {
        this.uiController.hideLoading();
      }
      this.showError('Failed to initialize. Please refresh the page.');
    }
  }

  /**
   * Set up UI callbacks
   */
  setupCallbacks() {
    // Handle search
    this.uiController.onSearch((query) => {
      this.handleSearch(query);
    });

    // Handle item selection
    this.uiController.onSelect((item) => {
      this.handleItemSelection(item);
    });

    // Handle refresh
    this.uiController.onRefresh(async () => {
      await this.refreshData();
    });

    // Handle Enter key when no results (Google search fallback)
    this.uiController.onEnterWithNoResults((query) => {
      this.searchGoogle(query);
    });
  }

  /**
   * Render initial state (all bookmarks)
   */
  async renderInitialState() {
    // Get all bookmarks (already sorted by usage count in dataIndexer)
    const allBookmarks = this.dataIndexer.getDataByType('bookmarks');

    // Render as initial results
    const results = allBookmarks.map(item => ({
      item,
      score: 1,
      matches: [],
      matchedField: 'title'
    }));

    this.uiController.renderResults(results, this.fuzzyEngine);
    
    // Hide shortcuts when showing all bookmarks
    this.uiController.hideShortcuts();
  }

  /**
   * Get shortcut items
   */
  getShortcuts() {
    const frequentItems = this.dataIndexer.getFrequentItems(8);
    return frequentItems;
  }

  /**
   * Handle search query
   * @param {string} query - Search query
   */
  async handleSearch(query) {
    if (!query || query.trim() === '') {
      // Show recent items when no query
      await this.renderInitialState();
      return;
    }

    // Perform fuzzy search
    const results = this.fuzzyEngine.search(query, 50);

    // If no results and no bookmarks exist, this will trigger Google search on Enter
    this.uiController.renderResults(results, this.fuzzyEngine);
  }

  /**
   * Search Google with query
   * @param {string} query - Search query
   */
  searchGoogle(query) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.location.href = searchUrl;
  }

  /**
   * Handle item selection
   * @param {Object} item - Selected item
   */
  async handleItemSelection(item) {
    try {
      if (item.type === 'command') {
        // Handle command
        await this.commandHandler.executeCommand(item);
      } else if (item.type === 'tab') {
        // Switch to existing tab
        await chrome.tabs.update(item.id, { active: true });
        await chrome.windows.update(item.windowId, { focused: true });
      } else if (item.type === 'bookmark') {
        // Track bookmark usage before opening
        await this.dataIndexer.trackBookmarkUsage(item.id);
        // Open URL in current tab
        window.location.href = item.url;
      } else {
        // Open URL in current tab (fallback for other types)
        window.location.href = item.url;
      }
    } catch (error) {
      console.error('Failed to handle item selection:', error);
    }
  }

  /**
   * Refresh all data
   */
  async refreshData() {
    try {
      this.uiController.showLoading();

      // Force refresh indexer
      await this.dataIndexer.forceRefresh();

      // Update fuzzy engine
      const data = this.dataIndexer.getCombinedData();
      this.fuzzyEngine.setItems(data);

      // Re-render
      await this.renderInitialState();

      this.uiController.hideLoading();
    } catch (error) {
      console.error('Failed to refresh data:', error);
      this.uiController.hideLoading();
    }
  }

  /**
   * Start auto-refresh timer
   */
  startAutoRefresh() {
    // Refresh data every 30 seconds
    setInterval(async () => {
      await this.refreshData();
    }, 30000);
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    console.error(message);
    // Could show a toast notification here
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new SeekaiApp();
    app.init();
  });
} else {
  const app = new SeekaiApp();
  app.init();
}
