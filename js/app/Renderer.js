/**
 * Renderer.js - Three.js WebGLRenderer configuration and management
 * Handles renderer initialization, sizing, and performance settings
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
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
  }
  
  /**
   * Initialize the WebGLRenderer
   * @private
   */
  _initRenderer() {
    // Create renderer with options
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.container,
      antialias: this.options.antialias !== undefined ? this.options.antialias : CONFIG.RENDERER.ANTIALIAS,
      alpha: this.options.alpha !== undefined ? this.options.alpha : CONFIG.RENDERER.ALPHA,
      logarithmicDepthBuffer: true, // Helps with z-fighting in complex scenes
      preserveDrawingBuffer: true, // Required for screenshot functionality
      powerPreference: 'high-performance'
    });
    
    // Set pixel ratio (limiting for performance on high-DPI displays)
    const pixelRatio = this.options.pixelRatio || CONFIG.RENDERER.PIXEL_RATIO;
    this.renderer.setPixelRatio(Math.min(pixelRatio, CONFIG.RENDERER.MAX_PIXEL_RATIO));
    
    // Set appropriate size
    this._updateSize();
    
    // Configure renderer properties based on config
    this.renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
    this.renderer.shadowMap.type = THREE[CONFIG.RENDERER.SHADOW_MAP_TYPE];
    this.renderer.outputEncoding = THREE[CONFIG.RENDERER.OUTPUT_ENCODING];
    
    // Set tone mapping for better color reproduction
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Store reference to DOM element for events
    this.domElement = this.renderer.domElement;
    
    // Add event listener for window resize
    window.addEventListener('resize', this._handleResize.bind(this));
  }
  
  /**
   * Update renderer size based on container or window size
   * @private
   */
  _updateSize() {
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
    this.renderer.setSize(width, height);
  }
  
  /**
   * Render the scene with the camera
   * @param {THREE.Scene} scene - The scene to render
   * @param {THREE.Camera} camera - The camera to use for rendering
   */
  render(scene, camera) {
    this.renderer.render(scene, camera);
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
  }
  
  /**
   * Dispose of renderer resources
   * Important for memory management when destroying the application
   */
  dispose() {
    window.removeEventListener('resize', this._handleResize);
    
    // Dispose of all resources
    this.renderer.dispose();
    this.renderer = null;
  }
  
  /**
   * Enable or disable shadows
   * @param {boolean} enabled - Whether shadows should be enabled
   */
  setShadowsEnabled(enabled) {
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
