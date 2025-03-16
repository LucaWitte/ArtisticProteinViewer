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
    
    // Bind context handlers
    this._bindContextHandlers();
    
    // Initialize shader
    this._initShader();
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
      event.preventDefault();
      this.contextLost = true;
      
      // Notify that context is lost
      if (this.onContextLost) {
        this.onContextLost();
      }
    }, false);
    
    // Handle WebGL context restoration
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored in ProteinShader');
      this.contextLost = false;
      
      // Re-initialize shader
      this._initShader();
      
      // Notify that context is restored
      if (this.onContextRestored) {
        this.onContextRestored();
      }
    }, false);
  }
  
  /**
   * Initialize the shader based on type
   * @private
   */
  _initShader() {
    try {
      // Create shader uniforms
      this.uniforms = {
        effectStrength: { value: 1.0 },
        time: { value: 0.0 }
      };
      
      // Create shader chunks
      this._createShaderChunks();
      
      // Flag as initialized
      this.initialized = true;
      
      console.log(`Initialized ${this.type} protein shader`);
    } catch (error) {
      console.error('Error initializing protein shader:', error);
      this.initialized = false;
    }
  }
  
  /**
   * Create shader code chunks for different shader types
   * @private
   */
  _createShaderChunks() {
    // Common vertex shader parts
    this.vertexShaderParts = {
      // Common attributes and uniforms
      common: `
        uniform float effectStrength;
        uniform float time;
        
        attribute vec3 color;
        
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
      `,
      
      // Main vertex transformation
      main: `
        void main() {
          // Pass color to fragment shader
          vColor = color;
          
          // Calculate view-space position and normal
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = mvPosition.xyz;
          vNormal = normalMatrix * normal;
          
          // Output position
          gl_Position = projectionMatrix * mvPosition;
        }
      `
    };
    
    // Common fragment shader parts
    this.fragmentShaderParts = {
      // Common uniforms and varyings
      common: `
        uniform float effectStrength;
        uniform float time;
        
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
      `,
      
      // Lighting calculation
      lighting: `
        vec3 calculateLighting(vec3 normal, vec3 viewPosition, vec3 baseColor) {
          // Ambient light
          float ambientStrength = 0.3;
          vec3 ambient = ambientStrength * baseColor;
          
          // Diffuse light
          vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0));
          float diff = max(dot(normal, lightDirection), 0.0);
          vec3 diffuse = diff * baseColor;
          
          // Specular light
          float specularStrength = 0.5;
          vec3 viewDir = normalize(-viewPosition);
          vec3 reflectDir = reflect(-lightDirection, normal);
          float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
          vec3 specular = specularStrength * spec * vec3(1.0);
          
          return ambient + diffuse + specular;
        }
      `,
      
      // Standard shader main function
      standardMain: `
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 finalColor = calculateLighting(normal, vViewPosition, vColor);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      
      // Toon shader main function
      toonMain: `
        void main() {
          vec3 normal = normalize(vNormal);
          
          // Discretize lighting using steps
          vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0));
          float intensity = dot(normal, lightDirection);
          
          // Control number of steps with effectStrength (3-8 steps)
          float steps = 3.0 + 5.0 * effectStrength;
          intensity = floor(intensity * steps) / steps;
          
          // Edge detection for outline
          float edgeThreshold = 0.4;
          float edge = smoothstep(edgeThreshold - 0.05, edgeThreshold + 0.05, dot(normalize(-vViewPosition), normal));
          
          // Ambient light
          float ambientStrength = 0.3;
          vec3 ambient = ambientStrength * vColor;
          
          // Diffuse light
          vec3 diffuse = intensity * vColor;
          
          // Final color
          vec3 finalColor = edge * (ambient + diffuse);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      
      // Glow shader main function
      glowMain: `
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(-vViewPosition);
          
          // Base lighting
          vec3 baseColor = calculateLighting(normal, vViewPosition, vColor);
          
          // Add glow effect (Fresnel-based edge glow)
          float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0) * effectStrength;
          vec3 glowColor = vec3(0.3, 0.6, 1.0); // Blue glow
          
          // Pulsating glow controlled by time
          float pulse = 0.7 + 0.3 * sin(time * 2.0);
          
          // Apply glow
          vec3 finalColor = baseColor + glowColor * fresnel * pulse;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      
      // Outline shader main function
      outlineMain: `
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(-vViewPosition);
          
          // Base lighting
          vec3 baseColor = calculateLighting(normal, vViewPosition, vColor);
          
          // Create outline based on view angle
          float edgeFactor = abs(dot(viewDir, normal));
          float outlineThickness = 0.3 * effectStrength;
          float outline = smoothstep(outlineThickness, outlineThickness + 0.1, edgeFactor);
          
          // Apply outline
          vec3 outlineColor = vec3(0.0, 0.0, 0.0); // Black outline
          vec3 finalColor = mix(outlineColor, baseColor, outline);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    };
  }
  
  /**
   * Create a complete shader based on current type
   * @private
   * @returns {Object} Shader object with vertex and fragment shader code
   */
  _createShader() {
    // Vertex shader
    const vertexShader = `
      ${this.vertexShaderParts.common}
      
      ${this.vertexShaderParts.main}
    `;
    
    // Select fragment shader main function based on type
    let fragmentMain;
    switch (this.type) {
      case 'toon':
        fragmentMain = this.fragmentShaderParts.toonMain;
        break;
      case 'glow':
        fragmentMain = this.fragmentShaderParts.glowMain;
        break;
      case 'outline':
        fragmentMain = this.fragmentShaderParts.outlineMain;
        break;
      default:
        fragmentMain = this.fragmentShaderParts.standardMain;
    }
    
    // Fragment shader
    const fragmentShader = `
      ${this.fragmentShaderParts.common}
      
      ${this.fragmentShaderParts.lighting}
      
      ${fragmentMain}
    `;
    
    return {
      vertexShader,
      fragmentShader
    };
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
      // Fall back to a standard material that doesn't require custom shaders
      return new THREE.MeshStandardMaterial({
        color: options.color || 0xffffff,
        roughness: options.roughness !== undefined ? options.roughness : 0.5,
        metalness: options.metalness !== undefined ? options.metalness : 0.5,
        transparent: options.transparent !== undefined ? options.transparent : false,
        opacity: options.opacity !== undefined ? options.opacity : 1.0,
        side: options.side || THREE.FrontSide
      });
    }
    
    try {
      // For toon shader, use built-in Three.js MeshToonMaterial
      if (this.type === 'toon') {
        const material = new THREE.MeshToonMaterial({
          color: options.color || 0xffffff,
          transparent: options.transparent || false,
          opacity: options.opacity !== undefined ? options.opacity : 1.0,
          side: options.side || THREE.FrontSide
        });
        
        // Store userData for effect strength updates
        material.userData.effectStrength = 1.0;
        
        return material;
      }
      
      // For other shaders, create a custom ShaderMaterial
      const shader = this._createShader();
      
      // Create uniforms
      const uniforms = {
        ...THREE.UniformsLib.lights,
        effectStrength: { value: 1.0 },
        time: { value: 0.0 },
        diffuse: { value: options.color || new THREE.Color(0xffffff) },
        opacity: { value: options.opacity !== undefined ? options.opacity : 1.0 }
      };
      
      // Create material
      const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        lights: true,
        transparent: options.transparent || false,
        side: options.side || THREE.FrontSide
      });
      
      // Add update method for animations
      material.update = (time) => {
        if (material.uniforms.time) {
          material.uniforms.time.value = time;
        }
      };
      
      return material;
    } catch (error) {
      console.error('Error creating shader material:', error);
      
      // Fall back to standard material on error
      return new THREE.MeshStandardMaterial({
        color: options.color || 0xffffff,
        roughness: options.roughness !== undefined ? options.roughness : 0.5,
        metalness: options.metalness !== undefined ? options.metalness : 0.5,
        transparent: options.transparent !== undefined ? options.transparent : false,
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
      // Clamp strength to valid range
      const clampedStrength = Math.max(0.0, Math.min(1.0, strength));
      
      // Update based on material type
      if (material.isMeshToonMaterial) {
        // Store effect strength in userData
        material.userData.effectStrength = clampedStrength;
      } else if (material.isShaderMaterial && material.uniforms) {
        // Update uniform directly
        if (material.uniforms.effectStrength) {
          material.uniforms.effectStrength.value = clampedStrength;
        }
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
    this.onContextLost = callback;
  }
  
  /**
   * Set callback for context restoration
   * @param {Function} callback - Function to call when context is restored
   */
  onRestored(callback) {
    this.onContextRestored = callback;
  }
  
  /**
   * Change shader type
   * @param {string} type - New shader type
   */
  setType(type) {
    if (this.type === type) return;
    
    this.type = type;
    this._initShader();
  }
}
