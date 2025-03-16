/**
 * WebGLDetector.js - Improved utility for detecting WebGL support and capabilities
 * Provides robust methods to check WebGL compatibility and gracefully handle context issues
 */

import { CONFIG } from '../config.js';

export class WebGLDetector {
  /**
   * Check if WebGL is available on the device
   * @returns {boolean} True if WebGL is supported
   */
  static isWebGLAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) || 
         canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false }))
      );
    } catch (error) {
      console.warn('WebGL detection error:', error);
      return false;
    }
  }
  
  /**
   * Check if WebGL2 is available on the device
   * @returns {boolean} True if WebGL2 is supported
   */
  static isWebGL2Available() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGL2RenderingContext && 
                canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }));
    } catch (error) {
      console.warn('WebGL2 detection error:', error);
      return false;
    }
  }
  
  /**
   * Create a canvas and get WebGL context for testing
   * @private
   * @returns {Object} Object containing context and canvas or null if not available
   */
  static _createTestContext() {
    try {
      // Create a canvas for testing
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      
      // Try to get a WebGL2 context first
      let gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
      let contextVersion = 2;
      
      // Fall back to WebGL 1 if WebGL 2 is not available
      if (!gl) {
        gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) || 
             canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
        contextVersion = 1;
      }
      
      if (!gl) {
        return null;
      }
      
      return { gl, canvas, contextVersion };
    } catch (error) {
      console.warn('Error creating WebGL test context:', error);
      return null;
    }
  }
  
  /**
   * Safely get renderer info without deprecated extensions
   * @private
   * @param {WebGLRenderingContext} gl - WebGL context
   * @returns {Object} Object containing vendor and renderer info
   */
  static _getRendererInfo(gl) {
    const info = {
      vendor: 'Unknown',
      renderer: 'Unknown'
    };
    
    try {
      // Try the standard way first
      info.vendor = gl.getParameter(gl.VENDOR);
      info.renderer = gl.getParameter(gl.RENDERER);
      
      // If we got actual values, return them
      if (info.vendor !== '' && info.renderer !== '') {
        return info;
      }
      
      // Try with WEBGL_debug_renderer_info extension only as fallback
      // Note: This extension is deprecated in some browsers
      try {
        const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugExt) {
          if (info.vendor === '') {
            info.vendor = gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) || 'Unknown';
          }
          if (info.renderer === '') {
            info.renderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || 'Unknown';
          }
        }
      } catch (extError) {
        console.warn('WEBGL_debug_renderer_info extension error (deprecated in some browsers)');
      }
    } catch (error) {
      console.warn('Error getting renderer info:', error);
    }
    
    return info;
  }
  
  /**
   * Safely test for WebGL extension
   * @private
   * @param {WebGLRenderingContext} gl - WebGL context
   * @param {string} extensionName - Name of the extension to test
   * @returns {boolean} True if extension is supported
   */
  static _hasExtension(gl, extensionName) {
    try {
      const ext = gl.getExtension(extensionName);
      return !!ext;
    } catch (error) {
      console.warn(`Error testing for extension ${extensionName}:`, error);
      return false;
    }
  }
  
  /**
   * Detect WebGL capabilities and update the CONFIG object
   * @returns {Object} Object containing WebGL capabilities
   */
  static detectCapabilities() {
    // Default fallback capabilities for when detection fails
    const fallbackCapabilities = {
      webGLVersion: 1,
      vendor: 'Unknown',
      renderer: 'Unknown',
      maxTextureSize: 2048,
      maxCubeMapTextureSize: 2048,
      maxRenderBufferSize: 2048,
      instancedArrays: false,
      floatTextures: false,
      anisotropy: false,
      maxAnisotropy: 1,
      depthTexture: false,
      standardDerivatives: false,
      vertexArrayObject: false,
      sRGBTextures: false,
      isMobile: WebGLDetector.isMobileDevice()
    };
    
    // Get test context
    const test = WebGLDetector._createTestContext();
    
    if (!test || !test.gl) {
      console.warn('WebGL context creation failed, using fallback capabilities');
      WebGLDetector._adjustPerformanceSettings(fallbackCapabilities);
      CONFIG.CAPABILITIES = {
        ...CONFIG.CAPABILITIES,
        ...fallbackCapabilities
      };
      return fallbackCapabilities;
    }
    
    const { gl, contextVersion } = test;
    
    try {
      // Detect capabilities
      const capabilities = {
        webGLVersion: contextVersion,
        ...WebGLDetector._getRendererInfo(gl),
        
        // Get texture size limits
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
        maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
        
        // Check for hardware instancing
        instancedArrays: 
          contextVersion === 2 || 
          WebGLDetector._hasExtension(gl, 'ANGLE_instanced_arrays'),
        
        // Check for float textures
        floatTextures: 
          contextVersion === 2 || 
          WebGLDetector._hasExtension(gl, 'OES_texture_float'),
        
        // Check for anisotropic filtering
        anisotropy: WebGLDetector._hasExtension(gl, 'EXT_texture_filter_anisotropic'),
        
        // Check for depth texture support
        depthTexture: 
          contextVersion === 2 || 
          WebGLDetector._hasExtension(gl, 'WEBGL_depth_texture'),
        
        // Check for standard derivatives (required for normal mapping)
        standardDerivatives: 
          contextVersion === 2 || 
          WebGLDetector._hasExtension(gl, 'OES_standard_derivatives'),
        
        // Check for vertex array objects
        vertexArrayObject: 
          contextVersion === 2 || 
          WebGLDetector._hasExtension(gl, 'OES_vertex_array_object'),
        
        // Check for sRGB texture support
        sRGBTextures: 
          contextVersion === 2 || 
          WebGLDetector._hasExtension(gl, 'EXT_sRGB'),
        
        // Detect mobile/desktop device type
        isMobile: WebGLDetector.isMobileDevice()
      };
      
      // Get max anisotropy if supported
      if (capabilities.anisotropy) {
        const anisotropyExt = 
          gl.getExtension('EXT_texture_filter_anisotropic') || 
          gl.getExtension('MOZ_EXT_texture_filter_anisotropic') || 
          gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        
        if (anisotropyExt) {
          capabilities.maxAnisotropy = gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        } else {
          capabilities.maxAnisotropy = 1;
        }
      } else {
        capabilities.maxAnisotropy = 1;
      }
      
      // Update CONFIG with detected capabilities
      CONFIG.CAPABILITIES = {
        ...CONFIG.CAPABILITIES,
        ...capabilities
      };
      
      // Adjust performance settings based on capabilities
      WebGLDetector._adjustPerformanceSettings(capabilities);
      
      // Clean up
      WebGLDetector._cleanupTestContext(test);
      
      return capabilities;
    } catch (error) {
      console.error('Error detecting WebGL capabilities:', error);
      WebGLDetector._cleanupTestContext(test);
      
      // Use fallback values
      WebGLDetector._adjustPerformanceSettings(fallbackCapabilities);
      CONFIG.CAPABILITIES = {
        ...CONFIG.CAPABILITIES,
        ...fallbackCapabilities
      };
      
      return fallbackCapabilities;
    }
  }
  
  /**
   * Clean up test context resources
   * @private
   * @param {Object} test - Test context object
   */
  static _cleanupTestContext(test) {
    if (!test || !test.gl) return;
    
    try {
      // Try to lose context explicitly to free resources
      const loseExt = test.gl.getExtension('WEBGL_lose_context');
      if (loseExt) {
        loseExt.loseContext();
      }
    } catch (error) {
      console.warn('Error cleaning up test context:', error);
    }
  }
  
  /**
   * Check if the device is a mobile device
   * @returns {boolean} True if the device is likely a mobile device
   */
  static isMobileDevice() {
    // Use multiple detection methods for better accuracy
    const hasTouchScreen = (
      'ontouchstart' in window || 
      navigator.maxTouchPoints > 0 || 
      navigator.msMaxTouchPoints > 0
    );
    
    // Check screen size
    const isSmallScreen = window.innerWidth < 768 || window.innerHeight < 768;
    
    // Check user agent for mobile devices
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'mobile', 'tablet'];
    const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // For tablets, we want to treat them as mobile for rendering purposes
    return (hasTouchScreen && isSmallScreen) || isMobileUserAgent;
  }
  
  /**
   * Adjust performance settings based on detected capabilities
   * @private
   * @param {Object} capabilities - WebGL capabilities
   */
  static _adjustPerformanceSettings(capabilities) {
    // If on mobile or low-end device, reduce quality settings
    if (capabilities.isMobile) {
      CONFIG.RENDERER.ANTIALIAS = window.devicePixelRatio === 1;
      CONFIG.RENDERER.SHADOW_MAP_ENABLED = false;
      CONFIG.RENDERER.PIXEL_RATIO = Math.min(window.devicePixelRatio, 2);
      
      CONFIG.VISUALIZATION.BALL_STICK.SEGMENT_COUNT = 8;
      CONFIG.VISUALIZATION.RIBBON.CURVE_SEGMENTS = 12;
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = 2.0;
    }
    
    // If WebGL version is 1, further reduce settings
    if (capabilities.webGLVersion === 1) {
      CONFIG.RENDERER.ANTIALIAS = false;
      CONFIG.RENDERER.SHADOW_MAP_ENABLED = false;
      CONFIG.VISUALIZATION.BALL_STICK.SEGMENT_COUNT = 6;
      CONFIG.VISUALIZATION.RIBBON.CURVE_SEGMENTS = 8;
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = 2.5;
    }
    
    // If instancing is not supported, disable it
    if (!capabilities.instancedArrays) {
      CONFIG.VISUALIZATION.BALL_STICK.INSTANCING_ENABLED = false;
    }
    
    // If limited texture size, adjust surface resolution
    if (capabilities.maxTextureSize < 4096) {
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = Math.max(2.0, CONFIG.VISUALIZATION.SURFACE.RESOLUTION);
    }
    
    // If renderer is known to have issues, apply specific workarounds
    const rendererLower = capabilities.renderer.toLowerCase();
    
    if (rendererLower.includes('intel') || rendererLower.includes('hd graphics')) {
      // Intel integrated graphics often has issues with complex shaders
      CONFIG.RENDERER.ANTIALIAS = false;
      CONFIG.RENDERER.SHADOW_MAP_ENABLED = false;
      CONFIG.VISUALIZATION.BALL_STICK.INSTANCING_ENABLED = false;
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = 3.0;
    }
  }
  
  /**
   * Setup context loss handling for a renderer
   * @param {THREE.WebGLRenderer} renderer - Three.js renderer to monitor
   * @param {Function} onLost - Callback when context is lost
   * @param {Function} onRestored - Callback when context is restored
   */
  static setupContextHandling(renderer, onLost, onRestored) {
    if (!renderer || !renderer.domElement) return;
    
    // Handle WebGL context loss
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context lost');
      event.preventDefault();
      
      if (onLost) onLost();
    }, false);
    
    // Handle WebGL context restoration
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
      
      if (onRestored) onRestored();
    }, false);
  }
}
