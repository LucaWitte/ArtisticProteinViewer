/**
 * ShaderManager.js - Manages loading, compiling, and applying custom shaders
 * Provides an interface for different shader effects in the visualization
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';
import { standardVert, standardFrag } from './ShaderChunks.js';

export class ShaderManager {
  /**
   * Create a new shader manager
   */
  constructor() {
    // Available shader types
    this.shaderTypes = {
      standard: {
        name: 'Standard',
        vertexShader: null,
        fragmentShader: null
      },
      toon: {
        name: 'Toon/Cel Shading',
        vertexShader: null,
        fragmentShader: null
      },
      glow: {
        name: 'Glow Effect',
        vertexShader: null,
        fragmentShader: null
      },
      outline: {
        name: 'Outline',
        vertexShader: null,
        fragmentShader: null
      }
    };
    
    // Track loaded status
    this.loaded = false;
    
    // Store compiled shaders
    this.shaders = {};
  }
  
  /**
   * Load shader files
   * @returns {Promise<void>} Promise that resolves when shaders are loaded
   */
  async loadShaders() {
    try {
      // In a real implementation, we would load shader files from disk
      // For this MVP, we'll use embedded shaders from ShaderChunks.js
      this._compileShaders();
      
      this.loaded = true;
      return Promise.resolve();
    } catch (error) {
      console.error('Error loading shaders:', error);
      return Promise.reject(error);
    }
  }
  
  /**
   * Compile shaders and prepare for use
   * @private
   */
  _compileShaders() {
    // Standard shader
    this.shaders.standard = this._createStandardShader();
    
    // Toon shader
    this.shaders.toon = this._createToonShader();
    
    // Glow shader
    this.shaders.glow = this._createGlowShader();
    
    // Outline shader
    this.shaders.outline = this._createOutlineShader();
  }
  
  /**
   * Create standard shader
   * @private
   * @returns {Object} Shader object
   */
  _createStandardShader() {
    return {
      type: 'standard',
      getMaterial: (options) => {
        return new THREE.MeshStandardMaterial({
          ...options,
          onBeforeCompile: (shader) => {
            // Store original uniforms and vertex shader
            shader.originalUniforms = shader.uniforms;
            
            // Add custom uniforms
            shader.uniforms.effectStrength = { value: 1.0 };
          }
        });
      },
      updateEffectStrength: (material, strength) => {
        // Standard shader doesn't use effect strength
      }
    };
  }
  
  /**
   * Create toon/cel shader
   * @private
   * @returns {Object} Shader object
   */
  _createToonShader() {
    // Create toon shader material factory
    return {
      type: 'toon',
      getMaterial: (options) => {
        // Create a new toon material
        const material = new THREE.MeshToonMaterial({
          ...options,
          gradientMap: this._createToonGradientTexture(3)
        });
        
        // Store effect strength
        material.userData.effectStrength = 1.0;
        
        return material;
      },
      updateEffectStrength: (material, strength) => {
        if (material.isMeshToonMaterial) {
          // Store effect strength
          material.userData.effectStrength = strength;
          
          // Update gradient steps based on strength
          const steps = Math.max(2, Math.round(2 + strength * 8));
          material.gradientMap = this._createToonGradientTexture(steps);
          material.needsUpdate = true;
        }
      }
    };
  }
  
  /**
   * Create glow shader
   * @private
   * @returns {Object} Shader object
   */
  _createGlowShader() {
    // Create glow shader material factory
    return {
      type: 'glow',
      getMaterial: (options) => {
        // Start with a physical material
        const material = new THREE.MeshStandardMaterial({
          ...options,
          emissive: options.color.clone(),
          emissiveIntensity: 0.2
        });
        
        // Store original color
        material.userData.originalColor = options.color.clone();
        material.userData.effectStrength = 1.0;
        
        return material;
      },
      updateEffectStrength: (material, strength) => {
        if (material.isMeshStandardMaterial && material.userData.originalColor) {
          // Store effect strength
          material.userData.effectStrength = strength;
          
          // Update emissive intensity based on strength
          material.emissiveIntensity = 0.1 + strength * 0.9;
          material.needsUpdate = true;
        }
      }
    };
  }
  
  /**
   * Create outline shader
   * @private
   * @returns {Object} Shader object
   */
  _createOutlineShader() {
    return {
      type: 'outline',
      getMaterial: (options) => {
        // Create the main material
        const material = new THREE.MeshStandardMaterial(options);
        
        // Store original color and effect strength
        material.userData.originalColor = options.color.clone();
        material.userData.effectStrength = 1.0;
        material.userData.outlineApplied = false;
        
        // For a true outline effect, we would need a post-processing pass
        // or a second mesh with a slightly larger scale
        // For this simple MVP, we'll just add a colored edge to the material
        
        if (!material.userData.outlineApplied) {
          material.onBeforeCompile = (shader) => {
            // Add outline parameters
            shader.uniforms.outlineColor = { 
              value: new THREE.Color(0x000000) 
            };
            shader.uniforms.outlineThickness = { 
              value: 0.01 
            };
            
            // Modify fragment shader to add outline
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              uniform vec3 outlineColor;
              uniform float outlineThickness;
              `
            );
            
            // Add outline calculation before fragment output
            shader.fragmentShader = shader.fragmentShader.replace(
              'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
              `
              // Calculate outline based on view angle and normals
              float outline = step(1.0 - outlineThickness, abs(dot(normalize(vViewPosition), normal)));
              outgoingLight = mix(outgoingLight, outlineColor, outline);
              gl_FragColor = vec4( outgoingLight, diffuseColor.a );
              `
            );
            
            // Store the modified shader
            material.userData.shader = shader;
          };
          
          material.userData.outlineApplied = true;
        }
        
        return material;
      },
      updateEffectStrength: (material, strength) => {
        if (material.userData.shader) {
          // Store effect strength
          material.userData.effectStrength = strength;
          
          // Update outline thickness
          if (material.userData.shader.uniforms.outlineThickness) {
            material.userData.shader.uniforms.outlineThickness.value = 0.005 + strength * 0.025;
          }
        }
      }
    };
  }
  
  /**
   * Create a gradient texture for toon shading
   * @private
   * @param {number} steps - Number of gradient steps
   * @returns {THREE.Texture} Gradient texture
   */
  _createToonGradientTexture(steps) {
    const data = new Uint8Array(steps * 4);
    const colorStep = 1.0 / (steps - 1);
    
    for (let i = 0; i < steps; i++) {
      const color = colorStep * i;
      
      data[i * 4] = Math.round(color * 255);
      data[i * 4 + 1] = Math.round(color * 255);
      data[i * 4 + 2] = Math.round(color * 255);
      data[i * 4 + 3] = 255;
    }
    
    const texture = new THREE.DataTexture(
      data,
      steps,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
      THREE.UVMapping,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.NearestFilter,
      THREE.NearestFilter
    );
    
    texture.needsUpdate = true;
    
    return texture;
  }
  
  /**
   * Get a shader by name
   * @param {string} name - Shader name
   * @returns {Object} Shader object
   */
  getShader(name) {
    if (!this.loaded) {
      console.warn('Shaders not loaded yet');
    }
    
    return this.shaders[name] || this.shaders.standard;
  }
  
  /**
   * Get all available shader names
   * @returns {Array} Array of shader names
   */
  getShaderNames() {
    return Object.keys(this.shaderTypes);
  }
  
  /**
   * Dispose of shader resources
   */
  dispose() {
    // Clean up any shader resources
    for (const shader of Object.values(this.shaders)) {
      if (shader.dispose) {
        shader.dispose();
      }
    }
  }
}
