/**
 * Seekai Main Application
 * Orchestrates all components and manages app lifecycle
 */

// ==========================================
// Seekai New Tab Logic
// ==========================================

// WORKAROUND: Chrome intentionally steals focus and places it in the address bar 
// on new tab pages. To bypass this and autofocus our search bar, we immediately 
// redirect to the same page with a query parameter. When a new tab has a query 
// parameter, Chrome allows the page to keep focus!
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
if (!isFirefox && !window.location.search.includes('focus')) {
  window.location.replace(window.location.href + '?focus=1');
}

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

    // Handle Enter key when no results (Web search fallback)
    this.uiController.onEnterWithNoResults((query) => {
      this.searchWeb(query);
    });

    // Handle Pin action
    this.uiController.onPin(async (item) => {
      await this.dataIndexer.togglePin(item.id);
      
      // Re-render currently viewed state
      if (this.uiController.state.searchQuery) {
        await this.handleSearch(this.uiController.state.searchQuery);
      } else {
        await this.renderInitialState();
      }
    });

    const bAPI = typeof browser !== 'undefined' ? browser : chrome;

    // Handle Bookmark Edit
    this.uiController.onBookmarkEdit(async (item, newTitle, newUrl) => {
      try {
        await new Promise((resolve, reject) => {
          bAPI.bookmarks.update(item.id, {
            title: newTitle,
            url: newUrl
          }, (result) => {
            if (bAPI.runtime.lastError) reject(bAPI.runtime.lastError);
            else resolve(result);
          });
        });
        await this.refreshData();
      } catch (e) {
        console.error('Failed to edit bookmark', e);
        alert('Error saving bookmark: ' + (e.message || JSON.stringify(e)));
        this.showError('Failed to edit bookmark');
      }
    });

    // Handle Bookmark Delete
    this.uiController.onBookmarkDelete(async (item) => {
      try {
        await new Promise((resolve, reject) => {
          bAPI.bookmarks.remove(item.id, () => {
            if (bAPI.runtime.lastError) reject(bAPI.runtime.lastError);
            else resolve();
          });
        });
        await this.refreshData();
      } catch (e) {
        console.error('Failed to delete bookmark', e);
        alert('Error deleting bookmark: ' + (e.message || JSON.stringify(e)));
        this.showError('Failed to delete bookmark');
      }
    });
  }

  /**
   * Render initial state (all bookmarks)
   */
  async renderInitialState() {
    // If Zen Mode is active, do not render any initial results
    if (this.dataIndexer.settings && this.dataIndexer.settings.zenMode) {
      this.uiController.elements.resultsContainer.style.display = 'none';
      return;
    } else {
      this.uiController.elements.resultsContainer.style.display = 'flex';
    }

    // Get all bookmarks (already sorted by usage count in dataIndexer)
    let allBookmarks = this.dataIndexer.getDataByType('bookmarks');

    // Render as initial results, mapping isPinned status
    let results = allBookmarks.map(item => ({
      item,
      score: this.dataIndexer.isPinned(item.id) ? 9999 : 1, // High score for pinned items
      isPinned: this.dataIndexer.isPinned(item.id),
      matches: [],
      matchedField: 'title'
    }));

    // Sort: pinned first, then by usage count
    results.sort((a, b) => b.score - a.score || (b.item.useCount || 0) - (a.item.useCount || 0));

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

    // Show container if it was hidden by Zen Mode
    this.uiController.elements.resultsContainer.style.display = 'flex';

    // Get max results from settings
    const maxResults = this.dataIndexer.settings ? parseInt(this.dataIndexer.settings.maxResults || '10') : 10;

    // Perform fuzzy search
    let results = this.fuzzyEngine.search(query, maxResults * 2); // Search a bit more to ensure enough results after grouping

    // Inject isPinned status
    results = results.map(result => ({
      ...result,
      isPinned: this.dataIndexer.isPinned(result.item.id)
    }));

    // Check if query is a simple math expression
    const calcResult = this.evaluateMath(query);
    if (calcResult !== null) {
      results.unshift({
        item: {
          id: 'calc_result',
          title: `${query} = ${calcResult}`,
          url: `naviko://copy?text=${encodeURIComponent(calcResult)}`,
          type: 'command',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path></svg>',
          description: 'Copy result to clipboard',
        },
        score: 2,
        matches: [],
        matchedField: 'title'
      });
    }

    // Slice to exactly maxResults
    results = results.slice(0, maxResults);

    // If no results and no bookmarks exist, this will trigger Web search on Enter
    this.uiController.renderResults(results, this.fuzzyEngine);
  }

  /**
   * Evaluate simple math expression
   */
  evaluateMath(query) {
    // Only allow safe math expressions: numbers, operators, spaces, parentheses, decimals
    if (!/^[0-9+\-*/().\s]+$/.test(query)) return null;
    
    // Prevent evaluating plain numbers
    if (/^[0-9.\s]+$/.test(query)) return null;

    try {
      // Safe to use eval since we strictly validated characters
      const result = eval(query);
      if (Number.isFinite(result)) {
        return Math.round(result * 10000) / 10000;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  /**
   * Search the web with fallback to chosen engine
   * @param {string} query - Search query
   */
  searchWeb(query) {
    const trimmedQuery = query.trim();
    
    // Check if the query is actually a URL
    const hasProtocol = /^(https?|file|chrome|chrome-extension):\/\//i.test(trimmedQuery);
    const looksLikeDomain = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([:\/][^\s]*)?$/.test(trimmedQuery);
    const isLocalhost = /^localhost(:[0-9]+)?([\/][^\s]*)?$/.test(trimmedQuery);

    if (hasProtocol || looksLikeDomain || isLocalhost) {
      let urlToOpen = trimmedQuery;
      if (!hasProtocol) {
        urlToOpen = (isLocalhost ? 'http://' : 'https://') + trimmedQuery;
      }
      window.location.href = urlToOpen;
      return;
    }

    const engine = (this.dataIndexer.settings && this.dataIndexer.settings.defaultSearchEngine) || 'google';
    let searchUrl = '';

    switch (engine) {
      case 'duckduckgo':
        searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        break;
      case 'brave':
        searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
        break;
      case 'perplexity':
        searchUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
        break;
      case 'google':
      default:
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        break;
    }
    window.location.href = searchUrl;
  }

  /**
   * Handle item selection
   * @param {Object} item - Selected item
   */
  async handleItemSelection(item) {
    try {
      if (item.url && item.url.startsWith('copy://')) {
        const textToCopy = item.url.replace('copy://', '');
        await navigator.clipboard.writeText(textToCopy);
        return;
      }

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

      // Re-render currently viewed state
      if (this.uiController.state.searchQuery) {
        await this.handleSearch(this.uiController.state.searchQuery);
      } else {
        await this.renderInitialState();
      }

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
