/**
 * WebGLDetector.js - Utility for detecting WebGL support and capabilities
 * Provides methods to check WebGL compatibility and gather GPU capabilities
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
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (error) {
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
      return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect WebGL capabilities and update the CONFIG object
   * @returns {Object} Object containing WebGL capabilities
   */
  static detectCapabilities() {
    const capabilities = {};
    let gl;
    
    try {
      // Try to get WebGL2 context first
      const canvas = document.createElement('canvas');
      gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        throw new Error('WebGL not supported');
      }
      
      // Detect WebGL version
      capabilities.webGLVersion = gl instanceof WebGL2RenderingContext ? 2 : 1;
      
      // Get renderer info
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        capabilities.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        capabilities.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      } else {
        capabilities.vendor = gl.getParameter(gl.VENDOR);
        capabilities.renderer = gl.getParameter(gl.RENDERER);
      }
      
      // Get texture size limits
      capabilities.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      capabilities.maxCubeMapTextureSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
      capabilities.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      
      // Check for hardware instancing
      const instancedArrays = 
        capabilities.webGLVersion === 2 || 
        gl.getExtension('ANGLE_instanced_arrays') || 
        gl.getExtension('EXT_instanced_arrays');
      capabilities.instancedArrays = !!instancedArrays;
      
      // Check for float textures
      capabilities.floatTextures = !!(
        gl.getExtension('OES_texture_float') || 
        capabilities.webGLVersion === 2
      );
      
      // Check for anisotropic filtering
      const anisotropyExt = 
        gl.getExtension('EXT_texture_filter_anisotropic') || 
        gl.getExtension('MOZ_EXT_texture_filter_anisotropic') || 
        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      
      if (anisotropyExt) {
        capabilities.anisotropy = true;
        capabilities.maxAnisotropy = gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      } else {
        capabilities.anisotropy = false;
        capabilities.maxAnisotropy = 1;
      }
      
      // Check for depth texture support
      capabilities.depthTexture = !!(
        capabilities.webGLVersion === 2 || 
        gl.getExtension('WEBGL_depth_texture')
      );
      
      // Check for standard derivatives (required for normal mapping)
      capabilities.standardDerivatives = !!(
        capabilities.webGLVersion === 2 || 
        gl.getExtension('OES_standard_derivatives')
      );
      
      // Check for vertex array objects
      capabilities.vertexArrayObject = !!(
        capabilities.webGLVersion === 2 || 
        gl.getExtension('OES_vertex_array_object')
      );
      
      // Check for sRGB texture support
      capabilities.sRGBTextures = !!(
        capabilities.webGLVersion === 2 || 
        gl.getExtension('EXT_sRGB')
      );
      
      // Detect mobile/desktop device type
      capabilities.isMobile = WebGLDetector.isMobileDevice();
      
      // Update CONFIG with detected capabilities
      CONFIG.CAPABILITIES = {
        ...CONFIG.CAPABILITIES,
        ...capabilities
      };
      
      // Adjust performance settings based on capabilities
      WebGLDetector._adjustPerformanceSettings(capabilities);
      
    } catch (error) {
      console.error('Error detecting WebGL capabilities:', error);
      return null;
    } finally {
      // Clean up context if it was created
      if (gl && gl.getExtension('WEBGL_lose_context')) {
        gl.getExtension('WEBGL_lose_context').loseContext();
      }
    }
    
    return capabilities;
  }
  
  /**
   * Check if the device is a mobile device
   * Based on screen size, touch capability and user agent
   * @returns {boolean} True if the device is likely a mobile device
   */
  static isMobileDevice() {
    // Check for touch capability as a primary indicator
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
      
      CONFIG.VISUALIZATION.BALL_STICK.SEGMENT_COUNT = 12;
      CONFIG.VISUALIZATION.RIBBON.CURVE_SEGMENTS = 16;
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = 1.5;
    }
    
    // If instancing is not supported, disable it
    if (!capabilities.instancedArrays) {
      CONFIG.VISUALIZATION.BALL_STICK.INSTANCING_ENABLED = false;
    }
    
    // If limited texture size, adjust surface resolution
    if (capabilities.maxTextureSize < 4096) {
      CONFIG.VISUALIZATION.SURFACE.RESOLUTION = Math.max(1.5, CONFIG.VISUALIZATION.SURFACE.RESOLUTION);
    }
  }
}
