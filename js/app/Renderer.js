/**
 * Renderer.js - Three.js WebGLRenderer configuration and management
 * Handles renderer initialization, sizing, and performance settings
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WebGLDetector } from '../utils/WebGLDetector.js';

export class Renderer {
  /**
   * Create a new Three.js renderer
   * @param {Object} options - Renderer configuration options
   * @param {HTMLElement} options.container - Container element for the renderer
   * @param {boolean} [options.antialias=true] - Whether to enable antialiasing
   * @param {boolean} [options.alpha=true] - Whether to use an alpha buffer
   * @param {number} [options.pixelRatio=1] - Device pixel ratio to use
   */
  constructor(options) {
    this.options = options;
    this.container = options.container;
    
    // Detect WebGL capabilities
    WebGLDetector.detectCapabilities();
    
    // Initialize the renderer
    this._initRenderer();
    
    // Bind context lost/restore handlers
    this._setupContextHandlers();
  }
  
  /**
   * Initialize the WebGLRenderer
   * @private
   */
  _initRenderer() {
    try {
      // Create renderer with options
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.container,
        antialias: this.options.antialias !== undefined ? this.options.antialias : CONFIG.RENDERER.ANTIALIAS,
        alpha: this.options.alpha !== undefined ? this.options.alpha : CONFIG.RENDERER.ALPHA,
        logarithmicDepthBuffer: true, // Helps with z-fighting in complex scenes
        preserveDrawingBuffer: true, // Required for screenshot functionality
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false // More permissive about performance issues
      });
      
      // Set pixel ratio (limiting for performance on high-DPI displays)
      const pixelRatio = this.options.pixelRatio || CONFIG.RENDERER.PIXEL_RATIO;
      this.renderer.setPixelRatio(Math.min(pixelRatio, CONFIG.RENDERER.MAX_PIXEL_RATIO));
      
      // Set appropriate size
      this._updateSize();
      
      // Configure renderer properties based on config
      this.renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
      this.renderer.shadowMap.type = THREE[CONFIG.RENDERER.SHADOW_MAP_TYPE];
      
      // Use the appropriate encoding method based on Three.js version
      if (this.renderer.outputEncoding !== undefined) {
        // Three.js version before 150
        this.renderer.outputEncoding = THREE[CONFIG.RENDERER.OUTPUT_ENCODING];
      } else if (this.renderer.outputColorSpace !== undefined) {
        // Three.js version 150+
        this.renderer.outputColorSpace = 'sRGBEncoding' === CONFIG.RENDERER.OUTPUT_ENCODING ? 
          THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      }
      
      // Set tone mapping for better color reproduction
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      
      // Store reference to DOM element for events
      this.domElement = this.renderer.domElement;
      
      // Add event listener for window resize
      window.addEventListener('resize', this._handleResize.bind(this));
      
      console.log("WebGL renderer initialized successfully");
    } catch (error) {
      console.error("Error initializing WebGL renderer:", error);
      
      // Try to create a simpler renderer as fallback
      try {
        console.warn("Attempting to create fallback renderer with minimal options");
        this.renderer = new THREE.WebGLRenderer({ 
          canvas: this.container,
          antialias: false,
          alpha: true,
          preserveDrawingBuffer: true
        });
        
        // Set minimal configuration
        this.renderer.setPixelRatio(1);
        this._updateSize();
        this.domElement = this.renderer.domElement;
        window.addEventListener('resize', this._handleResize.bind(this));
        
        console.log("Fallback WebGL renderer initialized");
      } catch (fallbackError) {
        console.error("Failed to create even fallback renderer:", fallbackError);
        // Show a WebGL error message to the user
        this._showWebGLError();
      }
    }
  }
  
  /**
   * Setup WebGL context lost/restore handlers
   * @private
   */
  _setupContextHandlers() {
    if (!this.renderer || !this.domElement) return;
    
    // Handle WebGL context loss
    this.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('WebGL context lost. Attempting to restore...');
      this.contextLost = true;
      
      // Notify application about context loss
      if (this.onContextLost) {
        this.onContextLost();
      }
    }, false);
    
    // Handle WebGL context restoration
    this.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored.');
      this.contextLost = false;
      
      // Reinitialize renderer
      this._updateSize();
      
      // Notify application about context restoration
      if (this.onContextRestored) {
        this.onContextRestored();
      }
    }, false);
  }
  
  /**
   * Show a WebGL error message
   * @private
   */
  _showWebGLError() {
    const webglErrorElement = document.getElementById('webgl-error');
    if (webglErrorElement) {
      webglErrorElement.style.display = 'flex';
    }
  }
  
  /**
   * Update renderer size based on container or window size
   * @private
   */
  _updateSize() {
    if (!this.renderer) return;
    
    // Get the container's size or use window size
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    
    // Set renderer size
    this.renderer.setSize(width, height);
  }
  
  /**
   * Handle window resize event
   * @private
   */
  _handleResize() {
    this._updateSize();
  }
  
  /**
   * Set renderer size
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   */
  setSize(width, height) {
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }
  
  /**
   * Render the scene with the camera
   * @param {THREE.Scene} scene - The scene to render
   * @param {THREE.Camera} camera - The camera to use for rendering
   */
  render(scene, camera) {
    if (!this.renderer || this.contextLost) return;
    
    try {
      // Store last scene and camera for potential screenshots
      this.lastScene = scene;
      this.lastCamera = camera;
      
      // Render the scene
      this.renderer.render(scene, camera);
    } catch (error) {
      console.error("Error during rendering:", error);
      // Don't throw further to prevent crashing the app
    }
  }
  
  /**
   * Capture a screenshot of the current view
   * @param {Object} [options] - Screenshot options
   * @param {number} [options.width] - Width of the screenshot
   * @param {number} [options.height] - Height of the screenshot
   * @param {number} [options.scale=1] - Scale factor for the screenshot
   * @returns {string} Data URL of the screenshot
   */
  takeScreenshot(options = {}) {
    if (!this.renderer || this.contextLost) {
      console.warn("Cannot take screenshot: renderer unavailable or context lost");
      return null;
    }
    
    try {
      const currSize = {
        width: this.renderer.domElement.width,
        height: this.renderer.domElement.height
      };
      
      // If dimensions are specified, temporarily resize
      if (options.width && options.height) {
        this.renderer.setSize(options.width, options.height, false);
      } else if (options.scale && options.scale !== 1) {
        const newWidth = currSize.width * options.scale;
        const newHeight = currSize.height * options.scale;
        this.renderer.setSize(newWidth, newHeight, false);
      }
      
      // Redraw the scene at the new size
      this.renderer.render(this.lastScene, this.lastCamera);
      
      // Get the screenshot as a data URL
      const dataURL = this.renderer.domElement.toDataURL('image/png');
      
      // Restore original size
      this.renderer.setSize(currSize.width, currSize.height, false);
      
      // Re-render at original size
      this.renderer.render(this.lastScene, this.lastCamera);
      
      return dataURL;
    } catch (error) {
      console.error("Error taking screenshot:", error);
      return null;
    }
  }
  
  /**
   * Register context lost callback
   * @param {Function} callback - Function to call when context is lost
   */
  onLost(callback) {
    this.onContextLost = callback;
  }
  
  /**
   * Register context restored callback
   * @param {Function} callback - Function to call when context is restored
   */
  onRestored(callback) {
    this.onContextRestored = callback;
  }
  
  /**
   * Dispose of renderer resources
   * Important for memory management when destroying the application
   */
  dispose() {
    window.removeEventListener('resize', this._handleResize);
    
    // Dispose of all resources if renderer exists
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
  
  /**
   * Enable or disable shadows
   * @param {boolean} enabled - Whether shadows should be enabled
   */
  setShadowsEnabled(enabled) {
    if (!this.renderer) return;
    
    this.renderer.shadowMap.enabled = enabled;
    // Force shadow map update
    this.renderer.shadowMap.needsUpdate = true;
  }
  
  /**
   * Get the WebGLRenderer instance
   * @returns {THREE.WebGLRenderer} The Three.js renderer
   */
  get instance() {
    return this.renderer;
  }
}
