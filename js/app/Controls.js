/**
 * Controls.js - Camera controls configuration and management
 * Implements OrbitControls for interactive camera movement
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import { CONFIG } from '../config.js';

export class Controls {
  /**
   * Create camera controls for interactive viewing
   * @param {Object} options - Controls configuration options
   * @param {THREE.Camera} options.camera - Camera to control
   * @param {HTMLElement} options.domElement - DOM element for event listening
   * @param {boolean} [options.enableDamping=true] - Enable smooth damping of controls
   * @param {number} [options.dampingFactor=0.1] - Damping inertia factor
   * @param {number} [options.rotateSpeed=1.0] - Rotation speed
   * @param {number} [options.zoomSpeed=1.2] - Zoom speed
   * @param {number} [options.panSpeed=0.8] - Pan speed
   * @param {number} [options.minDistance=1] - Minimum zoom distance
   * @param {number} [options.maxDistance=1000] - Maximum zoom distance
   */
  constructor(options) {
    this.options = {
      enableDamping: options.enableDamping !== undefined ? options.enableDamping : CONFIG.CONTROLS.ENABLE_DAMPING,
      dampingFactor: options.dampingFactor !== undefined ? options.dampingFactor : CONFIG.CONTROLS.DAMPING_FACTOR,
      rotateSpeed: options.rotateSpeed !== undefined ? options.rotateSpeed : CONFIG.CONTROLS.ROTATE_SPEED,
      zoomSpeed: options.zoomSpeed !== undefined ? options.zoomSpeed : CONFIG.CONTROLS.ZOOM_SPEED,
      panSpeed: options.panSpeed !== undefined ? options.panSpeed : CONFIG.CONTROLS.PAN_SPEED,
      minDistance: options.minDistance !== undefined ? options.minDistance : CONFIG.CONTROLS.MIN_DISTANCE,
      maxDistance: options.maxDistance !== undefined ? options.maxDistance : CONFIG.CONTROLS.MAX_DISTANCE
    };
    
    // Store references
    this.camera = options.camera;
    this.domElement = options.domElement;
    
    // Create controls
    this._createControls();
    
    // Track control state
    this.state = {
      isRotating: false,
      isPanning: false,
      isZooming: false,
      isInteracting: false
    };
  }
  
  /**
   * Create OrbitControls for camera movement
   * @private
   */
  _createControls() {
    // Create OrbitControls
    this.controls = new OrbitControls(this.camera, this.domElement);
    
    // Apply configuration options
    this.controls.enableDamping = this.options.enableDamping;
    this.controls.dampingFactor = this.options.dampingFactor;
    
    this.controls.rotateSpeed = this.options.rotateSpeed;
    this.controls.zoomSpeed = this.options.zoomSpeed;
    this.controls.panSpeed = this.options.panSpeed;
    
    this.controls.minDistance = this.options.minDistance;
    this.controls.maxDistance = this.options.maxDistance;
    
    // Set limits for vertical rotation
    this.controls.maxPolarAngle = CONFIG.CONTROLS.MAX_POLAR_ANGLE;
    
    // Enable standard control methods
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    
    // Setup listeners for detecting control state
    this._setupStateListeners();
    
    // Set initial target to origin
    this.controls.target.set(0, 0, 0);
    
    // Setup throttling for performance during interactions
    this._setupThrottling();
  }
  
  /**
   * Setup event listeners to track control state
   * Useful for performance optimizations during interaction
   * @private
   */
  _setupStateListeners() {
    // Track rotation state
    this.domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0) { // Left mouse button
        this.state.isRotating = true;
        this._notifyInteractionStart('rotate');
      } else if (event.button === 2) { // Right mouse button
        this.state.isPanning = true;
        this._notifyInteractionStart('pan');
      }
    });
    
    // Track zoom state
    this.domElement.addEventListener('wheel', () => {
      this.state.isZooming = true;
      this._notifyInteractionStart('zoom');
      
      // Clear the zoom state after a delay
      clearTimeout(this._zoomTimer);
      this._zoomTimer = setTimeout(() => {
        this.state.isZooming = false;
        this._notifyInteractionEnd('zoom');
      }, 200);
    });
    
    // Track interaction end
    window.addEventListener('mouseup', () => {
      if (this.state.isRotating) {
        this.state.isRotating = false;
        this._notifyInteractionEnd('rotate');
      }
      
      if (this.state.isPanning) {
        this.state.isPanning = false;
        this._notifyInteractionEnd('pan');
      }
    });
    
    // Track touch interactions
    this.domElement.addEventListener('touchstart', () => {
      this.state.isInteracting = true;
      this._notifyInteractionStart('touch');
    });
    
    this.domElement.addEventListener('touchend', () => {
      this.state.isInteracting = false;
      this._notifyInteractionEnd('touch');
    });
    
    // Handle control change event
    this.controls.addEventListener('change', () => {
      this._handleControlChange();
    });
  }
  
  /**
   * Setup performance throttling during interactions
   * @private
   */
  _setupThrottling() {
    // Only implement if throttling is enabled in config
    if (!CONFIG.PERFORMANCE.THROTTLE_RENDERING_ON_ROTATE) {
      return;
    }
    
    this.performanceMode = false;
    
    // Method to enter performance mode
    this.enterPerformanceMode = () => {
      if (!this.performanceMode) {
        this.performanceMode = true;
        if (this.onPerformanceModeChange) {
          this.onPerformanceModeChange(true, CONFIG.PERFORMANCE.THROTTLE_FACTOR);
        }
      }
    };
    
    // Method to exit performance mode
    this.exitPerformanceMode = () => {
      if (this.performanceMode) {
        this.performanceMode = false;
        if (this.onPerformanceModeChange) {
          this.onPerformanceModeChange(false, 1.0);
        }
      }
    };
    
    // Set up timers for delayed exit from performance mode
    this._performanceModeTimer = null;
  }
  
  /**
   * Handle control change event
   * @private
   */
  _handleControlChange() {
    // Enter performance mode during interaction
    if (CONFIG.PERFORMANCE.THROTTLE_RENDERING_ON_ROTATE && 
        (this.state.isRotating || this.state.isPanning || this.state.isZooming)) {
      this.enterPerformanceMode();
      
      // Reset exit timer
      clearTimeout(this._performanceModeTimer);
      this._performanceModeTimer = setTimeout(() => {
        this.exitPerformanceMode();
      }, 500); // Exit performance mode after 500ms of inactivity
    }
  }
  
  /**
   * Notify subscribers when user interaction starts
   * @private
   * @param {string} type - Type of interaction ('rotate', 'pan', 'zoom', 'touch')
   */
  _notifyInteractionStart(type) {
    if (this.onInteractionStart) {
      this.onInteractionStart(type);
    }
    
    // Enter performance mode if throttling is enabled
    if (CONFIG.PERFORMANCE.THROTTLE_RENDERING_ON_ROTATE) {
      this.enterPerformanceMode();
    }
  }
  
  /**
   * Notify subscribers when user interaction ends
   * @private
   * @param {string} type - Type of interaction ('rotate', 'pan', 'zoom', 'touch')
   */
  _notifyInteractionEnd(type) {
    if (this.onInteractionEnd) {
      this.onInteractionEnd(type);
    }
    
    // Exit performance mode with a delay to ensure smooth transition
    if (CONFIG.PERFORMANCE.THROTTLE_RENDERING_ON_ROTATE) {
      clearTimeout(this._performanceModeTimer);
      this._performanceModeTimer = setTimeout(() => {
        this.exitPerformanceMode();
      }, 200);
    }
  }
  
  /**
   * Update controls on animation frame
   * Must be called in the animation loop for smooth damping
   */
  update() {
    if (this.controls.enabled) {
      this.controls.update();
    }
  }
  
  /**
   * Set control target (the point the camera orbits around)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   */
  setTarget(x, y, z) {
    this.controls.target.set(x, y, z);
    this.controls.update();
  }
  
  /**
   * Reset camera position and target to properly view a bounding box
   * @param {THREE.Box3} boundingBox - Bounding box to fit in view
   * @param {number} [padding=1.2] - Padding factor (1.0 = no padding)
   */
  resetPosition(boundingBox, padding = 1.2) {
    if (!boundingBox) {
      console.warn('Cannot reset position with undefined bounding box');
      return;
    }
    
    // Get the center of the bounding box
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    // Set the orbit target to the center of the bounding box
    this.setTarget(center.x, center.y, center.z);
    
    // Calculate the size of the bounding box
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Calculate distance from the camera to the object
    const fov = this.camera.fov * (Math.PI / 180);
    let distance = (maxDim / 2) / Math.tan(fov / 2);
    distance *= padding;
    
    // Position the camera along the positive z-axis
    const offset = new THREE.Vector3(0, 0, distance);
    offset.add(center);
    
    // Set camera position
    this.camera.position.copy(offset);
    this.camera.lookAt(center);
    
    // Update controls
    this.controls.update();
  }
  
  /**
   * Enable or disable auto-rotation of the camera
   * @param {boolean} enabled - Whether auto-rotation should be enabled
   * @param {number} [speed=2.0] - Rotation speed in radians per second
   */
  setAutoRotate(enabled, speed = 2.0) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = speed;
  }
  
  /**
   * Get current control state
   * @returns {Object} Object containing state flags (isRotating, isPanning, isZooming)
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Set control options
   * @param {Object} options - Control options to set
   */
  setOptions(options) {
    // Apply each option to the controls if it exists
    Object.keys(options).forEach(key => {
      if (this.controls[key] !== undefined) {
        this.controls[key] = options[key];
      }
    });
    
    // Force an update
    this.controls.update();
  }
  
  /**
   * Enable or disable controls
   * @param {boolean} enabled - Whether controls should be enabled
   */
  setEnabled(enabled) {
    this.controls.enabled = enabled;
  }
  
  /**
   * Register callback for interaction start
   * @param {Function} callback - Function to call when interaction starts
   */
  onStart(callback) {
    this.onInteractionStart = callback;
  }
  
  /**
   * Register callback for interaction end
   * @param {Function} callback - Function to call when interaction ends
   */
  onEnd(callback) {
    this.onInteractionEnd = callback;
  }
  
  /**
   * Register callback for performance mode changes
   * @param {Function} callback - Function to call when performance mode changes
   */
  onPerfModeChange(callback) {
    this.onPerformanceModeChange = callback;
  }
  
  /**
   * Dispose of controls resources
   * Important for memory management when destroying the application
   */
  dispose() {
    // Remove all event listeners
    this.controls.dispose();
    
    // Clear timers
    clearTimeout(this._zoomTimer);
    clearTimeout(this._performanceModeTimer);
    
    // Clear references
    this.onInteractionStart = null;
    this.onInteractionEnd = null;
    this.onPerformanceModeChange = null;
    this.controls = null;
  }
}
