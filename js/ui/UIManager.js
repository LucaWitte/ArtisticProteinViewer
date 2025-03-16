/**
 * UIManager.js - Manages the application UI controls and user interactions
 * Centralizes event handling for the control panel and other UI elements
 */

import { CONFIG } from '../config.js';

export class UIManager {
  /**
   * Create a new UI manager
   * @param {Object} options - UI configuration and callbacks
   * @param {NodeList} options.styleButtons - Visualization style buttons
   * @param {HTMLElement} options.colorSchemeSelect - Color scheme select element
   * @param {HTMLElement} options.backgroundColorInput - Background color input element
   * @param {HTMLElement} options.shaderEffectSelect - Shader effect select element
   * @param {HTMLElement} options.effectStrengthSlider - Effect strength slider element
   * @param {HTMLElement} options.exportButton - Export button element
   * @param {HTMLElement} options.fileUploadButton - File upload button element
   * @param {HTMLElement} options.fileInput - File input element
   * @param {Function} options.onStyleChange - Style change callback
   * @param {Function} options.onColorSchemeChange - Color scheme change callback
   * @param {Function} options.onBackgroundColorChange - Background color change callback
   * @param {Function} options.onShaderEffectChange - Shader effect change callback
   * @param {Function} options.onEffectStrengthChange - Effect strength change callback
   * @param {Function} options.onExport - Export callback
   * @param {Function} options.onFileUpload - File upload callback
   */
  constructor(options) {
    this.options = options;
    
    // Store references to UI elements
    this.styleButtons = options.styleButtons;
    this.colorSchemeSelect = options.colorSchemeSelect;
    this.backgroundColorInput = options.backgroundColorInput;
    this.shaderEffectSelect = options.shaderEffectSelect;
    this.effectStrengthSlider = options.effectStrengthSlider;
    this.exportButton = options.exportButton;
    this.fileUploadButton = options.fileUploadButton;
    this.fileInput = options.fileInput;
    
    // Store current values
    this.currentStyle = CONFIG.VISUALIZATION.DEFAULT_STYLE;
    this.currentColorScheme = CONFIG.VISUALIZATION.DEFAULT_COLOR_SCHEME;
    this.currentBackgroundColor = CONFIG.SCENE.BACKGROUND_COLOR;
    this.currentShaderEffect = CONFIG.VISUALIZATION.DEFAULT_SHADER;
    this.currentEffectStrength = CONFIG.VISUALIZATION.DEFAULT_EFFECT_STRENGTH;
    
    // Initialize UI
    this._initializeUI();
    
    // Bind events
    this._bindEvents();
  }
  
  /**
   * Initialize UI elements with defaults
   * @private
   */
  _initializeUI() {
    // Set default style button
    this.styleButtons.forEach(button => {
      const style = button.getAttribute('data-style');
      if (style === this.currentStyle) {
        button.classList.add('active');
      }
    });
    
    // Set default color scheme
    this.colorSchemeSelect.value = this.currentColorScheme;
    
    // Set default background color
    this.backgroundColorInput.value = this.currentBackgroundColor;
    
    // Set default shader effect
    this.shaderEffectSelect.value = this.currentShaderEffect;
    
    // Set default effect strength
    this.effectStrengthSlider.value = this.currentEffectStrength;
  }
  
  /**
   * Bind event listeners
   * @private
   */
  _bindEvents() {
    // Style buttons
    this.styleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const style = button.getAttribute('data-style');
        this._setActiveStyle(style);
      });
    });
    
    // Color scheme select
    this.colorSchemeSelect.addEventListener('change', () => {
      this.currentColorScheme = this.colorSchemeSelect.value;
      if (this.options.onColorSchemeChange) {
        this.options.onColorSchemeChange(this.currentColorScheme);
      }
    });
    
    // Background color input
    this.backgroundColorInput.addEventListener('input', () => {
      this.currentBackgroundColor = this.backgroundColorInput.value;
      if (this.options.onBackgroundColorChange) {
        this.options.onBackgroundColorChange(this.currentBackgroundColor);
      }
    });
    
    // Shader effect select
    this.shaderEffectSelect.addEventListener('change', () => {
      this.currentShaderEffect = this.shaderEffectSelect.value;
      if (this.options.onShaderEffectChange) {
        this.options.onShaderEffectChange(this.currentShaderEffect);
      }
    });
    
    // Effect strength slider
    this.effectStrengthSlider.addEventListener('input', () => {
      this.currentEffectStrength = parseInt(this.effectStrengthSlider.value);
      if (this.options.onEffectStrengthChange) {
        this.options.onEffectStrengthChange(this.currentEffectStrength);
      }
    });
    
    // Export button
    this.exportButton.addEventListener('click', () => {
      if (this.options.onExport) {
        this.options.onExport();
      }
    });
    
    // File upload
    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file && this.options.onFileUpload) {
        this.options.onFileUpload(file);
      }
    });
    
    this.fileUploadButton.addEventListener('click', () => {
      this.fileInput.click();
    });
  }
  
  /**
   * Set the active visualization style
   * @private
   * @param {string} style - Style to activate
   */
  _setActiveStyle(style) {
    // Update current style
    this.currentStyle = style;
    
    // Update UI
    this.styleButtons.forEach(button => {
      const buttonStyle = button.getAttribute('data-style');
      button.classList.toggle('active', buttonStyle === style);
    });
    
    // Call callback
    if (this.options.onStyleChange) {
      this.options.onStyleChange(style);
    }
  }
  
  /**
   * Get current color scheme
   * @returns {string} Current color scheme
   */
  getColorScheme() {
    return this.currentColorScheme;
  }
  
  /**
   * Get current effect strength
   * @returns {number} Current effect strength (0-100)
   */
  getEffectStrength() {
    return this.currentEffectStrength;
  }
  
  /**
   * Enable or disable UI elements
   * @param {boolean} enabled - Whether UI should be enabled
   */
  setEnabled(enabled) {
    const elements = [
      ...this.styleButtons,
      this.colorSchemeSelect,
      this.backgroundColorInput,
      this.shaderEffectSelect,
      this.effectStrengthSlider,
      this.exportButton,
      this.fileUploadButton
    ];
    
    elements.forEach(element => {
      element.disabled = !enabled;
    });
  }
}
