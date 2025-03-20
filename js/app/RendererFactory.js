/**
 * RendererFactory.js - Factory for creating robust Three.js renderers
 * Provides context loss recovery and optimized rendering setup
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { WebGLDetector } from '../utils/WebGLDetector.js';
import { CONFIG } from '../config.js';

export class RendererFactory {
  /**
   * Create a new WebGL renderer with robust error handling
   * @param {Object} options - Renderer configuration
   * @param {HTMLElement} options.container - Container element (canvas)
   * @param {boolean} options.antialias - Enable antialiasing
   * @param {boolean} options.alpha - Enable alpha channel
   * @param {number} options.pixelRatio - Device pixel ratio
   * @param {Function} options.onContextLost - Context loss callback
   * @param {Function} options.onContextRestored - Context restoration callback
   * @returns {THREE.WebGLRenderer} The created renderer
   */
  static createRenderer(options) {
    // Ensure WebGL is available
    if (!WebGLDetector.isWebGLAvailable()) {
      throw new Error('WebGL not supported');
    }
    
    // Detect capabilities - this helps us make appropriate renderer choices
    const capabilities = WebGLDetector.detectCapabilities();
    
    // Set default options with safe fallbacks
    const finalOptions = {
      canvas: options.container,
      antialias: options.antialias !== undefined ? options.antialias : false, // Disable by default for better compatibility
      alpha: options.alpha !== undefined ? options.alpha : CONFIG.RENDERER.ALPHA,
      preserveDrawingBuffer: true, // Required for screenshots
      powerPreference: 'default', // Use 'default' for wider compatibility
      failIfMajorPerformanceCaveat: false, // More permissive
      precision: capabilities.isMobile ? 'mediump' : 'highp', // Lower precision on mobile
      depth: true,
      stencil: false, // Disable stencil buffer if not needed
    };
    
    // Log renderer creation attempt
    console.log("Attempting to create WebGL renderer with options:", {
      ...finalOptions,
      canvas: finalOptions.canvas ? "Canvas element" : "No canvas"
    });
    
    // First try with normal settings
    let renderer = null;
    let success = false;
    
    try {
      renderer = new THREE.WebGLRenderer(finalOptions);
      success = true;
      console.log('WebGL renderer created successfully');
    } catch (error) {
      console.error('Error creating WebGL renderer:', error);
      success = false;
    }
    
    // If first attempt failed, try with minimal settings
    if (!success) {
      console.warn('Attempting to create fallback renderer with reduced settings');
      
      finalOptions.antialias = false;
      finalOptions.logarithmicDepthBuffer = false;
      finalOptions.precision = 'mediump';
      finalOptions.powerPreference = 'default';
      
      try {
        renderer = new THREE.WebGLRenderer(finalOptions);
        console.log('Fallback WebGL renderer created');
        success = true;
      } catch (fallbackError) {
        console.error('Failed to create even fallback renderer:', fallbackError);
        throw new Error('Could not initialize WebGL');
      }
    }
    
    // Configure renderer with safe values if we got this far
    if (success && renderer) {
      RendererFactory._configureRenderer(renderer, options, capabilities);
      
      // Setup context loss handling
      RendererFactory._setupContextHandling(
        renderer,
        () => {
          if (options.onContextLost) options.onContextLost();
        },
        () => {
          // Reconfigure after context restore
          RendererFactory._configureRenderer(renderer, options, capabilities);
          if (options.onContextRestored) options.onContextRestored();
        }
      );
    }
    
    return renderer;
  }
  
  /**
   * Configure renderer settings with safe defaults
   * @private
   * @param {THREE.WebGLRenderer} renderer - Renderer to configure
   * @param {Object} options - Original options
   * @param {Object} capabilities - WebGL capabilities
   */
  static _configureRenderer(renderer, options, capabilities) {
    try {
      // Set pixel ratio (limiting for performance on high-DPI displays)
      const pixelRatio = options.pixelRatio || CONFIG.RENDERER.PIXEL_RATIO;
      const safeDPR = Math.min(pixelRatio, capabilities.isMobile ? 1.0 : 2.0);
      renderer.setPixelRatio(safeDPR);
      
      // Set appropriate size
      if (options.container) {
        const width = options.container.clientWidth || window.innerWidth;
        const height = options.container.clientHeight || window.innerHeight;
        renderer.setSize(width, height, false);
      }
      
      // Configure renderer properties based on capabilities
      // Disable shadows on all devices initially for better performance
      renderer.shadowMap.enabled = false;
      
      // Use a simpler shadow map type for better compatibility
      renderer.shadowMap.type = THREE.PCFShadowMap;
      
      // Set appropriate color space/encoding based on Three.js version
      if ('outputEncoding' in renderer) {
        // Three.js version before 150
        renderer.outputEncoding = THREE.sRGBEncoding;
      } else if ('outputColorSpace' in renderer) {
        // Three.js version 150+
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      
      // Use simpler tone mapping for all devices
      renderer.toneMapping = THREE.ReinhardToneMapping;
      renderer.toneMappingExposure = 1.0;
      
      // Set clear color
      renderer.setClearColor(CONFIG.SCENE.BACKGROUND_COLOR, 1.0);
      
      // Enable auto clearing
      renderer.autoClear = true;
      
      // Disable polygon offset to avoid z-fighting
      renderer.setPolygonOffset(false);
      
      // Set info for debugging
      renderer.info.autoReset = true;
      
      // Force memory release
      renderer.forceContextLoss = function() {
        const contextLossExt = this.getContext().getExtension('WEBGL_lose_context');
        if (contextLossExt) {
          contextLossExt.loseContext();
        }
      };
      
      // Initial render to ensure context is created properly
      try {
        renderer.clear();
      } catch (e) {
        console.warn("Initial clear failed, but continuing:", e);
      }
      
      console.log("WebGL renderer configured successfully");
    } catch (error) {
      console.warn('Error during renderer configuration:', error);
      // Continue despite errors - partial configuration is better than none
    }
  }
  
  /**
   * Setup WebGL context loss/restore handling
   * @private
   * @param {THREE.WebGLRenderer} renderer - Renderer to monitor
   * @param {Function} onLost - Callback when context is lost
   * @param {Function} onRestored - Callback when context is restored
   */
  static _setupContextHandling(renderer, onLost, onRestored) {
    if (!renderer || !renderer.domElement) return;
    
    // Handle WebGL context loss
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context loss detected in RendererFactory');
      event.preventDefault(); // This is critical - without it, context restoration won't happen
      
      // Store timestamp for debugging
      renderer._contextLostTime = Date.now();
      
      if (onLost) onLost();
    }, false);
    
    // Handle WebGL context restoration
    renderer.domElement.addEventListener('webglcontextrestored', (event) => {
      const restorationTime = Date.now();
      const timeSinceLoss = renderer._contextLostTime ? 
        (restorationTime - renderer._contextLostTime) : 'unknown';
      
      console.log(`WebGL context restored in RendererFactory after ${timeSinceLoss}ms`);
      
      // Ensure we create a clean slate
      try {
        // Clear rendering state
        renderer.clear();
        
        // Force reset some internal state
        if (renderer.info) {
          renderer.info.reset();
        }
        
        // Reset render lists
        if (renderer.renderLists) {
          renderer.renderLists.dispose();
        }
      } catch (error) {
        console.warn('Error during context restoration cleanup:', error);
      }
      
      // Small delay before calling the restoration callback
      setTimeout(() => {
        if (onRestored) onRestored();
      }, 100);
    }, false);
    
    // Add experimental context handler using extension
    try {
      const gl = renderer.getContext();
      
      if (gl) {
        const loseContextExt = gl.getExtension('WEBGL_lose_context');
        if (loseContextExt) {
          // Store the extension for potential manual recovery
          renderer._loseContextExt = loseContextExt;
          
          // Add a method to force context restoration
          renderer.forceContextRestoration = function() {
            if (this._loseContextExt) {
              console.log("Manually forcing context restoration");
              this._loseContextExt.restoreContext();
              return true;
            }
            return false;
          };
        }
      }
    } catch (error) {
      console.warn('Unable to get WEBGL_lose_context extension:', error);
    }
  }
  
  /**
   * Create Scene, Camera, and Controls with optimal settings
   * @param {Object} options - Configuration options
   * @param {THREE.WebGLRenderer} options.renderer - WebGL renderer
   * @param {string} options.backgroundColor - Background color
   * @returns {Object} Object containing scene, camera, and controls
   */
  static createRenderingEnvironment(options) {
    // Create scene with safe defaults
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.backgroundColor || CONFIG.SCENE.BACKGROUND_COLOR);
    
    // Create camera
    const aspect = options.renderer.domElement.width / options.renderer.domElement.height || 1;
    const camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA.FOV,
      aspect,
      CONFIG.CAMERA.NEAR,
      CONFIG.CAMERA.FAR
    );
    
    camera.position.set(
      CONFIG.CAMERA.POSITION[0],
      CONFIG.CAMERA.POSITION[1],
      CONFIG.CAMERA.POSITION[2]
    );
    
    // Setup basic lighting
    const lights = RendererFactory._createSimpleLights(scene);
    
    return { scene, camera, lights };
  }
  
  /**
   * Create a simplified lighting setup that works well across devices
   * @private
   * @param {THREE.Scene} scene - Scene to add lights to
   * @returns {Object} Object containing light references
   */
  static _createSimpleLights(scene) {
    // Add ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      CONFIG.SCENE.AMBIENT_LIGHT_INTENSITY
    );
    scene.add(ambientLight);
    
    // Add directional light for shadows and highlights
    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      CONFIG.SCENE.DIRECTIONAL_LIGHT_INTENSITY
    );
    directionalLight.position.set(1, 1, 1).normalize();
    
    // Only enable shadows if configured - default to disabled
    directionalLight.castShadow = false;
    
    scene.add(directionalLight);
    
    // Add a softer fill light from the opposite direction
    const fillLight = new THREE.DirectionalLight(
      0xffffff,
      CONFIG.SCENE.DIRECTIONAL_LIGHT_INTENSITY * 0.4
    );
    fillLight.position.set(-1, -0.5, -1).normalize();
    scene.add(fillLight);
    
    return {
      ambient: ambientLight,
      main: directionalLight,
      fill: fillLight
    };
  }
  
  /**
   * Try to recover a lost context manually
   * @param {THREE.WebGLRenderer} renderer - The renderer to recover
   * @returns {boolean} Whether recovery was attempted
   */
  static tryRecoverContext(renderer) {
    if (!renderer) return false;
    
    console.log("Attempting to recover WebGL context manually");
    
    try {
      // First, check if the context is actually lost
      const gl = renderer.getContext();
      if (!gl || gl.isContextLost()) {
        console.log('Context is lost, attempting recovery...');
        
        // If we have access to the extension, try to restore
        if (renderer._loseContextExt) {
          console.log('Using WEBGL_lose_context to restore');
          renderer._loseContextExt.restoreContext();
          return true;
        }
      } else {
        console.log('Context appears intact, no recovery needed');
      }
    } catch (error) {
      console.warn('Error attempting to recover context:', error);
    }
    
    return false;
  }
  
  /**
   * Determine if a renderer's context is lost
   * @param {THREE.WebGLRenderer} renderer - Renderer to check
   * @returns {boolean} Whether the context is lost
   */
  static isContextLost(renderer) {
    if (!renderer) return true;
    
    try {
      const gl = renderer.getContext();
      return !gl || gl.isContextLost();
    } catch (error) {
      console.warn('Error checking context status:', error);
      return true; // Assume lost if we can't check
    }
  }
  
  /**
   * Create a minimal fallback renderer when full WebGL fails
   * Used for showing basic content when context can't be restored
   * @param {HTMLElement} container - Container element
   * @returns {Object} Minimal renderer object
   */
  static createFallbackRenderer(container) {
    // Create a minimal renderer that just displays a message
    const canvas = container.tagName === 'CANVAS' ? 
      container : document.createElement('canvas');
    
    if (container.tagName !== 'CANVAS') {
      canvas.width = container.clientWidth || 300;
      canvas.height = container.clientHeight || 150;
      container.appendChild(canvas);
    }
    
    // Create a 2D context as a last resort
    const ctx = canvas.getContext('2d');
    
    // Return a minimal renderer-like object
    return {
      domElement: canvas,
      render: function() {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw a message
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WebGL rendering unavailable', canvas.width / 2, canvas.height / 2);
      },
      setSize: function(width, height) {
        canvas.width = width;
        canvas.height = height;
      },
      dispose: function() {
        if (container.tagName !== 'CANVAS' && canvas.parentNode === container) {
          container.removeChild(canvas);
        }
      }
    };
  }
}
