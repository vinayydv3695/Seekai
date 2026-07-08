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
      onEnterWithNoResults: null,
      onPin: null,
      onBookmarkEdit: null,
      onBookmarkDelete: null
    };

    // Store reference to the item being context-menu'd
    this.contextMenuItem = null;

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
    
    // Context Menu & Modal
    this.elements.contextMenu = document.getElementById('bookmarkContextMenu');
    this.elements.contextMenuEdit = document.getElementById('contextMenuEdit');
    this.elements.contextMenuDelete = document.getElementById('contextMenuDelete');
    this.elements.editModal = document.getElementById('bookmarkEditModal');
    this.elements.editTitle = document.getElementById('editBookmarkTitle');
    this.elements.editUrl = document.getElementById('editBookmarkUrl');
    this.elements.editCancel = document.getElementById('editBookmarkCancel');
    this.elements.editDelete = document.getElementById('editBookmarkDelete');
    this.elements.editSave = document.getElementById('editBookmarkSave');

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

      // Aggressive auto-focus hack: If Chrome steals focus to the omnibox,
      // the input will fire a blur event. We immediately steal it back.
      this.elements.searchInput.addEventListener('blur', () => {
        // Do not steal focus if the edit modal is open
        if (this.elements.editModal && this.elements.editModal.style.display === 'flex') {
          return;
        }
        
        setTimeout(() => {
          // Double check if modal opened in the meantime
          if (this.elements.editModal && this.elements.editModal.style.display === 'flex') {
            return;
          }
          this.elements.searchInput.focus();
        }, 50);
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

    // Click outside to clear selection and hide context menu
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.result-item') && !e.target.closest('.bookmark-context-menu')) {
        this.clearSelection();
      }
      
      // Always hide context menu on click
      if (this.elements.contextMenu) {
        this.elements.contextMenu.style.display = 'none';
      }
    });

    // Context Menu Actions
    if (this.elements.contextMenuEdit) {
      this.elements.contextMenuEdit.addEventListener('click', () => {
        if (this.contextMenuItem) {
          this.openEditModal(this.contextMenuItem);
        }
      });
    }

    if (this.elements.contextMenuDelete) {
      this.elements.contextMenuDelete.addEventListener('click', () => {
        if (this.contextMenuItem && this.callbacks.onBookmarkDelete) {
          this.callbacks.onBookmarkDelete(this.contextMenuItem);
        }
      });
    }

    // Modal Actions
    if (this.elements.editCancel) {
      this.elements.editCancel.addEventListener('click', () => {
        this.closeEditModal();
      });
    }

    if (this.elements.editDelete) {
      this.elements.editDelete.addEventListener('click', () => {
        if (this.contextMenuItem && this.callbacks.onBookmarkDelete) {
          this.callbacks.onBookmarkDelete(this.contextMenuItem);
          this.closeEditModal();
        }
      });
    }

    if (this.elements.editSave) {
      this.elements.editSave.addEventListener('click', () => {
        if (this.contextMenuItem && this.callbacks.onBookmarkEdit) {
          const newTitle = this.elements.editTitle.value;
          const newUrl = this.elements.editUrl.value;
          this.callbacks.onBookmarkEdit(this.contextMenuItem, newTitle, newUrl);
          this.closeEditModal();
        }
      });
    }

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
      
      // Check if the user is already focused on an input field (like the edit modal)
      const isTypingInInput = document.activeElement && 
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

      if (isPrintableKey && !isTypingInInput && document.activeElement !== this.elements.searchInput) {
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
      case 'Backspace':
        if (this.elements.searchInput.value === '' && this.state.searchMode) {
          e.preventDefault();
          this.setSearchMode(null);
        }
        break;
      case 'k':
      case 'K':
        if (e.ctrlKey) {
          e.preventDefault();
          this.selectPrevious();
        }
        break;
      case 'j':
      case 'J':
        if (e.ctrlKey) {
          e.preventDefault();
          this.selectNext();
        }
        break;
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
        this.activateSelected(e.shiftKey);
        break;

      case 'Escape':
        e.preventDefault();
        this.clearSearch();
        break;

      case 'Tab':
        e.preventDefault();
        
        // Check if we can enter a search mode
        if (this.state.selectedIndex >= 0 && this.state.selectedIndex < this.state.results.length) {
          const selectedItem = this.state.results[this.state.selectedIndex].item;
          if (selectedItem.url && selectedItem.url.includes('youtube.com')) {
            this.setSearchMode('youtube');
            return;
          }
        }
        
        if (e.shiftKey) {
          this.selectPrevious();
        } else {
          this.selectNext();
        }
        break;
    }
  }

  /**
   * Enter a specific search mode (e.g. YouTube)
   */
  setSearchMode(engine) {
    this.state.searchMode = engine;
    const pill = document.getElementById('searchModePill');
    if (pill) {
      if (engine === 'youtube') {
        pill.textContent = 'YouTube';
        pill.style.background = '#ff0000';
        pill.style.display = 'inline-flex';
      } else if (engine === 'wikipedia') {
        pill.textContent = 'Wikipedia';
        pill.style.background = '#555';
        pill.style.display = 'inline-flex';
      } else {
        pill.style.display = 'none';
      }
    }
    
    // Clear input but keep focus
    this.elements.searchInput.value = '';
    this.state.searchQuery = '';
    this.elements.searchInput.focus();
    this.clearResults();
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
   * @param {boolean} forceWebSearch - If true, bypass local results and force web search
   */
  activateSelected(forceWebSearch = false) {
    if (forceWebSearch && this.state.searchQuery.trim() !== '') {
      if (this.callbacks.onEnterWithNoResults) {
        this.callbacks.onEnterWithNoResults(this.state.searchQuery);
      }
      return;
    }

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
      // Fallback for Firefox which heavily prioritizes the address bar on new tabs
      setTimeout(() => {
        this.elements.searchInput.focus();
      }, 150);
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

      // Add a staggered animation delay to create a smooth cascading effect
      item.style.animationDelay = `${index * 0.08}s`;

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
    
    if (result.item.icon && (result.item.icon.startsWith('http') || result.item.icon.startsWith('chrome-extension://'))) {
      const img = document.createElement('img');
      img.src = result.item.icon;
      img.alt = '';
      img.onerror = () => {
        img.style.display = 'none';
        icon.innerHTML = this.getTypeEmoji(result.item.type);
      };
      icon.appendChild(img);
    } else {
      icon.innerHTML = result.item.icon || this.getTypeEmoji(result.item.type);
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

    // Edit Button (only for bookmarks)
    if (result.item.type === 'bookmark') {
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.title = 'Edit Bookmark';
      // Pencil SVG
      editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditModal(result.item);
      });
      item.appendChild(editBtn);
    }

    // Pin Button
    const pinBtn = document.createElement('button');
    pinBtn.className = `pin-btn ${result.isPinned ? 'pinned' : ''}`;
    pinBtn.title = result.isPinned ? 'Unpin' : 'Pin to top';
    pinBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
    
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent item selection
      if (this.callbacks.onPin) {
        this.callbacks.onPin(result.item);
      }
    });
    
    item.appendChild(pinBtn);

    // Frequency count (on the far right)
    if (result.item.type === 'bookmark' && result.item.useCount && result.item.useCount > 0) {
      const frequencyCount = document.createElement('div');
      frequencyCount.className = 'frequency-count';
      frequencyCount.textContent = result.item.useCount;
      item.appendChild(frequencyCount);
    }

    // Right Click Context Menu (Bookmarks only)
    if (result.item.type === 'bookmark') {
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        this.contextMenuItem = result.item;
        
        if (this.elements.contextMenu) {
          this.elements.contextMenu.style.display = 'flex';
          
          // Ensure menu doesn't go offscreen
          let x = e.clientX;
          let y = e.clientY;
          
          if (x + 180 > window.innerWidth) x -= 180;
          if (y + 100 > window.innerHeight) y -= 100;
          
          this.elements.contextMenu.style.left = `${x}px`;
          this.elements.contextMenu.style.top = `${y}px`;
        }
      });
    }

    return item;
  }

  /**
   * Open the Edit Bookmark Modal
   */
  openEditModal(item) {
    if (!this.elements.editModal) return;
    this.contextMenuItem = item;
    this.elements.editTitle.value = item.title || '';
    this.elements.editUrl.value = item.url || '';
    this.elements.editModal.style.display = 'flex';
    this.elements.editTitle.focus();
  }

  /**
   * Close the Edit Bookmark Modal
   */
  closeEditModal() {
    if (!this.elements.editModal) return;
    this.elements.editModal.style.display = 'none';
    this.focusSearchInput();
  }

  /**
   * Get emoji for result type
   * @param {string} type - Result type
   * @returns {string}
   */
  getTypeEmoji(type) {
    const emojis = {
      bookmark: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>',
      tab: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>',
      history: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      command: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>'
    };
    return emojis[type] || '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
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
   * Set onEnterWithNoResults callback
   * @param {Function} callback
   */
  onEnterWithNoResults(callback) {
    this.callbacks.onEnterWithNoResults = callback;
  }

  /**
   * Set onPin callback
   */
  onPin(callback) {
    this.callbacks.onPin = callback;
  }

  /**
   * Set onBookmarkEdit callback
   */
  onBookmarkEdit(callback) {
    this.callbacks.onBookmarkEdit = callback;
  }

  /**
   * Set onBookmarkDelete callback
   */
  onBookmarkDelete(callback) {
    this.callbacks.onBookmarkDelete = callback;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIController;
}
