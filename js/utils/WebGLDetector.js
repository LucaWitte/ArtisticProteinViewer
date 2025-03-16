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
      
      // Try both webgl and experimental-webgl contexts
      // Set failIfMajorPerformanceCaveat to false to work on more devices
      let gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
      
      if (!gl) {
        gl = canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
      }
      
      // Clean up
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      
      return !!gl;
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
      const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
      
      // Clean up
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      
      return !!gl;
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
      // Create a minimum size canvas to reduce memory impact
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      
      // Try to get a WebGL2 context first
      let gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
      let contextVersion = 2;
      
      // Fall back to WebGL 1 if WebGL 2 is not available
      if (!gl) {
        gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
        contextVersion = 1;
        
        // Try experimental WebGL as a last resort
        if (!gl) {
          gl = canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
          contextVersion = 1;
        }
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
      info.vendor = gl.getParameter(gl.VENDOR) || 'Unknown';
      info.renderer = gl.getParameter(gl.RENDERER) || 'Unknown';
      
      // Only try with debug extension if we still have default values
      if (info.vendor === 'Unknown' || info.renderer === 'Unknown') {
        try {
          const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugExt) {
            if (info.vendor === 'Unknown') {
              info.vendor = gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) || 'Unknown';
            }
            if (info.renderer === 'Unknown') {
              info.renderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || 'Unknown';
            }
          }
        } catch (extError) {
          // Silently ignore - this extension is deprecated in some browsers
        }
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
      isMobile: WebGLDetector.isMobileDevice(),
      isLowEnd: WebGLDetector.isLowEndDevice()
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
        
        // Detect device types
        isMobile: WebGLDetector.isMobileDevice(),
        isLowEnd: WebGLDetector.isLowEndDevice()
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
      
      // Remove extra references
      test.gl = null;
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
    
    // Check if user agent contains mobile keywords
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 
      'windows phone', 'mobile', 'tablet'
    ];
    
    const isMobileUserAgent = mobileKeywords.some(keyword => 
      userAgent.includes(keyword)
    );
    
    // Check screen size
    const isSmallScreen = window.innerWidth < 768 || window.innerHeight < 768;
    
    // Check memory if available (newer browsers)
    let hasLimitedMemory = false;
    if (navigator.deviceMemory) {
      hasLimitedMemory = navigator.deviceMemory < 4;
    }
    
    return (hasTouchScreen && (isSmallScreen || isMobileUserAgent)) || 
           (isMobileUserAgent && (isSmallScreen || hasLimitedMemory));
  }
  
  /**
   * Check if the device is a low-end device
   * @returns {boolean} True if the device is likely a low-end device
   */
  static isLowEndDevice() {
    // Check if user agent indicates low-end device
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for device memory (newer browsers)
    if (navigator.deviceMemory) {
      if (navigator.deviceMemory < 2) {
        return true;
      }
    }
    
    // Check for hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency) {
      if (navigator.hardwareConcurrency < 4) {
        return true;
      }
    }
    
    // Check for typical low-end indicators in user agent
    const lowEndKeywords = [
      'spreadtrum', 'mediatek', 'msm', 'sm-g', 'sm-j', 'redmi', 'mi 5', 'mi 4',
      'kfthwi', 'lenovo a', 'android 6', 'android 5', 'android 4'
    ];
    
    const isLowEndUA = lowEndKeywords.some(keyword => 
      userAgent.includes(keyword)
    );
    
    // Small screen size can also indicate a low-end device
    const isVerySmallScreen = window.innerWidth < 400 || window.innerHeight < 400;
    
    return isLowEndUA || isVerySmallScreen;
  }
  
  /**
   * Adjust performance settings based on detected capabilities
   * @private
   * @param {Object} capabilities - WebGL capabilities
   */
  static _adjustPerformanceSettings(capabilities) {
    // Adjust renderer settings first
    CONFIG.RENDERER.ANTIALIAS = !capabilities.isMobile && !capabilities.isLowEnd;
    CONFIG.RENDERER.SHADOW_MAP_ENABLED = !capabilities.isMobile && !capabilities.isLowEnd;
    CONFIG.RENDERER.PIXEL_RATIO = Math.min(
      window.devicePixelRatio || 1, 
      capabilities.isMobile ? 1.5 : 2
    );
    
    // Adjust visualization quality based on device capabilities
    if (capabilities.isMobile || capabilities.isLowEnd) {
      // Lower quality for mobile/low-end devices
      CONFIG.VISUALIZATION.BALL_STICK.SEGMENT_COUNT = 6;
      CONFIG.VISUALIZATION.RIBBON.CURVE_SEGMENTS = 8;
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = 2.5;
      CONFIG.VISUALIZATION.SURFACE.SMOOTHING = 0;
    }
    
    // Always use instancing on capable devices, never on incapable ones
    CONFIG.VISUALIZATION.BALL_STICK.INSTANCING_ENABLED = capabilities.instancedArrays;
    
    // If the device has a small texture size limit, reduce surface quality
    if (capabilities.maxTextureSize < 4096) {
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = Math.max(
        2.0, 
        CONFIG.VISUALIZATION.SURFACE.RESOLUTION
      );
    }
    
    // Apply specific workarounds based on known problematic GPUs
    const rendererLower = capabilities.renderer.toLowerCase();
    
    if (rendererLower.includes('intel') || 
        rendererLower.includes('hd graphics') ||
        rendererLower.includes('mesa') ||
        rendererLower.includes('swiftshader')) {
      // Intel integrated graphics and software renderers often have issues
      CONFIG.RENDERER.ANTIALIAS = false;
      CONFIG.RENDERER.SHADOW_MAP_ENABLED = false;
      CONFIG.VISUALIZATION.BALL_STICK.SEGMENT_COUNT = 6;
      CONFIG.VISUALIZATION.RIBBON.CURVE_SEGMENTS = 8;
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = 3.0;
      CONFIG.PERFORMANCE.ATOM_LIMIT_LOD = 10000;
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
    
    // Handle WebGL context loss - VERY IMPORTANT
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context lost in detector');
      
      // This prevents lost context = the most important part! 
      // Without this, context won't be restored
      event.preventDefault(); 
      
      if (onLost) onLost();
    }, false);
    
    // Handle WebGL context restoration
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored in detector');
      
      if (onRestored) onRestored();
    }, false);
    
    // For manual testing/recovery
    try {
      const gl = renderer.getContext();
      if (gl) {
        const loseContextExt = gl.getExtension('WEBGL_lose_context');
        if (loseContextExt) {
          // Store on renderer for potential manual testing
          renderer._loseContextExt = loseContextExt;
        }
      }
    } catch (error) {
      console.warn('Error getting WEBGL_lose_context extension:', error);
    }
  }
  
  /**
   * Use this method to test context loss/restore functionality
   * @param {THREE.WebGLRenderer} renderer - Renderer to test
   */
  static testContextLoss(renderer) {
    if (!renderer || !renderer.domElement) return;
    
    try {
      // Get extension
      const gl = renderer.getContext();
      if (!gl) return;
      
      const loseExt = gl.getExtension('WEBGL_lose_context');
      if (!loseExt) {
        console.warn('WEBGL_lose_context extension not available for testing');
        return;
      }
      
      // Trigger context loss manually
      console.log('Manually triggering WebGL context loss...');
      loseExt.loseContext();
      
      // Restore after 2 seconds
      setTimeout(() => {
        console.log('Manually restoring WebGL context...');
        loseExt.restoreContext();
      }, 2000);
    } catch (error) {
      console.error('Error testing context loss:', error);
    }
  }
}
