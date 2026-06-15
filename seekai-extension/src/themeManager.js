/**
 * Seekai Theme Manager
 * Handles theme switching and persistence
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'theme-void-core';
    this.themes = [
      {
        id: 'theme-void-core',
        name: 'Void Core',
        description: 'Violet & Cyan - Premium futuristic',
        colors: { primary: '#7C5CFF', secondary: '#22D3EE' }
      },
      {
        id: 'theme-sakura-night',
        name: 'Sakura Night',
        description: 'Pink & Purple - Elegant anime',
        colors: { primary: '#FF69B4', secondary: '#DA70D6' }
      },
      {
        id: 'theme-neon-sky',
        name: 'Neon Sky',
        description: 'Cyan & Blue - Electric dreams',
        colors: { primary: '#22D3EE', secondary: '#60A5FA' }
      },
      {
        id: 'theme-crimson-pulse',
        name: 'Crimson Pulse',
        description: 'Red & Orange - Intense energy',
        colors: { primary: '#EF4444', secondary: '#F97316' }
      },
      {
        id: 'theme-emerald-drift',
        name: 'Emerald Drift',
        description: 'Green & Teal - Natural tech',
        colors: { primary: '#10B981', secondary: '#14B8A6' }
      },
      {
        id: 'theme-moonlight-frost',
        name: 'Moonlight Frost',
        description: 'Blue & Lavender - Cool serenity',
        colors: { primary: '#8B9EFF', secondary: '#A5B4FC' }
      },
      {
        id: 'theme-astral-dream',
        name: 'Astral Dream',
        description: 'Purple & Gold - Mystical luxury',
        colors: { primary: '#A855F7', secondary: '#FCD34D' }
      },
      {
        id: 'theme-obsidian-mono',
        name: 'Obsidian Mono',
        description: 'Black & White - Minimal contrast',
        colors: { primary: '#ffffff', secondary: '#a0a0a0' }
      },
      {
        id: 'theme-rose-pine',
        name: 'Rosé Pine',
        description: 'Warm muted tones - Natural elegance',
        colors: { primary: '#eb6f92', secondary: '#f6c177' }
      }
    ];
  }

  /**
   * Initialize theme manager
   */
  async init() {
    await this.loadTheme();
    this.applyTheme(this.currentTheme);
  }

  /**
   * Load saved theme from storage
   */
  async loadTheme() {
    try {
      const result = await chrome.storage.sync.get({ theme: 'theme-void-core' });
      this.currentTheme = result.theme;
    } catch (error) {
      console.error('Failed to load theme:', error);
      this.currentTheme = 'theme-void-core';
    }
  }

  /**
   * Apply theme to document
   * @param {string} themeId - Theme identifier
   */
  applyTheme(themeId) {
    // Validate theme exists
    const themeExists = this.themes.some(t => t.id === themeId);
    if (!themeExists) {
      console.warn(`Theme ${themeId} not found, using default`);
      themeId = 'theme-void-core';
    }

    // Remove all theme classes
    this.themes.forEach(theme => {
      document.body.classList.remove(theme.id);
    });

    // Add new theme class
    document.body.classList.add(themeId);
    this.currentTheme = themeId;

    // Emit theme change event
    document.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: themeId }
    }));
  }

  /**
   * Set and save theme
   * @param {string} themeId - Theme identifier
   */
  async setTheme(themeId) {
    this.applyTheme(themeId);
    
    try {
      await chrome.storage.sync.set({ theme: themeId });
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }

  /**
   * Get current theme
   * @returns {string} Current theme ID
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Get all available themes
   * @returns {Array} List of theme objects
   */
  getThemes() {
    return this.themes;
  }

  /**
   * Get theme by ID
   * @param {string} themeId - Theme identifier
   * @returns {Object|null} Theme object or null
   */
  getThemeById(themeId) {
    return this.themes.find(t => t.id === themeId) || null;
  }

  /**
   * Cycle to next theme (useful for testing)
   */
  async cycleTheme() {
    const currentIndex = this.themes.findIndex(t => t.id === this.currentTheme);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    const nextTheme = this.themes[nextIndex];
    
    await this.setTheme(nextTheme.id);
  }

  /**
   * Reset to default theme
   */
  async resetTheme() {
    await this.setTheme('theme-void-core');
  }
}

// Create global instance
const themeManager = new ThemeManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    themeManager.init();
  });
} else {
  themeManager.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
