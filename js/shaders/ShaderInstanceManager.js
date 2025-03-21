/**
 * ShaderInstanceManager.js - Manages shader instances across protein visualizations
 * Centralizes shader creation, configuration, and updates to reduce memory usage
 * and improve performance when using the same shader across multiple visualizations
 */

import { ArtisticProteinShader } from './ArtisticProteinShader.js';

export class ShaderInstanceManager {
  /**
   * Create a new shader instance manager
   * @param {Object} options - Configuration options
   * @param {THREE.WebGLRenderer} options.renderer - Three.js renderer
   */
  constructor(options) {
    this.renderer = options.renderer;
    
    // Store shader instances by type
    this.shaders = new Map();
    
    // Active shader instances in use
    this.activeShaders = new Set();
    
    // Global effect strength (0.0 - 1.0)
    this.globalEffectStrength = 0.5;
    
    // Monitor shader usage for analytics
    this.usageStats = {};
    
    // Set up context loss handling
    this._setupContextLossHandling();
  }
  
  /**
   * Setup WebGL context loss/restore handling
   * @private
   */
  _setupContextLossHandling() {
    if (!this.renderer || !this.renderer.domElement) return;
    
    // Track context loss state
    this.contextLost = false;
    
    // Handle WebGL context loss
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context lost in ShaderInstanceManager');
      event.preventDefault();
      
      this.contextLost = true;
      
      // Notify all shaders about context loss
      this.shaders.forEach(shader => {
        if (shader.onContextLost) {
          shader.onContextLost();
        }
      });
    }, false);
    
    // Handle WebGL context restoration
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored in ShaderInstanceManager');
      this.contextLost = false;
      
      // Notify all shaders about context restoration
      this.shaders.forEach(shader => {
        if (shader.onContextRestored) {
          shader.onContextRestored();
        }
      });
    }, false);
  }
  
  /**
   * Get a shader instance by type, creating a new one if necessary
   * @param {string} type - Shader type
   * @param {Object} [options] - Additional shader options
   * @returns {ArtisticProteinShader} Shader instance
   */
  getShader(type, options = {}) {
    const shaderType = type || 'standard';
    
    // Check if we already have this shader type
    if (this.shaders.has(shaderType)) {
      const shader = this.shaders.get(shaderType);
      
      // Track shader usage
      this._trackShaderUsage(shaderType);
      
      // Add to active shaders
      this.activeShaders.add(shader);
      
      return shader;
    }
    
    // Create a new shader
    try {
      const shader = new ArtisticProteinShader({
        type: shaderType,
        renderer: this.renderer,
        useConservativeSettings: options.useConservativeSettings !== false
      });
      
      // Store for reuse
      this.shaders.set(shaderType, shader);
      
      // Track shader usage
      this._trackShaderUsage(shaderType);
      
      // Add to active shaders
      this.activeShaders.add(shader);
      
      // Set initial effect strength
      shader.updateGlobalParameters({
        effectStrength: this.globalEffectStrength
      });
      
      // Setup context handling through our central system
      shader.onLost(() => {
        console.log(`Shader ${shaderType} handling context loss`);
      });
      
      shader.onRestored(() => {
        console.log(`Shader ${shaderType} handling context restoration`);
      });
      
      return shader;
    } catch (error) {
      console.error(`Error creating shader type ${shaderType}:`, error);
      
      // Return standard shader as fallback
      return this.getShader('standard');
    }
  }
  
  /**
   * Track shader usage for analytics
   * @private
   * @param {string} type - Shader type
   */
  _trackShaderUsage(type) {
    if (!this.usageStats[type]) {
      this.usageStats[type] = {
        created: new Date(),
        useCount: 0
      };
    }
    
    this.usageStats[type].useCount++;
    this.usageStats[type].lastUsed = new Date();
  }
  
  /**
   * Update global effect strength for all shaders
   * @param {number} strength - Effect strength (0.0 - 1.0)
   */
  setGlobalEffectStrength(strength) {
    // Store the global strength
    this.globalEffectStrength = Math.max(0.0, Math.min(1.0, strength));
    
    // Update all active shaders
    this.activeShaders.forEach(shader => {
      shader.updateGlobalParameters({
        effectStrength: this.globalEffectStrength
      });
    });
  }
  
  /**
   * Update global shader parameters for all shaders of specific type
   * @param {string} type - Shader type to update (or 'all' for all types)
   * @param {Object} params - Parameters to update
   */
  updateShaderParameters(type, params) {
    if (type === 'all') {
      // Update all shaders
      this.shaders.forEach(shader => {
        shader.updateGlobalParameters(params);
      });
    } else if (this.shaders.has(type)) {
      // Update specific shader type
      this.shaders.get(type).updateGlobalParameters(params);
    }
  }
  
  /**
   * Release a shader instance (mark as inactive)
   * @param {ArtisticProteinShader} shader - Shader instance to release
   */
  releaseShader(shader) {
    if (shader) {
      this.activeShaders.delete(shader);
    }
  }
  
  /**
   * Get a list of available shader types
   * @returns {Array} Array of shader type names
   */
  getAvailableShaderTypes() {
    return [
      'standard',
      'toon',
      'glow',
      'outline',
      'xray',
      'ambient'
    ];
  }
  
  /**
   * Get performance statistics for shaders
   * @returns {Object} Statistics about shader usage
   */
  getStats() {
    const stats = {
      totalShaders: this.shaders.size,
      activeShaders: this.activeShaders.size,
      shaderTypes: Object.fromEntries(this.shaders.keys().map(key => [key, true])),
      usage: this.usageStats
    };
    
    return stats;
  }
  
  /**
   * Update shader animation time
   * @param {number} time - Current time in seconds
   */
  update(time) {
    // Update only active shaders for performance
    this.activeShaders.forEach(shader => {
      shader.update(time);
    });
  }
  
  /**
   * Check if a specific shader type is supported
   * @param {string} type - Shader type to check
   * @returns {boolean} Whether the shader type is supported
   */
  isShaderSupported(type) {
    // All shader types are technically supported, but some might
    // perform better than others depending on hardware
    return this.getAvailableShaderTypes().includes(type);
  }
  
  /**
   * Dispose of all shader resources
   */
  dispose() {
    // Dispose of all shaders
    this.shaders.forEach(shader => {
      if (shader.dispose) {
        shader.dispose();
      }
    });
    
    // Clear shader maps
    this.shaders.clear();
    this.activeShaders.clear();
    
    // Clear usage stats
    this.usageStats = {};
    
    // Remove context listeners (handled by renderer disposal)
    
    // Clear references
    this.renderer = null;
  }
}
