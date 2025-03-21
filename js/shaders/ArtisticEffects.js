/**
 * ArtisticEffects.js - Pre-configured artistic effect presets for protein visualization
 * Provides ready-to-use effects for enhancing protein representations
 */

import * as THREE from 'three';
import { ShaderInstanceManager } from './ShaderInstanceManager.js';

export class ArtisticEffects {
  /**
   * Create a new artistic effects manager
   * @param {Object} options - Configuration options
   * @param {THREE.WebGLRenderer} options.renderer - Three.js renderer
   * @param {THREE.Camera} [options.camera] - Camera for view-dependent effects
   */
  constructor(options) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    
    // Store camera reference in renderer for shader use
    if (this.renderer && this.camera) {
      if (!this.renderer.userData) this.renderer.userData = {};
      this.renderer.userData.camera = this.camera;
    }
    
    // Create shader manager
    this.shaderManager = new ShaderInstanceManager({
      renderer: this.renderer
    });
    
    // Color palettes for presets
    this.colorPalettes = {
      scientific: {
        carbon: new THREE.Color(0x909090),
        nitrogen: new THREE.Color(0x3050F8),
        oxygen: new THREE.Color(0xFF0D0D),
        hydrogen: new THREE.Color(0xFFFFFF),
        sulfur: new THREE.Color(0xFFFF30),
        phosphorus: new THREE.Color(0xFF8000)
      },
      vibrant: {
        carbon: new THREE.Color(0x454545),
        nitrogen: new THREE.Color(0x4169E1),
        oxygen: new THREE.Color(0xE60000),
        hydrogen: new THREE.Color(0xFFFFFF),
        sulfur: new THREE.Color(0xFFD700),
        phosphorus: new THREE.Color(0xFFA500)
      },
      pastel: {
        carbon: new THREE.Color(0x999999),
        nitrogen: new THREE.Color(0x8A9EFF),
        oxygen: new THREE.Color(0xFF7F7F),
        hydrogen: new THREE.Color(0xF0F0F0),
        sulfur: new THREE.Color(0xFFE699),
        phosphorus: new THREE.Color(0xFFBE7D)
      },
      contrast: {
        carbon: new THREE.Color(0x333333),
        nitrogen: new THREE.Color(0x0000FF),
        oxygen: new THREE.Color(0xFF0000),
        hydrogen: new THREE.Color(0xEEEEEE),
        sulfur: new THREE.Color(0xFFFF00),
        phosphorus: new THREE.Color(0xFF6600)
      },
      monochrome: {
        carbon: new THREE.Color(0x333333),
        nitrogen: new THREE.Color(0x444444),
        oxygen: new THREE.Color(0x555555),
        hydrogen: new THREE.Color(0x222222),
        sulfur: new THREE.Color(0x666666),
        phosphorus: new THREE.Color(0x777777)
      }
    };
    
    // Animation timestamp
    this.time = 0;
    
    // Create preset effects
    this._createPresets();
  }
  
  /**
   * Create preset shader effects
   * @private
   */
  _createPresets() {
    // Define all presets with their configurations
    this.presets = {
      // Standard visualization presets
      'standard': {
        shaderType: 'standard',
        params: {
          effectStrength: 0.5,
          fresnelScale: 0.8,
          fresnelPower: 2.0
        },
        description: 'Clean, scientific visualization with subtle light enhancement'
      },
      
      // Toon/cel-shading presets
      'toon-basic': {
        shaderType: 'toon',
        params: {
          effectStrength: 0.5,
          outlineThickness: 0.02,
          outlineColor: new THREE.Color(0x000000)
        },
        description: 'Basic toon shading with subtle outlines for clarity'
      },
      'toon-bold': {
        shaderType: 'toon',
        params: {
          effectStrength: 0.8,
          outlineThickness: 0.04,
          outlineColor: new THREE.Color(0x000000)
        },
        description: 'Bold toon shading with thick outlines for presentation'
      },
      'toon-pastel': {
        shaderType: 'toon',
        params: {
          effectStrength: 0.6,
          outlineThickness: 0.02,
          outlineColor: new THREE.Color(0x333333),
          colorMultiplier: new THREE.Vector3(1.1, 1.1, 1.1)
        },
        description: 'Pastel-colored toon shading with gentle outlines'
      },
      
      // Glow effect presets
      'glow-subtle': {
        shaderType: 'glow',
        params: {
          effectStrength: 0.4,
          pulseSpeed: 1.0,
          pulseStrength: 0.1,
          fresnelPower: 2.0
        },
        description: 'Subtle edge glow for highlighting structure'
      },
      'glow-intense': {
        shaderType: 'glow',
        params: {
          effectStrength: 0.8,
          pulseSpeed: 2.0,
          pulseStrength: 0.2,
          fresnelPower: 1.5
        },
        description: 'Intense pulsating glow for dramatic effect'
      },
      'glow-electric': {
        shaderType: 'glow',
        params: {
          effectStrength: 0.9,
          pulseSpeed: 3.0,
          pulseStrength: 0.3,
          fresnelPower: 1.2
        },
        description: 'Electric-like glow effect with rapid pulsation'
      },
      
      // Outline effect presets
      'outline-thin': {
        shaderType: 'outline',
        params: {
          effectStrength: 0.5,
          outlineThickness: 0.02,
          outlineColor: new THREE.Color(0x000000)
        },
        description: 'Thin black outlines for clean visualization'
      },
      'outline-colored': {
        shaderType: 'outline',
        params: {
          effectStrength: 0.6,
          outlineThickness: 0.03,
          outlineColor: new THREE.Color(0x3498db)
        },
        description: 'Medium colored outlines for artistic presentation'
      },
      'outline-bold': {
        shaderType: 'outline',
        params: {
          effectStrength: 0.9,
          outlineThickness: 0.06,
          outlineColor: new THREE.Color(0x000000)
        },
        description: 'Bold black outlines for maximum contrast'
      },
      
      // X-ray effect presets
      'xray-blue': {
        shaderType: 'xray',
        params: {
          effectStrength: 0.7,
          pulseSpeed: 1.0,
          fresnelPower: 2.0
        },
        description: 'Translucent blue x-ray visualization'
      },
      'xray-multi': {
        shaderType: 'xray',
        params: {
          effectStrength: 0.8,
          pulseSpeed: 1.5,
          fresnelPower: 1.7
        },
        description: 'Multi-colored translucent x-ray effect'
      },
      
      // Ambient occlusion presets
      'ambient-soft': {
        shaderType: 'ambient',
        params: {
          effectStrength: 0.5,
          aoStrength: 0.6
        },
        description: 'Soft ambient occlusion for enhanced depth'
      },
      'ambient-strong': {
        shaderType: 'ambient',
        params: {
          effectStrength: 0.8,
          aoStrength: 0.9
        },
        description: 'Strong ambient occlusion for dramatic shadows'
      },
      
      // Special combination presets
      'presentation': {
        shaderType: 'toon',
        params: {
          effectStrength: 0.7,
          outlineThickness: 0.03,
          outlineColor: new THREE.Color(0x000000)
        },
        description: 'Optimized for presentations with clear outlines'
      },
      'publication': {
        shaderType: 'outline',
        params: {
          effectStrength: 0.6,
          outlineThickness: 0.02,
          outlineColor: new THREE.Color(0x000000)
        },
        description: 'Clean, publication-ready visualization with subtle outlines'
      },
      'educational': {
        shaderType: 'toon',
        params: {
          effectStrength: 0.8,
          outlineThickness: 0.05,
          outlineColor: new THREE.Color(0x000000)
        },
        description: 'High contrast, educational style with bold outlines'
      },
      'artistic': {
        shaderType: 'glow',
        params: {
          effectStrength: 0.7,
          pulseSpeed: 1.2,
          pulseStrength: 0.15,
          fresnelPower: 2.0
        },
        description: 'Creative, artistic visualization with subtle glow'
      }
    };
  }
  
  /**
   * Get a material with a specific effect preset
   * @param {string} preset - Preset name
   * @param {Object} materialOptions - Material options like color, opacity
   * @returns {THREE.Material} Material with the effect applied
   */
  getMaterial(preset, materialOptions = {}) {
    // Get preset or fall back to standard
    const presetConfig = this.presets[preset] || this.presets['standard'];
    
    // Get shader for this preset
    const shader = this.shaderManager.getShader(presetConfig.shaderType);
    
    // Create material with specified shader
    const material = shader.getMaterial({
      ...materialOptions,
      // Ensure these aren't overridden
      transparent: materialOptions.transparent !== undefined ? 
        materialOptions.transparent : 
        presetConfig.shaderType === 'xray'
    });
    
    // Apply preset parameters
    shader.updateEffectStrength(material, presetConfig.params.effectStrength);
    
    return material;
  }
  
  /**
   * Apply an effect preset to existing materials
   * @param {string} preset - Preset name
   * @param {Array<THREE.Material>} materials - Materials to update
   */
  applyPreset(preset, materials) {
    if (!Array.isArray(materials)) {
      materials = [materials];
    }
    
    // Get preset or fall back to standard
    const presetConfig = this.presets[preset] || this.presets['standard'];
    
    // Get shader for this preset
    const shader = this.shaderManager.getShader(presetConfig.shaderType);
    
    // Apply effect to each material
    materials.forEach(material => {
      // Update each parameter from the preset
      Object.entries(presetConfig.params).forEach(([param, value]) => {
        if (param === 'effectStrength') {
          shader.updateEffectStrength(material, value);
        } else if (material.userData.shader && material.userData.shader.uniforms[param]) {
          material.userData.shader.uniforms[param].value = value;
        }
      });
      
      // Ensure material is marked for update
      material.needsUpdate = true;
    });
  }
  
  /**
   * Get list of available effect presets
   * @returns {Object} Object with preset names as keys and descriptions as values
   */
  getAvailablePresets() {
    const presets = {};
    
    Object.entries(this.presets).forEach(([name, preset]) => {
      presets[name] = preset.description;
    });
    
    return presets;
  }
  
  /**
   * Get list of available shader types
   * @returns {Array} Array of shader type names
   */
  getAvailableShaderTypes() {
    return this.shaderManager.getAvailableShaderTypes();
  }
  
  /**
   * Get color from one of the predefined color palettes
   * @param {string} palette - Palette name: 'scientific', 'vibrant', 'pastel', 'contrast', 'monochrome'
   * @param {string} element - Element type: 'carbon', 'nitrogen', 'oxygen', 'hydrogen', 'sulfur', 'phosphorus'
   * @returns {THREE.Color} Color from palette
   */
  getColorFromPalette(palette, element) {
    const selectedPalette = this.colorPalettes[palette] || this.colorPalettes.scientific;
    return selectedPalette[element] || new THREE.Color(0xFFFFFF);
  }
  
  /**
   * Create a custom shader effect
   * @param {string} shaderType - Base shader type
   * @param {Object} params - Shader parameters
   * @returns {Object} Custom effect preset
   */
  createCustomEffect(shaderType, params) {
    // Validate shader type
    if (!this.shaderManager.isShaderSupported(shaderType)) {
      console.warn(`Shader type '${shaderType}' not supported, falling back to 'standard'`);
      shaderType = 'standard';
    }
    
    // Create custom preset
    return {
      shaderType,
      params: {
        effectStrength: params.effectStrength || 0.5,
        ...params
      },
      description: params.description || 'Custom shader effect'
    };
  }
  
  /**
   * Apply a custom effect to materials
   * @param {Object} customEffect - Custom effect configuration
   * @param {Array<THREE.Material>} materials - Materials to update
   */
  applyCustomEffect(customEffect, materials) {
    if (!Array.isArray(materials)) {
      materials = [materials];
    }
    
    // Get shader for this effect
    const shader = this.shaderManager.getShader(customEffect.shaderType);
    
    // Apply effect to each material
    materials.forEach(material => {
      // Update each parameter from the custom effect
      Object.entries(customEffect.params).forEach(([param, value]) => {
        if (param === 'effectStrength') {
          shader.updateEffectStrength(material, value);
        } else if (material.userData.shader && material.userData.shader.uniforms[param]) {
          material.userData.shader.uniforms[param].value = value;
        }
      });
      
      // Ensure material is marked for update
      material.needsUpdate = true;
    });
  }
  
  /**
   * Update animations and time-dependent effects
   * @param {number} [deltaTime=0.016] - Time since last update in seconds
   */
  update(deltaTime = 0.016) {
    // Update internal time
    this.time += deltaTime;
    
    // Update shader manager with current time
    this.shaderManager.update(this.time);
  }
  
  /**
   * Release resources used by this effects manager
   */
  dispose() {
    // Dispose of shader manager
    if (this.shaderManager && this.shaderManager.dispose) {
      this.shaderManager.dispose();
    }
    
    // Clear references
    this.renderer = null;
    this.camera = null;
    this.shaderManager = null;
    this.presets = null;
    this.colorPalettes = null;
  }
}
