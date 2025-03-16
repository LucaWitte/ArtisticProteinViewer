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
      antialias: options.antialias !== undefined ? options.antialias : CONFIG.RENDERER.ANTIALIAS,
      alpha: options.alpha !== undefined ? options.alpha : CONFIG.RENDERER.ALPHA,
      preserveDrawingBuffer: true, // Required for screenshots
      powerPreference: 'default', // Use 'default' for wider compatibility
      failIfMajorPerformanceCaveat: false, // More permissive
      precision: capabilities.isMobile ? 'mediump' : 'highp', // Lower precision on mobile
    };
    
    // Only add log depth buffer for WebGL2 to avoid compatibility issues
    if (capabilities.webGLVersion === 2) {
      finalOptions.logarithmicDepthBuffer = true;
    }
    
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
      const safeDPR = Math.min(pixelRatio, CONFIG.RENDERER.MAX_PIXEL_RATIO);
      renderer.setPixelRatio(safeDPR);
      
      // Set appropriate size
      if (options.container) {
        const width = options.container.clientWidth || window.innerWidth;
        const height = options.container.clientHeight || window.innerHeight;
        renderer.setSize(width, height, false);
      }
      
      // Configure renderer properties based on capabilities
      // Only enable shadows on more powerful devices
      renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED && 
                                 !capabilities.isMobile &&
                                 capabilities.webGLVersion === 2;
      
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
      
      // Only enable tone mapping if device is capable
      if (!capabilities.isMobile) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
      } else {
        // Simpler tone mapping for mobile
        renderer.toneMapping = THREE.ReinhardToneMapping;
        renderer.toneMappingExposure = 1.0;
      }
      
      // Set clear color
      renderer.setClearColor(CONFIG.SCENE.BACKGROUND_COLOR, 1.0);
      
      // Enable auto clearing
      renderer.autoClear = true;
      
      // Set info for debugging
      renderer.info.autoReset = true;
      
      // Initial render to ensure context is created properly
      renderer.clear();
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
      console.warn('WebGL context lost in RendererFactory');
      // This is critical - without it, context restoration won't happen
      event.preventDefault(); 
      
      if (onLost) onLost();
    }, false);
    
    // Handle WebGL context restoration
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored in RendererFactory');
      
      // Ensure we create a clean slate
      try {
        // Clear rendering state
        renderer.clear();
        
        // Force reset some internal state - non-standard but helps
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
      
      if (onRestored) onRestored();
    }, false);
    
    // Add experimental context handler using extension
    try {
      const gl = renderer.getContext();
      
      if (gl) {
        const loseContextExt = gl.getExtension('WEBGL_lose_context');
        if (loseContextExt) {
          // Store the extension for potential manual recovery
          renderer._loseContextExt = loseContextExt;
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
    
    // Only enable shadows if configured
    directionalLight.castShadow = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
    
    // Use modest shadow map size for performance
    if (CONFIG.RENDERER.SHADOW_MAP_ENABLED) {
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 500;
      directionalLight.shadow.bias = -0.0001;
    }
    
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
      }
    } catch (error) {
      console.warn('Error attempting to recover context:', error);
    }
    
    return false;
  }
}
