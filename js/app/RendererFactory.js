/**
 * RendererFactory.js - Factory for creating robust Three.js renderers
 * Provides context loss recovery and optimized rendering setup
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { WebGLDetector } from '../utils/WebGLDetector.js';
import { CONFIG } from '../config.js';
import { PDBLoader } from '../loaders/PDBLoader.js';

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
    
    // Detect capabilities
    const capabilities = WebGLDetector.detectCapabilities();
    
    // Set default options
    const finalOptions = {
      canvas: options.container,
      antialias: options.antialias !== undefined ? options.antialias : CONFIG.RENDERER.ANTIALIAS,
      alpha: options.alpha !== undefined ? options.alpha : CONFIG.RENDERER.ALPHA,
      preserveDrawingBuffer: true, // Required for screenshots
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false // More permissive
    };
    
    // Add log depth buffer for WebGL2
    if (capabilities.webGLVersion === 2) {
      finalOptions.logarithmicDepthBuffer = true;
    }
    
    // Create renderer with error handling
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer(finalOptions);
      console.log('WebGL renderer created successfully');
    } catch (error) {
      console.error('Error creating WebGL renderer:', error);
      
      // Try again with simpler settings
      console.warn('Attempting to create fallback renderer with reduced settings');
      
      finalOptions.antialias = false;
      finalOptions.logarithmicDepthBuffer = false;
      
      try {
        renderer = new THREE.WebGLRenderer(finalOptions);
        console.log('Fallback WebGL renderer created');
      } catch (fallbackError) {
        console.error('Failed to create even fallback renderer:', fallbackError);
        throw new Error('Could not initialize WebGL');
      }
    }
    
    // Configure renderer
    RendererFactory._configureRenderer(renderer, options, capabilities);
    
    // Setup context loss handling
    WebGLDetector.setupContextHandling(
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
    
    return renderer;
  }
  
  /**
   * Configure renderer settings
   * @private
   * @param {THREE.WebGLRenderer} renderer - Renderer to configure
   * @param {Object} options - Original options
   * @param {Object} capabilities - WebGL capabilities
   */
  static _configureRenderer(renderer, options, capabilities) {
    // Set pixel ratio (limiting for performance on high-DPI displays)
    const pixelRatio = options.pixelRatio || CONFIG.RENDERER.PIXEL_RATIO;
    renderer.setPixelRatio(Math.min(pixelRatio, CONFIG.RENDERER.MAX_PIXEL_RATIO));
    
    // Set appropriate size
    if (options.container) {
      const width = options.container.clientWidth || window.innerWidth;
      const height = options.container.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
    }
    
    // Configure renderer properties based on config and capabilities
    renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED && capabilities.webGLVersion === 2;
    renderer.shadowMap.type = THREE[CONFIG.RENDERER.SHADOW_MAP_TYPE];
    
    // Set appropriate color space based on Three.js version
    if ('outputEncoding' in renderer) {
      // Three.js version before 150
      renderer.outputEncoding = THREE[CONFIG.RENDERER.OUTPUT_ENCODING];
    } else if ('outputColorSpace' in renderer) {
      // Three.js version 150+
      renderer.outputColorSpace = 'sRGBEncoding' === CONFIG.RENDERER.OUTPUT_ENCODING ? 
        THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    }
    
    // Only enable tone mapping if capabilities support it
    if (capabilities.standardDerivatives) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
    }
    
    // Set clear color
    renderer.setClearColor(CONFIG.SCENE.BACKGROUND_COLOR, 1.0);
    
    // Set info
    renderer.info.autoReset = true;
    
    // Configure WebGL context (if available in this version of THREE.js)
    if (renderer.getContext) {
      const gl = renderer.getContext();
      
      if (gl) {
        // Some browsers perform better with this hint
        if (gl.hint && gl.FRAGMENT_SHADER_DERIVATIVE_HINT) {
          gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
        }
      }
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
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(options.backgroundColor || CONFIG.SCENE.BACKGROUND_COLOR);
    
    // Add fog if enabled in config
    if (CONFIG.SCENE.FOG_ENABLED) {
      scene.fog = new THREE.Fog(
        CONFIG.SCENE.FOG_COLOR,
        CONFIG.SCENE.FOG_NEAR,
        CONFIG.SCENE.FOG_FAR
      );
    }
    
    // Create camera
    const aspect = options.renderer.domElement.width / options.renderer.domElement.height;
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
    
    // Setup lighting
    const lights = RendererFactory._createLights(scene);
    
    return { scene, camera, lights };
  }
  
  /**
   * Create standard lighting setup
   * @private
   * @param {THREE.Scene} scene - Scene to add lights to
   * @returns {Object} Object containing light references
   */
  static _createLights(scene) {
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
    directionalLight.castShadow = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
    
    // Configure shadow properties if enabled
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
    
    // Add a subtle rim light
    const rimLight = new THREE.HemisphereLight(
      0xffffff, // Sky color
      0x303030, // Ground color
      0.3        // Intensity
    );
    scene.add(rimLight);
    
    return {
      ambient: ambientLight,
      main: directionalLight,
      fill: fillLight,
      rim: rimLight
    };
  }
}
