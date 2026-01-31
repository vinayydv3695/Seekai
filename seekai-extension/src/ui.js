/**
 * Seekai UI Controller
 * Manages UI rendering, keyboard navigation, and user interactions
 */

class UIController {
  constructor() {
    this.elements = {
      searchInput: null,
      resultsList: null,
      resultsContainer: null,
      noResults: null,
      shortcutsContainer: null,
      shortcutsGrid: null,
      loadingOverlay: null
    };

    this.state = {
      results: [],
      selectedIndex: -1,
      isSearching: false,
      searchQuery: ''
    };

    this.callbacks = {
      onSearch: null,
      onSelect: null,
      onRefresh: null,
      onEnterWithNoResults: null
    };

    // Debounce timer for search
    this.searchTimeout = null;
  }

  /**
   * Initialize the UI controller
   */
  init() {
    this.cacheElements();
    this.attachEventListeners();
    this.focusSearchInput();
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements.searchInput = document.getElementById('searchInput');
    this.elements.resultsList = document.getElementById('resultsList');
    this.elements.resultsContainer = document.getElementById('resultsContainer');
    this.elements.noResults = document.getElementById('noResults');
    this.elements.emptyState = document.getElementById('emptyState');
    this.elements.shortcutsContainer = document.getElementById('shortcutsContainer');
    this.elements.shortcutsGrid = document.getElementById('shortcutsGrid');
    this.elements.loadingOverlay = document.getElementById('loadingOverlay');

    // Verify critical elements exist
    if (!this.elements.searchInput) {
      console.error('Critical element missing: searchInput');
    }
    if (!this.elements.resultsList) {
      console.error('Critical element missing: resultsList');
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Search input
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });

      // Keyboard navigation
      this.elements.searchInput.addEventListener('keydown', (e) => {
        this.handleKeyDown(e);
      });
    }

    // Settings button (now in search bar)
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // Empty state add bookmark button
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateAddBtn) {
      emptyStateAddBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // Click outside to clear selection
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.result-item')) {
        this.clearSelection();
      }
    });

    // Global keyboard shortcuts and auto-focus on typing
    document.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.focusSearchInput();
        return;
      }

      // If user starts typing and search input is not focused, focus it automatically
      // Only capture printable characters (letters, numbers, space, etc.)
      const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      
      if (isPrintableKey && document.activeElement !== this.elements.searchInput) {
        // Focus the search input and let the character be typed
        this.elements.searchInput.focus();
        // Clear any existing text first
        this.elements.searchInput.value = '';
      }
    });
  }

  /**
   * Handle search input
   * @param {string} query - Search query
   */
  handleSearch(query) {
    this.state.searchQuery = query.trim();
    this.state.selectedIndex = -1;

    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Debounce search by 150ms
    this.searchTimeout = setTimeout(() => {
      if (this.callbacks.onSearch) {
        this.callbacks.onSearch(this.state.searchQuery);
      }

      // Show/hide shortcuts based on query
      if (this.state.searchQuery === '') {
        this.showShortcuts();
      } else {
        this.hideShortcuts();
      }
    }, 150);
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    const { key } = e;

    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;

      case 'Enter':
        e.preventDefault();
        this.activateSelected();
        break;

      case 'Escape':
        e.preventDefault();
        this.clearSearch();
        break;

      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          this.selectPrevious();
        } else {
          this.selectNext();
        }
        break;
    }
  }

  /**
   * Select next result
   */
  selectNext() {
    if (this.state.results.length === 0) return;

    this.state.selectedIndex = Math.min(
      this.state.selectedIndex + 1,
      this.state.results.length - 1
    );

    this.updateSelection();
  }

  /**
   * Select previous result
   */
  selectPrevious() {
    if (this.state.results.length === 0) return;

    this.state.selectedIndex = Math.max(
      this.state.selectedIndex - 1,
      0
    );

    this.updateSelection();
  }

  /**
   * Update visual selection
   */
  updateSelection() {
    const items = this.elements.resultsList.querySelectorAll('.result-item');
    
    items.forEach((item, index) => {
      if (index === this.state.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.state.selectedIndex = -1;
    this.updateSelection();
  }

  /**
   * Activate selected result
   */
  activateSelected() {
    if (this.state.selectedIndex >= 0 && this.state.selectedIndex < this.state.results.length) {
      const selectedResult = this.state.results[this.state.selectedIndex];
      if (this.callbacks.onSelect) {
        this.callbacks.onSelect(selectedResult.item);
      }
    } else if (this.state.results.length === 0 && this.state.searchQuery.trim() !== '') {
      // No results and user has typed something - trigger Google search
      if (this.callbacks.onEnterWithNoResults) {
        this.callbacks.onEnterWithNoResults(this.state.searchQuery);
      }
    }
  }

  /**
   * Clear search input and results
   */
  clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    this.state.searchQuery = '';
    this.state.selectedIndex = -1;
    this.handleSearch('');
  }

  /**
   * Focus search input
   */
  focusSearchInput() {
    if (this.elements.searchInput) {
      this.elements.searchInput.focus();
      this.elements.searchInput.select();
    }
  }

  /**
   * Render search results
   * @param {Array} results - Search results
   * @param {FuzzyEngine} fuzzyEngine - Fuzzy engine for highlighting
   */
  renderResults(results, fuzzyEngine) {
    this.state.results = results;
    this.state.selectedIndex = results.length > 0 ? 0 : -1;

    // Clear existing results
    this.elements.resultsList.innerHTML = '';

    // Check if this is initial load with no bookmarks (empty state)
    if (results.length === 0 && this.state.searchQuery === '') {
      this.elements.noResults.style.display = 'none';
      this.elements.resultsList.style.display = 'none';
      this.elements.emptyState.style.display = 'block';
      return;
    }

    // Hide empty state
    this.elements.emptyState.style.display = 'none';

    // Show/hide no results message
    if (results.length === 0 && this.state.searchQuery !== '') {
      this.elements.noResults.style.display = 'block';
      this.elements.resultsList.style.display = 'none';
      return;
    } else {
      this.elements.noResults.style.display = 'none';
      this.elements.resultsList.style.display = 'block';
    }

    // Render each result
    results.forEach((result, index) => {
      const item = this.createResultItem(result, fuzzyEngine);
      
      // Add click handler
      item.addEventListener('click', () => {
        if (this.callbacks.onSelect) {
          this.callbacks.onSelect(result.item);
        }
      });

      // Add hover handler
      item.addEventListener('mouseenter', () => {
        this.state.selectedIndex = index;
        this.updateSelection();
      });

      this.elements.resultsList.appendChild(item);
    });

    // Update selection
    this.updateSelection();
  }

  /**
   * Create a result item element
   * @param {Object} result - Search result
   * @param {FuzzyEngine} fuzzyEngine - Fuzzy engine for highlighting
   * @returns {HTMLElement}
   */
  createResultItem(result, fuzzyEngine) {
    const item = document.createElement('div');
    item.className = 'result-item';

    // Icon
    const icon = document.createElement('div');
    icon.className = 'result-icon';
    
    if (result.item.icon && result.item.icon.startsWith('http')) {
      const img = document.createElement('img');
      img.src = result.item.icon;
      img.alt = '';
      img.onerror = () => {
        img.style.display = 'none';
        icon.textContent = this.getTypeEmoji(result.item.type);
      };
      icon.appendChild(img);
    } else {
      icon.textContent = result.item.icon || this.getTypeEmoji(result.item.type);
    }

    // Content (title only)
    const content = document.createElement('div');
    content.className = 'result-content';

    const title = document.createElement('div');
    title.className = 'result-title';
    
    // Highlight matches in title
    if (result.matchedField === 'title' && result.matches.length > 0) {
      title.innerHTML = fuzzyEngine.highlightMatches(result.item.title, result.matches);
    } else {
      title.textContent = result.item.title;
    }

    content.appendChild(title);

    // Assemble left side (icon + content)
    item.appendChild(icon);
    item.appendChild(content);

    // Frequency count (on the far right)
    if (result.item.type === 'bookmark' && result.item.useCount && result.item.useCount > 0) {
      const frequencyCount = document.createElement('div');
      frequencyCount.className = 'frequency-count';
      frequencyCount.textContent = result.item.useCount;
      item.appendChild(frequencyCount);
    }

    // Type badge (before frequency count)
    const type = document.createElement('div');
    type.className = `result-type type-${result.item.type}`;
    type.textContent = result.item.type;
    item.appendChild(type);

    return item;
  }

  /**
   * Get emoji for result type
   * @param {string} type - Result type
   * @returns {string}
   */
  getTypeEmoji(type) {
    const emojis = {
      bookmark: '⭐',
      tab: '📑',
      history: '🕐',
      command: '⚡'
    };
    return emojis[type] || '📄';
  }

  /**
   * Render shortcuts
   * @param {Array} shortcuts - Shortcut items
   */
  renderShortcuts(shortcuts) {
    this.elements.shortcutsGrid.innerHTML = '';

    shortcuts.forEach(shortcut => {
      const item = this.createShortcutItem(shortcut);
      
      item.addEventListener('click', () => {
        if (this.callbacks.onSelect) {
          this.callbacks.onSelect(shortcut);
        }
      });

      this.elements.shortcutsGrid.appendChild(item);
    });
  }

  /**
   * Create a shortcut item element
   * @param {Object} shortcut - Shortcut data
   * @returns {HTMLElement}
   */
  createShortcutItem(shortcut) {
    const item = document.createElement('div');
    item.className = 'shortcut-item';

    const icon = document.createElement('div');
    icon.className = 'shortcut-icon';
    
    if (shortcut.icon && shortcut.icon.startsWith('http')) {
      const img = document.createElement('img');
      img.src = shortcut.icon;
      img.alt = '';
      img.onerror = () => {
        img.style.display = 'none';
        icon.textContent = '🔖';
      };
      icon.appendChild(img);
    } else {
      icon.textContent = shortcut.icon || '🔖';
    }

    const title = document.createElement('div');
    title.className = 'shortcut-title';
    title.textContent = shortcut.title;

    item.appendChild(icon);
    item.appendChild(title);

    // Add usage count badge if available
    if (shortcut.useCount && shortcut.useCount > 0) {
      const usageBadge = document.createElement('div');
      usageBadge.className = 'shortcut-usage-badge';
      usageBadge.innerHTML = `<span class="usage-icon">⭐</span><span class="usage-count">${shortcut.useCount}</span>`;
      item.appendChild(usageBadge);
    }

    return item;
  }

  /**
   * Show shortcuts
   */
  showShortcuts() {
    if (this.elements.shortcutsContainer) {
      this.elements.shortcutsContainer.style.display = 'block';
    }
  }

  /**
   * Hide shortcuts
   */
  hideShortcuts() {
    if (this.elements.shortcutsContainer) {
      this.elements.shortcutsContainer.style.display = 'none';
    }
  }

  /**
   * Show loading overlay
   */
  showLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.classList.add('active');
    }
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.classList.remove('active');
    }
  }

  /**
   * Set callback for search
   * @param {Function} callback
   */
  onSearch(callback) {
    this.callbacks.onSearch = callback;
  }

  /**
   * Set callback for item selection
   * @param {Function} callback
   */
  onSelect(callback) {
    this.callbacks.onSelect = callback;
  }

  /**
   * Set callback for refresh
   * @param {Function} callback
   */
  onRefresh(callback) {
    this.callbacks.onRefresh = callback;
  }

  /**
   * Set callback for Enter key with no results
   * @param {Function} callback
   */
  onEnterWithNoResults(callback) {
    this.callbacks.onEnterWithNoResults = callback;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIController;
}
