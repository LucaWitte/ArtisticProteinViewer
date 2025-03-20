/**
 * ProteinShader.js - Specialized WebGL shader for artistic protein rendering
 * Handles WebGL context loss/restoration and provides high-performance rendering
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class ProteinShader {
  /**
   * Create a new protein shader
   * @param {Object} options - Shader configuration
   * @param {string} options.type - Shader type: 'standard', 'toon', 'glow', or 'outline'
   * @param {Object} options.renderer - Three.js renderer
   */
  constructor(options) {
    this.type = options.type || 'standard';
    this.renderer = options.renderer;
    
    // Track if initialized
    this.initialized = false;
    
    // Handle context loss
    this.contextLost = false;
    
    // Store context loss callback functions
    this.onContextLostCallback = null;
    this.onContextRestoredCallback = null;
    
    // Material cache for reuse
    this.materialCache = new Map();
    
    // Scale down effect strengths for better performance
    this.maxEffectStrength = 0.7;
    
    // Check for mobile/low-end device
    this.isLowEndDevice = this._checkLowEndDevice();
    
    // Bind context handlers
    this._bindContextHandlers();
    
    // Initialize shader
    this._initShader();
    
    // Log initialization
    console.log(`Initialized ${this.type} protein shader`);
  }
  
  /**
   * Check if we're on a low-end device
   * @private
   * @returns {boolean} Whether this is a low-end device
   */
  _checkLowEndDevice() {
    // Use capabilities from CONFIG if available
    if (CONFIG.CAPABILITIES) {
      if (CONFIG.CAPABILITIES.isMobile || CONFIG.CAPABILITIES.isLowEnd) {
        return true;
      }
    }
    
    // Some basic checks as fallback
    return window.navigator.userAgent.indexOf('Mobile') !== -1 || 
           window.navigator.hardwareConcurrency < 4;
  }
  
  /**
   * Bind context loss and restoration handlers
   * @private
   */
  _bindContextHandlers() {
    if (!this.renderer || !this.renderer.domElement) return;
    
    // Handle WebGL context loss
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context was lost in ProteinShader');
      event.preventDefault(); // This is critical for context restoration
      this.contextLost = true;
      
      // Clear material cache
      this.materialCache.clear();
      
      // Notify that context is lost
      if (this.onContextLostCallback) {
        this.onContextLostCallback();
      }
    }, false);
    
    // Handle WebGL context restoration
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored in ProteinShader');
      this.contextLost = false;
      
      // Re-initialize shader
      this._initShader();
      
      // Notify that context is restored
      if (this.onContextRestoredCallback) {
        this.onContextRestoredCallback();
      }
    }, false);
  }
  
  /**
   * Initialize the shader based on type
   * @private
   */
  _initShader() {
    try {
      // Select the most appropriate shader type based on device capability
      if (this.isLowEndDevice) {
        console.log("Using simplified shaders for low-end device");
        // Force simplified shaders on mobile/low-end devices
        if (this.type !== 'standard') {
          console.log(`Requested shader type '${this.type}' downgraded to 'standard' for performance`);
          this.type = 'standard';
        }
      }
      
      // Create shader uniforms
      this.uniforms = {
        effectStrength: { value: 0.5 }, // Start with moderate effect strength
        time: { value: 0.0 }
      };
      
      // Flag as initialized
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing protein shader:', error);
      this.initialized = false;
    }
  }
  
  /**
   * Create a material using this shader
   * @param {Object} options - Material options
   * @param {THREE.Color} options.color - Base color
   * @param {number} options.roughness - Surface roughness
   * @param {number} options.metalness - Surface metalness
   * @param {boolean} options.transparent - Whether material is transparent
   * @param {number} options.opacity - Material opacity
   * @returns {THREE.Material} Three.js material
   */
  getMaterial(options = {}) {
    // Handle context loss
    if (this.contextLost || !this.initialized) {
      console.warn('Cannot create shader material: WebGL context lost or shader not initialized');
      // Fall back to a basic material that doesn't require custom shaders
      return new THREE.MeshLambertMaterial({
        color: options.color || 0xffffff,
        transparent: options.transparent !== undefined ? options.transparent : false,
        opacity: options.opacity !== undefined ? options.opacity : 1.0,
        side: options.side || THREE.FrontSide
      });
    }
    
    try {
      // Create a cache key from the options
      const colorHex = options.color ? options.color.getHexString() : 'ffffff';
      const transparent = options.transparent ? 'T' : 'O';
      const opacity = options.opacity !== undefined ? options.opacity.toFixed(2) : '1.00';
      const side = options.side === THREE.DoubleSide ? 'D' : 'S';
      
      const cacheKey = `${this.type}_${colorHex}_${transparent}_${opacity}_${side}`;
      
      // Check if we have a cached material
      if (this.materialCache.has(cacheKey)) {
        return this.materialCache.get(cacheKey);
      }
      
      // For simplicity and performance reasons, we'll use built-in Three.js materials
      // rather than creating custom shader materials, which can cause context loss
      
      let material;
      
      switch (this.type) {
        case 'toon':
          material = new THREE.MeshToonMaterial({
            color: options.color || new THREE.Color(0xffffff),
            transparent: options.transparent || false,
            opacity: options.opacity !== undefined ? options.opacity : 1.0,
            side: options.side || THREE.FrontSide,
            flatShading: true
          });
          
          // Store effect strength in userData for later updates
          material.userData.effectStrength = 1.0;
          break;
        
        case 'glow':
          // For glow shader, use standard material with emissive
          material = new THREE.MeshStandardMaterial({
            color: options.color || new THREE.Color(0xffffff),
            emissive: options.color || new THREE.Color(0xffffff),
            emissiveIntensity: 0.2, // Low intensity to avoid overwhelming the scene
            roughness: 0.7, // Higher roughness for better performance
            metalness: 0.2, // Lower metalness for better performance
            transparent: options.transparent || false,
            opacity: options.opacity !== undefined ? options.opacity : 1.0,
            side: options.side || THREE.FrontSide,
            flatShading: true
          });
          
          // Store effect strength in userData
          material.userData.effectStrength = 1.0;
          break;
        
        case 'outline':
          // For outline effect, use phong material which is more performant
          material = new THREE.MeshPhongMaterial({
            color: options.color || new THREE.Color(0xffffff),
            transparent: options.transparent || false,
            opacity: options.opacity !== undefined ? options.opacity : 1.0,
            side: options.side || THREE.FrontSide,
            flatShading: true
          });
          
          // Store effect strength in userData
          material.userData.effectStrength = 1.0;
          material.userData.isOutline = true;
          break;
        
        case 'standard':
        default:
          // Use Lambert material for better performance
          material = new THREE.MeshLambertMaterial({
            color: options.color || new THREE.Color(0xffffff),
            transparent: options.transparent || false,
            opacity: options.opacity !== undefined ? options.opacity : 1.0,
            side: options.side || THREE.FrontSide,
            flatShading: true
          });
          
          // Store effect strength in userData
          material.userData.effectStrength = 1.0;
      }
      
      // Cache the material for reuse
      this.materialCache.set(cacheKey, material);
      
      return material;
    } catch (error) {
      console.error('Error creating shader material:', error);
      
      // Fall back to lambert material on error
      return new THREE.MeshLambertMaterial({
        color: options.color || 0xffffff,
        transparent: options.transparent || false,
        opacity: options.opacity !== undefined ? options.opacity : 1.0,
        side: options.side || THREE.FrontSide
      });
    }
  }
  
  /**
   * Update shader effect strength
   * @param {THREE.Material} material - Material to update
   * @param {number} strength - Effect strength (0.0 - 1.0)
   */
  updateEffectStrength(material, strength) {
    if (!material) return;
    
    try {
      // Clamp strength to valid range and apply maximum limit
      const clampedStrength = Math.min(
        this.maxEffectStrength, 
        Math.max(0.0, Math.min(1.0, strength))
      );
      
      // Store effect strength in userData
      material.userData.effectStrength = clampedStrength;
      
      // Update based on material and shader type
      switch (this.type) {
        case 'toon':
          if (material.isMeshToonMaterial) {
            // Nothing to update for toon material - Three.js handles it internally
          }
          break;
          
        case 'glow':
          if (material.isMeshStandardMaterial && material.emissiveIntensity !== undefined) {
            // Scale from 0.1 to 0.5 to avoid too strong effects
            material.emissiveIntensity = 0.1 + clampedStrength * 0.4;
            material.needsUpdate = true;
          }
          break;
          
        case 'outline':
          // For outline, we don't actually do anything here, just store the value
          break;
          
        case 'standard':
        default:
          // Standard doesn't have special effect parameters
          break;
      }
    } catch (error) {
      console.warn('Error updating effect strength:', error);
    }
  }
  
  /**
   * Update shader time for animations
   * @param {number} time - Current time in seconds
   */
  update(time) {
    // Store current time
    if (this.uniforms && this.uniforms.time) {
      this.uniforms.time.value = time;
    }
  }
  
  /**
   * Set callback for context loss
   * @param {Function} callback - Function to call when context is lost
   */
  onLost(callback) {
    this.onContextLostCallback = callback;
  }
  
  /**
   * Set callback for context restoration
   * @param {Function} callback - Function to call when context is restored
   */
  onRestored(callback) {
    this.onContextRestoredCallback = callback;
  }
  
  /**
   * Change shader type
   * @param {string} type - New shader type
   */
  setType(type) {
    // Don't reinitialize if type hasn't changed
    if (this.type === type) return;
    
    // Check if we need to downgrade for low-end devices
    if (this.isLowEndDevice && type !== 'standard') {
      console.log(`Requested shader type '${type}' downgraded to 'standard' for performance`);
      this.type = 'standard';
    } else {
      this.type = type;
    }
    
    // Clear material cache when changing types
    this.materialCache.clear();
    
    // Reinitialize the shader
    this._initShader();
  }
  
  /**
   * Dispose of shader resources
   */
  dispose() {
    // Dispose of all cached materials
    for (const material of this.materialCache.values()) {
      if (material && material.dispose) {
        material.dispose();
      }
    }
    
    // Clear cache
    this.materialCache.clear();
    
    // Remove context handlers
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this._handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this._handleContextRestored);
    }
    
    // Clear references
    this.renderer = null;
    this.uniforms = null;
    this.onContextLostCallback = null;
    this.onContextRestoredCallback = null;
  }
}
