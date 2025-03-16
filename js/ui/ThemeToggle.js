/**
 * ThemeToggle.js - Manages theme switching between light and dark modes
 * Handles user preferences, local storage persistence, and theme application
 */

export class ThemeToggle {
  /**
   * Create a new theme toggle manager
   * @param {Object} options - Theme toggle configuration
   * @param {HTMLElement} options.element - Theme toggle button element
   */
  constructor(options) {
    this.element = options.element;
    
    // Get initial theme from HTML attribute
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    
    // Initialize state
    this.theme = currentTheme;
    
    // Bind events
    this._bindEvents();
  }
  
  /**
   * Bind event listeners
   * @private
   */
  _bindEvents() {
    // Toggle theme when the button is clicked
    this.element.addEventListener('click', () => {
      this.toggleTheme();
    });
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
      if (!localStorage.getItem('theme')) {
        // Only auto-change if user hasn't explicitly set a preference
        const newTheme = event.matches ? 'dark' : 'light';
        this._setTheme(newTheme);
      }
    });
  }
  
  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this._setTheme(newTheme);
    
    // Save preference to localStorage
    localStorage.setItem('theme', newTheme);
    
    // Notify about theme change
    this._notifyThemeChange(newTheme);
  }
  
  /**
   * Set a specific theme
   * @private
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  _setTheme(theme) {
    // Update state
    this.theme = theme;
    
    // Apply theme to HTML
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update aria-label for accessibility
    const label = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    this.element.setAttribute('aria-label', label);
  }
  
  /**
   * Notify subscribers about theme change
   * @private
   * @param {string} theme - New theme name
   */
  _notifyThemeChange(theme) {
    // Create and dispatch custom event
    const event = new CustomEvent('themechange', {
      detail: { theme }
    });
    
    window.dispatchEvent(event);
  }
  
  /**
   * Get current theme
   * @returns {string} Current theme ('light' or 'dark')
   */
  getTheme() {
    return this.theme;
  }
  
  /**
   * Check if dark theme is active
   * @returns {boolean} True if dark theme is active
   */
  isDarkTheme() {
    return this.theme === 'dark';
  }
}
