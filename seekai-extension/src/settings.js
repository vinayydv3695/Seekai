/**
 * Seekai Settings Page
 * Manages user preferences and custom commands
 */

class SettingsManager {
  constructor() {
    this.settings = {
      enableBookmarks: true,
      enableTabs: false,
      enableCommands: true,
      theme: 'theme-void-core',
      defaultSearchEngine: 'google',
      maxResults: '10',
      zenMode: false,
      customCommands: []
    };

    this.elements = {};
  }

  /**
   * Initialize settings manager
   */
  async init() {
    this.cacheElements();
    await this.loadSettings();
    this.renderSettings();
    this.attachEventListeners();
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      toggleBookmarks: document.getElementById('toggleBookmarks'),
      toggleTabs: document.getElementById('toggleTabs'),
      toggleCommands: document.getElementById('toggleCommands'),
      toggleZenMode: document.getElementById('toggleZenMode'),
      themeSelect: document.getElementById('themeSelect'),
      searchEngineSelect: document.getElementById('searchEngineSelect'),
      maxResultsSelect: document.getElementById('maxResultsSelect'),
      themePreview: document.getElementById('themePreview'),
      customCommandsList: document.getElementById('customCommandsList'),
      addCommandBtn: document.getElementById('addCommandBtn'),
      saveBtn: document.getElementById('saveBtn'),
      resetBtn: document.getElementById('resetBtn')
    };
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        enableBookmarks: true,
        enableTabs: false,
        enableCommands: true,
        theme: 'theme-void-core',
        defaultSearchEngine: 'google',
        maxResults: '10',
        zenMode: false,
        customCommands: []
      });
      
      this.settings = result;
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showToast('Failed to load settings');
    }
  }

  /**
   * Render settings to UI
   */
  renderSettings() {
    // Toggle switches
    this.setToggleState(this.elements.toggleBookmarks, this.settings.enableBookmarks);
    this.setToggleState(this.elements.toggleTabs, this.settings.enableTabs);
    this.setToggleState(this.elements.toggleCommands, this.settings.enableCommands);
    this.setToggleState(this.elements.toggleZenMode, this.settings.zenMode);
    
    if (this.elements.themeSelect) {
      this.elements.themeSelect.value = this.settings.theme || 'theme-void-core';
    }

    if (this.elements.searchEngineSelect) {
      this.elements.searchEngineSelect.value = this.settings.defaultSearchEngine || 'google';
    }

    if (this.elements.maxResultsSelect) {
      this.elements.maxResultsSelect.value = this.settings.maxResults || '10';
    }

    // Render theme selector
    this.renderThemeSelector();

    // Custom commands
    this.renderCustomCommands();
  }

  /**
   * Set toggle switch state
   * @param {HTMLElement} element - Toggle element
   * @param {boolean} active - Active state
   */
  setToggleState(element, active) {
    if (element) {
      if (active) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    }
  }

  /**
   * Render theme selector
   */
  renderThemeSelector() {
    // Populate theme dropdown
    const themes = themeManager.getThemes();
    if (!this.elements.themeSelect) return;
    this.elements.themeSelect.innerHTML = '';
    
    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      if (theme.id === this.settings.theme) {
        option.selected = true;
      }
      this.elements.themeSelect.appendChild(option);
    });

    // Render preview
    this.renderThemePreview(this.settings.theme);
  }

  /**
   * Render theme preview
   * @param {string} themeId - Theme ID
   */
  renderThemePreview(themeId) {
    const theme = themeManager.getThemeById(themeId);
    if (!theme || !this.elements.themePreview) return;

    this.elements.themePreview.innerHTML = `
      <div class="theme-preview-color" style="background: ${theme.colors.primary};"></div>
      <div class="theme-preview-color" style="background: ${theme.colors.secondary};"></div>
      <div class="theme-preview-info">
        <div class="theme-preview-name">${theme.name}</div>
        <div class="theme-preview-desc">${theme.description}</div>
      </div>
    `;
  }

  /**
   * Render custom commands
   */
  renderCustomCommands() {
    if (!this.elements.customCommandsList) return;
    this.elements.customCommandsList.innerHTML = '';

    this.settings.customCommands.forEach((command, index) => {
      const commandItem = this.createCommandItem(command, index);
      this.elements.customCommandsList.appendChild(commandItem);
    });
  }

  /**
   * Create custom command item
   * @param {Object} command - Command data
   * @param {number} index - Command index
   * @returns {HTMLElement}
   */
  createCommandItem(command, index) {
    const item = document.createElement('div');
    item.className = 'command-item';
    
    // Check if this is a new bookmark (no bookmarkId) or existing
    const isNew = !command.bookmarkId;
    const buttonText = isNew ? 'Add' : 'Delete';
    const buttonClass = isNew ? 'add-btn' : 'delete-btn';
    
    item.innerHTML = `
      <input type="text" placeholder="Bookmark name (e.g., GitHub)" value="${command.title || ''}" data-field="title" data-index="${index}">
      <input type="text" placeholder="URL (e.g., https://github.com)" value="${command.url || ''}" data-field="url" data-index="${index}">
      <button class="${buttonClass}" data-index="${index}">${buttonText}</button>
    `;

    // Add input listeners
    const inputs = item.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        this.settings.customCommands[idx][field] = e.target.value;
      });
    });

    // Add button listener
    const actionBtn = item.querySelector('button');
    actionBtn.addEventListener('click', async () => {
      if (isNew) {
        // Add button - save immediately
        await this.addBookmarkImmediately(index);
      } else {
        // Delete button - remove bookmark
        this.deleteCommand(index);
      }
    });

    return item;
  }

  /**
   * Add bookmark immediately (for new bookmarks)
   * @param {number} index - Command index
   */
  async addBookmarkImmediately(index) {
    const command = this.settings.customCommands[index];
    
    if (!command.title || !command.url) {
      this.showToast('Please fill in both name and URL');
      return;
    }

    try {
      // Check for duplicates
      const duplicate = await this.checkDuplicateBookmark(command.url);
      if (duplicate) {
        const confirmAdd = confirm(
          `A bookmark with this URL already exists:\n\n"${duplicate.title}"\n\nDo you want to add it anyway?`
        );
        if (!confirmAdd) {
          return;
        }
      }

      const seekaiFolder = await this.ensureSeekaiFolder();
      
      // Create new bookmark
      const bookmark = await chrome.bookmarks.create({
        parentId: seekaiFolder.id,
        title: command.title,
        url: command.url
      });
      
      command.bookmarkId = bookmark.id;
      
      // Save to storage
      await chrome.storage.sync.set(this.settings);
      
      this.showToast('Bookmark added successfully!');
      
      // Re-render to show delete button instead
      this.renderCustomCommands();
      
    } catch (error) {
      console.error('Failed to add bookmark:', error);
      this.showToast('Failed to add bookmark');
    }
  }

  /**
   * Check if bookmark URL already exists
   * @param {string} url - URL to check
   * @returns {Promise<Object|null>} Existing bookmark or null
   */
  async checkDuplicateBookmark(url) {
    try {
      // Normalize URL (remove trailing slash, etc.)
      const normalizedUrl = url.trim().replace(/\/$/, '');
      
      // Search all bookmarks for this URL
      const results = await chrome.bookmarks.search({ url: normalizedUrl });
      
      // Also check with trailing slash
      const resultsWithSlash = await chrome.bookmarks.search({ url: normalizedUrl + '/' });
      
      const allResults = [...results, ...resultsWithSlash];
      
      return allResults.length > 0 ? allResults[0] : null;
    } catch (error) {
      console.error('Failed to check for duplicates:', error);
      return null;
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Toggle switches
    if (this.elements.toggleBookmarks) {
      this.elements.toggleBookmarks.addEventListener('click', () => {
        this.settings.enableBookmarks = !this.settings.enableBookmarks;
        this.setToggleState(this.elements.toggleBookmarks, this.settings.enableBookmarks);
        this.saveSettings();
      });
    }

    if (this.elements.toggleTabs) {
      this.elements.toggleTabs.addEventListener('click', () => {
        this.settings.enableTabs = !this.settings.enableTabs;
        this.setToggleState(this.elements.toggleTabs, this.settings.enableTabs);
        this.saveSettings();
      });
    }

    if (this.elements.toggleCommands) {
      this.elements.toggleCommands.addEventListener('click', () => {
        this.settings.enableCommands = !this.settings.enableCommands;
        this.setToggleState(this.elements.toggleCommands, this.settings.enableCommands);
        this.saveSettings();
      });
    }

    // Toggle Zen Mode
    if (this.elements.toggleZenMode) {
      this.elements.toggleZenMode.addEventListener('click', () => {
        this.settings.zenMode = !this.settings.zenMode;
        this.setToggleState(this.elements.toggleZenMode, this.settings.zenMode);
        this.saveSettings();
      });
    }

    // Theme selector
    this.elements.themeSelect.addEventListener('change', async (e) => {
      const themeId = e.target.value;
      this.settings.theme = themeId;
      await themeManager.setTheme(themeId);
      this.renderThemePreview(themeId);
      this.saveSettings();
    });

    // Dropdown listeners
    if (this.elements.searchEngineSelect) {
      this.elements.searchEngineSelect.addEventListener('change', (e) => {
        this.settings.defaultSearchEngine = e.target.value;
        this.saveSettings();
      });
    }

    if (this.elements.maxResultsSelect) {
      this.elements.maxResultsSelect.addEventListener('change', (e) => {
        this.settings.maxResults = e.target.value;
        this.saveSettings();
      });
    }

    // Add command button
    if (this.elements.addCommandBtn) {
      this.elements.addCommandBtn.addEventListener('click', () => {
        this.addCommand();
      });
    }

    // Save button
    this.elements.saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset button
    this.elements.resetBtn.addEventListener('click', () => {
      this.resetSettings();
    });
  }

  /**
   * Add new custom command
   */
  addCommand() {
    const newCommand = {
      id: `cmd_${Date.now()}`,
      title: '',
      url: ''
    };

    this.settings.customCommands.push(newCommand);
    this.renderCustomCommands();
  }

  /**
   * Delete custom command
   * @param {number} index - Command index
   */
  async deleteCommand(index) {
    // Check if this was saved as a real bookmark and delete it
    const command = this.settings.customCommands[index];
    if (command.bookmarkId) {
      try {
        await chrome.bookmarks.remove(command.bookmarkId);
      } catch (error) {
        console.error('Failed to delete bookmark:', error);
      }
    }
    
    this.settings.customCommands.splice(index, 1);
    this.renderCustomCommands();
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      // Filter out empty commands
      const validCommands = this.settings.customCommands.filter(
        cmd => cmd.title && cmd.url
      );

      // Only update existing bookmarks (new ones are added via Add button)
      if (validCommands.some(cmd => cmd.bookmarkId)) {
        const seekaiFolder = await this.ensureSeekaiFolder();
        
        for (const cmd of validCommands) {
          if (cmd.bookmarkId) {
            // Update existing bookmark
            try {
              await chrome.bookmarks.update(cmd.bookmarkId, {
                title: cmd.title,
                url: cmd.url
              });
            } catch (error) {
              console.error('Failed to update bookmark:', error);
            }
          }
        }
      }

      this.settings.customCommands = validCommands;

      // Save to storage
      await chrome.storage.sync.set(this.settings);

      this.showToast('Settings saved successfully!');

      // Reload after 1 second to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('Failed to save settings');
    }
  }

  /**
   * Ensure Seekai bookmarks folder exists
   * @returns {Promise<Object>} Folder bookmark object
   */
  async ensureSeekaiFolder() {
    try {
      // Search for existing Seekai folder
      const bookmarks = await chrome.bookmarks.search({ title: 'Seekai Bookmarks' });
      const folder = bookmarks.find(b => !b.url); // Folders don't have URLs
      
      if (folder) {
        return folder;
      }

      // Create new folder in the bookmarks bar
      const bookmarksBar = await chrome.bookmarks.getTree();
      const bookmarksBarId = bookmarksBar[0].children[0].id; // Usually "1"

      return await chrome.bookmarks.create({
        parentId: bookmarksBarId,
        title: 'Seekai Bookmarks'
      });
    } catch (error) {
      console.error('Failed to create Seekai folder:', error);
      // Fallback: use bookmarks bar root
      return { id: '1' };
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      const defaults = {
        enableBookmarks: true,
        enableHistory: false,
        enableTabs: false,
        enableCommands: true,
        accentColor: 'cyan',
        customCommands: []
      };

      this.settings = defaults;
      await chrome.storage.sync.set(defaults);

      this.renderSettings();
      this.showToast('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showToast('Failed to reset settings');
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize settings manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new SettingsManager();
    manager.init();
  });
} else {
  const manager = new SettingsManager();
  manager.init();
}
