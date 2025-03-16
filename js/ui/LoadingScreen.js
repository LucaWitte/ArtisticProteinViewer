/**
 * LoadingScreen.js - Manages the application loading screen and progress indicators
 * Controls visibility, progress updates, and error messages during initialization
 */

export class LoadingScreen {
  /**
   * Create a new loading screen manager
   * @param {Object} options - Loading screen configuration
   * @param {HTMLElement} options.element - Loading screen container element
   * @param {HTMLElement} options.progressBar - Progress bar element
   * @param {HTMLElement} options.statusElement - Status text element
   */
  constructor(options) {
    this.element = options.element;
    this.progressBar = options.progressBar;
    this.statusElement = options.statusElement;
    
    // Initial state
    this.isVisible = true;
    this.progress = 0;
    this.status = '';
    
    // Make sure the loading screen is visible initially
    this.show();
  }
  
  /**
   * Show the loading screen
   */
  show() {
    this.isVisible = true;
    this.element.style.display = 'flex';
    this.element.classList.remove('error-message');
  }
  
  /**
   * Hide the loading screen
   */
  hide() {
    this.isVisible = false;
    
    // Add fade-out animation
    this.element.style.opacity = '0';
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      this.element.style.display = 'none';
      this.element.style.opacity = '1';
    }, 300);
  }
  
  /**
   * Update the loading progress
   * @param {number} value - Progress value (0-100)
   */
  updateProgress(value) {
    this.progress = Math.max(0, Math.min(100, value));
    this.progressBar.style.width = `${this.progress}%`;
  }
  
  /**
   * Update the status message
   * @param {string} message - Status message to display
   */
  updateStatus(message) {
    this.status = message;
    this.statusElement.textContent = message;
  }
  
  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    this.show();
    this.element.classList.add('error-message');
    
    // Update content
    this.statusElement.textContent = message;
    this.progressBar.style.width = '100%';
    this.progressBar.style.backgroundColor = 'var(--error)';
  }
  
  /**
   * Reset the loading screen to initial state
   */
  reset() {
    this.updateProgress(0);
    this.updateStatus('Initializing...');
    this.progressBar.style.backgroundColor = '';
    this.element.classList.remove('error-message');
  }
}
