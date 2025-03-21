/**
 * ArtisticProteinShader.js - Advanced GLSL shaders for artistic protein rendering
 * Provides robust shader implementation with context loss recovery and performance optimizations
 */

import * as THREE from 'three';

export class ArtisticProteinShader {
  /**
   * Create a new artistic protein shader
   * @param {Object} options - Shader configuration options
   * @param {string} options.type - Shader type: 'standard', 'toon', 'glow', 'outline', 'ambient', or 'xray'
   * @param {THREE.WebGLRenderer} options.renderer - Three.js renderer instance
   * @param {boolean} [options.useConservativeSettings=true] - Whether to use conservative settings for better compatibility
   */
  constructor(options) {
    // Store configuration
    this.type = options.type || 'standard';
    this.renderer = options.renderer;
    this.useConservativeSettings = options.useConservativeSettings !== false;
    
    // State tracking
    this.initialized = false;
    this.contextLost = false;
    this.contextLostCallback = null;
    this.contextRestoredCallback = null;
    
    // Material cache for reuse and efficient memory management
    this.materialCache = new Map();
    
    // Track all created materials for global updates
    this.activeMaterials = new Set();
    
    // Shader configuration with adaptive quality settings
    this.isMobileDevice = this._checkIfMobile();
    this.quality = this.isMobileDevice ? 'low' : 'high';
    
    // Set up context loss detection
    this._setupContextLossHandling();
    
    // Initialize shaders
    this._initializeShaders();
    
    console.log(`ArtisticProteinShader initialized with ${this.type} shader (${this.quality} quality)`);
  }

  /**
   * Setup WebGL context loss/restore handling
   * @private
   */
  _setupContextLossHandling() {
    if (!this.renderer || !this.renderer.domElement) return;
    
    // Handle WebGL context loss
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context lost in protein shader');
      
      // Critical: prevent default to allow context restoration
      event.preventDefault();
      
      this.contextLost = true;
      
      // Clear material cache on context loss to prevent leaks
      this._clearMaterialCache();
      
      // Notify application about context loss
      if (this.contextLostCallback) {
        this.contextLostCallback();
      }
    }, false);
    
    // Handle WebGL context restoration
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored in protein shader');
      this.contextLost = false;
      
      // Re-initialize shaders
      this._initializeShaders();
      
      // Notify application about context restoration
      if (this.contextRestoredCallback) {
        this.contextRestoredCallback();
      }
    }, false);
  }
  
  /**
   * Initialize shader uniforms and programs
   * @private
   */
  _initializeShaders() {
    try {
      // Create shared uniforms
      this.uniforms = {
        // Effect strength uniform (0.0 - 1.0)
        effectStrength: { value: 0.5 },
        
        // Animation time
        time: { value: 0.0 },
        
        // Color adjustment
        colorMultiplier: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        
        // Fresnel effect parameters (edge glow)
        fresnelBias: { value: 0.1 },
        fresnelScale: { value: 1.0 },
        fresnelPower: { value: 2.0 },
        
        // Pulse animation parameters
        pulseSpeed: { value: 2.0 },
        pulseStrength: { value: 0.1 },
        
        // Outline parameters
        outlineColor: { value: new THREE.Color(0x000000) },
        outlineThickness: { value: 0.02 },
        
        // Ambient occlusion
        aoStrength: { value: 0.5 },
        
        // View vector for fresnel calculation
        cameraPosition: { value: new THREE.Vector3() }
      };
      
      // Compile shader programs
      this._compileShaders();
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing shaders:', error);
      this.initialized = false;
    }
  }
  
  /**
   * Compile shader programs for each shader type
   * @private
   */
  _compileShaders() {
    // Adapted to use Three.js built-in materials with custom modifications
    // rather than fully custom shaders for better compatibility and performance
    
    // All shader preprocessing is done at get material time via onBeforeCompile
    // to ensure proper context recovery
  }
  
  /**
   * Create and return a material with the current shader settings
   * @param {Object} options - Material options
   * @param {THREE.Color} options.color - Base color
   * @param {number} [options.roughness=0.5] - Surface roughness (0.0 - 1.0)
   * @param {number} [options.metalness=0.0] - Surface metalness (0.0 - 1.0)
   * @param {boolean} [options.transparent=false] - Whether the material is transparent
   * @param {number} [options.opacity=1.0] - Material opacity
   * @param {THREE.Side} [options.side=THREE.FrontSide] - Which side to render
   * @returns {THREE.Material} Three.js material with shader applied
   */
  getMaterial(options = {}) {
    // Fail gracefully if context is lost or not initialized
    if (this.contextLost || !this.initialized) {
      console.warn('Cannot create shader material: WebGL context lost or shader not initialized');
      // Return basic material that doesn't rely on custom shaders
      return new THREE.MeshLambertMaterial({
        color: options.color || new THREE.Color(0xffffff),
        transparent: options.transparent || false,
        opacity: options.opacity !== undefined ? options.opacity : 1.0,
        side: options.side || THREE.FrontSide
      });
    }
    
    try {
      // Create cache key based on material options
      const cacheKey = this._createMaterialCacheKey(options);
      
      // Check cache for existing material
      if (this.materialCache.has(cacheKey)) {
        return this.materialCache.get(cacheKey);
      }
      
      // Create appropriate material based on shader type
      let material;
      
      switch (this.type) {
        case 'toon':
          material = this._createToonMaterial(options);
          break;
        
        case 'glow':
          material = this._createGlowMaterial(options);
          break;
        
        case 'outline':
          material = this._createOutlineMaterial(options);
          break;
          
        case 'xray':
          material = this._createXRayMaterial(options);
          break;
          
        case 'ambient':
          material = this._createAmbientMaterial(options);
          break;
          
        case 'standard':
        default:
          material = this._createStandardMaterial(options);
      }
      
      // Store in cache
      this.materialCache.set(cacheKey, material);
      
      // Add to active materials set for global updates
      this.activeMaterials.add(material);
      
      return material;
    } catch (error) {
      console.error('Error creating shader material:', error);
      
      // Return fallback material
      return new THREE.MeshLambertMaterial({
        color: options.color || new THREE.Color(0xffffff),
        transparent: options.transparent || false,
        opacity: options.opacity !== undefined ? options.opacity : 1.0,
        side: options.side || THREE.FrontSide
      });
    }
  }
  
  /**
   * Create a string key for material caching based on options
   * @private
   * @param {Object} options - Material options
   * @returns {string} Cache key
   */
  _createMaterialCacheKey(options) {
    const color = options.color ? options.color.getHexString() : 'ffffff';
    const roughness = options.roughness !== undefined ? options.roughness.toFixed(2) : '0.50';
    const metalness = options.metalness !== undefined ? options.metalness.toFixed(2) : '0.00';
    const transparent = options.transparent ? 'T' : 'O';
    const opacity = options.opacity !== undefined ? options.opacity.toFixed(2) : '1.00';
    const side = options.side === THREE.DoubleSide ? 'D' : (options.side === THREE.BackSide ? 'B' : 'F');
    
    return `${this.type}_${color}_${roughness}_${metalness}_${transparent}_${opacity}_${side}`;
  }
  
  /**
   * Create a standard material with subtle enhancements
   * @private
   * @param {Object} options - Material options
   * @returns {THREE.MeshStandardMaterial} Enhanced standard material
   */
  _createStandardMaterial(options) {
    // Create base material
    const material = new THREE.MeshStandardMaterial({
      color: options.color || new THREE.Color(0xffffff),
      roughness: options.roughness !== undefined ? options.roughness : 0.5,
      metalness: options.metalness !== undefined ? options.metalness : 0.0,
      transparent: options.transparent || false,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      side: options.side || THREE.FrontSide,
      flatShading: this.isMobileDevice
    });
    
    // Store original color
    material.userData.originalColor = options.color ? options.color.clone() : new THREE.Color(0xffffff);
    material.userData.effectStrength = 0.5;
    
    // Add custom shader modifications
    material.onBeforeCompile = (shader) => {
      // Store reference to shader
      material.userData.shader = shader;
      
      // Add custom uniforms
      shader.uniforms.effectStrength = this.uniforms.effectStrength;
      shader.uniforms.time = this.uniforms.time;
      shader.uniforms.fresnelBias = this.uniforms.fresnelBias;
      shader.uniforms.fresnelScale = this.uniforms.fresnelScale;
      shader.uniforms.fresnelPower = this.uniforms.fresnelPower;
      
      // Add custom code to fragment shader for enhanced lighting
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        
        uniform float effectStrength;
        uniform float time;
        uniform float fresnelBias;
        uniform float fresnelScale;
        uniform float fresnelPower;
        
        // Fresnel calculation function
        float calculateFresnel(vec3 viewDir, vec3 normal) {
          return fresnelBias + fresnelScale * pow(1.0 + dot(viewDir, normal), fresnelPower);
        }
        `
      );
      
      // Enhance lighting model
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `
        // Calculate fresnel effect for rim lighting
        float fresnel = calculateFresnel(normalize(-vViewPosition), normal) * effectStrength;
        
        // Add subtle rim highlighting
        outgoingLight += fresnel * diffuseColor.rgb * 0.5;
        
        gl_FragColor = vec4(outgoingLight, diffuseColor.a);
        `
      );
    };
    
    return material;
  }
  
  /**
   * Create a toon/cel-shaded material
   * @private
   * @param {Object} options - Material options
   * @returns {THREE.MeshToonMaterial} Toon material
   */
  _createToonMaterial(options) {
    // Create gradient texture for toon shading
    const steps = this.isMobileDevice ? 3 : 4;
    const gradientMap = this._createToonGradientTexture(steps);
    
    // Create toon material
    const material = new THREE.MeshToonMaterial({
      color: options.color || new THREE.Color(0xffffff),
      gradientMap: gradientMap,
      transparent: options.transparent || false,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      side: options.side || THREE.FrontSide
    });
    
    // Store original color
    material.userData.originalColor = options.color ? options.color.clone() : new THREE.Color(0xffffff);
    material.userData.effectStrength = 0.5;
    material.userData.gradientMap = gradientMap;
    
    // Add custom shader modifications for outline effect
    material.onBeforeCompile = (shader) => {
      // Store reference to shader
      material.userData.shader = shader;
      
      // Add custom uniforms
      shader.uniforms.effectStrength = this.uniforms.effectStrength;
      shader.uniforms.outlineColor = this.uniforms.outlineColor;
      shader.uniforms.outlineThickness = this.uniforms.outlineThickness;
      shader.uniforms.time = this.uniforms.time;
      
      // Add custom code to fragment shader for outline effect
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        
        uniform float effectStrength;
        uniform vec3 outlineColor;
        uniform float outlineThickness;
        uniform float time;
        `
      );
      
      // Add outline effect
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `
        // Calculate view angle for outline
        float edgeFactor = abs(dot(normalize(-vViewPosition), normal));
        float outlineWidth = outlineThickness * effectStrength;
        float outline = step(edgeFactor, outlineWidth);
        
        // Apply outline effect
        outgoingLight = mix(outgoingLight, outlineColor, outline);
        
        gl_FragColor = vec4(outgoingLight, diffuseColor.a);
        `
      );
    };
    
    return material;
  }
  
  /**
   * Create a material with glow effect
   * @private
   * @param {Object} options - Material options
   * @returns {THREE.MeshStandardMaterial} Material with glow effect
   */
  _createGlowMaterial(options) {
    // Create base material
    const material = new THREE.MeshStandardMaterial({
      color: options.color || new THREE.Color(0xffffff),
      emissive: options.color || new THREE.Color(0xffffff),
      emissiveIntensity: 0.2,
      roughness: options.roughness !== undefined ? options.roughness : 0.7,
      metalness: options.metalness !== undefined ? options.metalness : 0.3,
      transparent: options.transparent || false,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      side: options.side || THREE.FrontSide
    });
    
    // Store original color
    material.userData.originalColor = options.color ? options.color.clone() : new THREE.Color(0xffffff);
    material.userData.effectStrength = 0.5;
    
    // Add custom shader modifications for glow effect
    material.onBeforeCompile = (shader) => {
      // Store reference to shader
      material.userData.shader = shader;
      
      // Add custom uniforms
      shader.uniforms.effectStrength = this.uniforms.effectStrength;
      shader.uniforms.time = this.uniforms.time;
      shader.uniforms.pulseSpeed = this.uniforms.pulseSpeed;
      shader.uniforms.pulseStrength = this.uniforms.pulseStrength;
      shader.uniforms.fresnelBias = this.uniforms.fresnelBias;
      shader.uniforms.fresnelScale = this.uniforms.fresnelScale;
      shader.uniforms.fresnelPower = this.uniforms.fresnelPower;
      
      // Add custom code to fragment shader for glow effect
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        
        uniform float effectStrength;
        uniform float time;
        uniform float pulseSpeed;
        uniform float pulseStrength;
        uniform float fresnelBias;
        uniform float fresnelScale;
        uniform float fresnelPower;
        
        // Fresnel calculation function
        float calculateFresnel(vec3 viewDir, vec3 normal) {
          return fresnelBias + fresnelScale * pow(1.0 + dot(viewDir, normal), fresnelPower);
        }
        `
      );
      
      // Add glow effect
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `
        // Calculate fresnel effect for edge glow
        float fresnel = calculateFresnel(normalize(-vViewPosition), normal) * effectStrength;
        
        // Add pulsating glow
        float pulse = 0.5 + 0.5 * sin(time * pulseSpeed + vViewPosition.x * 0.1 + vViewPosition.y * 0.1 + vViewPosition.z * 0.1);
        pulse = mix(1.0, pulse, pulseStrength * effectStrength);
        
        // Add glow effect
        vec3 glowColor = diffuseColor.rgb * fresnel * pulse * 2.0;
        outgoingLight += glowColor;
        
        gl_FragColor = vec4(outgoingLight, diffuseColor.a);
        `
      );
    };
    
    return material;
  }
  
  /**
   * Create a material with outline effect
   * @private
   * @param {Object} options - Material options
   * @returns {THREE.MeshStandardMaterial} Material with outline effect
   */
  _createOutlineMaterial(options) {
    // Create base material
    const material = new THREE.MeshStandardMaterial({
      color: options.color || new THREE.Color(0xffffff),
      roughness: options.roughness !== undefined ? options.roughness : 0.5,
      metalness: options.metalness !== undefined ? options.metalness : 0.1,
      transparent: options.transparent || false,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      side: options.side || THREE.FrontSide
    });
    
    // Store original color
    material.userData.originalColor = options.color ? options.color.clone() : new THREE.Color(0xffffff);
    material.userData.effectStrength = 0.5;
    material.userData.isOutline = true;
    
    // Add custom shader modifications for outline effect
    material.onBeforeCompile = (shader) => {
      // Store reference to shader
      material.userData.shader = shader;
      
      // Add custom uniforms
      shader.uniforms.effectStrength = this.uniforms.effectStrength;
      shader.uniforms.outlineColor = this.uniforms.outlineColor;
      shader.uniforms.outlineThickness = this.uniforms.outlineThickness;
      
      // Add custom code to fragment shader for outline effect
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        
        uniform float effectStrength;
        uniform vec3 outlineColor;
        uniform float outlineThickness;
        `
      );
      
      // Add outline effect
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `
        // Calculate view angle for outline
        float edgeFactor = abs(dot(normalize(-vViewPosition), normal));
        float outlineWidth = outlineThickness * effectStrength;
        float outline = step(edgeFactor, outlineWidth);
        
        // Apply outline effect
        outgoingLight = mix(outgoingLight, outlineColor, outline);
        
        gl_FragColor = vec4(outgoingLight, diffuseColor.a);
        `
      );
    };
    
    return material;
  }
  
  /**
   * Create a material with X-ray effect
   * @private
   * @param {Object} options - Material options
   * @returns {THREE.MeshPhongMaterial} Material with X-ray effect
   */
  _createXRayMaterial(options) {
    // Create base material - use Phong for better performance
    const material = new THREE.MeshPhongMaterial({
      color: options.color || new THREE.Color(0xffffff),
      transparent: true,
      opacity: options.opacity !== undefined ? options.opacity : 0.6,
      side: options.side || THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    // Store original color
    material.userData.originalColor = options.color ? options.color.clone() : new THREE.Color(0xffffff);
    material.userData.effectStrength = 0.5;
    
    // Add custom shader modifications for X-ray effect
    material.onBeforeCompile = (shader) => {
      // Store reference to shader
      material.userData.shader = shader;
      
      // Add custom uniforms
      shader.uniforms.effectStrength = this.uniforms.effectStrength;
      shader.uniforms.time = this.uniforms.time;
      shader.uniforms.fresnelBias = this.uniforms.fresnelBias;
      shader.uniforms.fresnelScale = this.uniforms.fresnelScale;
      shader.uniforms.fresnelPower = this.uniforms.fresnelPower;
      
      // Add custom code to fragment shader for X-ray effect
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        
        uniform float effectStrength;
        uniform float time;
        uniform float fresnelBias;
        uniform float fresnelScale;
        uniform float fresnelPower;
        
        // Fresnel calculation function
        float calculateFresnel(vec3 viewDir, vec3 normal) {
          return fresnelBias + fresnelScale * pow(1.0 + dot(viewDir, normal), fresnelPower);
        }
        `
      );
      
      // Add X-ray effect
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `
        // Calculate view-dependent transparency (fresnel effect)
        float fresnel = calculateFresnel(normalize(-vViewPosition), normal);
        float opacity = mix(diffuseColor.a * 0.3, diffuseColor.a, fresnel * effectStrength);
        
        // Add subtle pulse
        float pulse = 0.9 + 0.1 * sin(time * 2.0);
        
        // Apply X-ray style effect
        outgoingLight *= fresnel * effectStrength * pulse;
        
        gl_FragColor = vec4(outgoingLight, opacity);
        `
      );
    };
    
    return material;
  }
  
  /**
   * Create a material with ambient occlusion effect
   * @private
   * @param {Object} options - Material options
   * @returns {THREE.MeshStandardMaterial} Material with ambient occlusion effect
   */
  _createAmbientMaterial(options) {
    // Create base material
    const material = new THREE.MeshStandardMaterial({
      color: options.color || new THREE.Color(0xffffff),
      roughness: options.roughness !== undefined ? options.roughness : 0.8,
      metalness: options.metalness !== undefined ? options.metalness : 0.1,
      transparent: options.transparent || false,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      side: options.side || THREE.FrontSide
    });
    
    // Store original color
    material.userData.originalColor = options.color ? options.color.clone() : new THREE.Color(0xffffff);
    material.userData.effectStrength = 0.5;
    
    // Add custom shader modifications for ambient occlusion effect
    material.onBeforeCompile = (shader) => {
      // Store reference to shader
      material.userData.shader = shader;
      
      // Add custom uniforms
      shader.uniforms.effectStrength = this.uniforms.effectStrength;
      shader.uniforms.aoStrength = this.uniforms.aoStrength;
      
      // Add custom code to fragment shader for ambient occlusion effect
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        
        uniform float effectStrength;
        uniform float aoStrength;
        
        // Simple ambient occlusion estimator
        float estimateAO(vec3 pos, vec3 nor) {
          float aoRadius = 0.5;
          float delta = 0.4 * aoRadius;
          float occlusion = 0.0;
          
          // Use screen-space position to create simple AO
          float depth = length(pos);
          vec3 samplePos = pos + nor * delta;
          float sampleDepth = length(samplePos);
          
          // Accumulate AO based on depth difference
          occlusion = clamp(1.0 - (sampleDepth - depth) / aoRadius, 0.0, 1.0);
          
          return occlusion;
        }
        `
      );
      
      // Add ambient occlusion effect
      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `
        // Calculate simple ambient occlusion factor
        float ao = estimateAO(vViewPosition, normal);
        float aoFactor = mix(1.0, ao, aoStrength * effectStrength);
        
        // Apply ambient occlusion - darken in occluded areas
        outgoingLight *= aoFactor;
        
        gl_FragColor = vec4(outgoingLight, diffuseColor.a);
        `
      );
    };
    
    return material;
  }
  
  /**
   * Create a gradient texture for toon shading
   * @private
   * @param {number} steps - Number of gradient steps
   * @returns {THREE.Texture} Gradient texture
   */
  _createToonGradientTexture(steps) {
    // Create gradient texture data
    const data = new Uint8Array(steps * 4);
    const colorStep = 1.0 / (steps - 1);
    
    for (let i = 0; i < steps; i++) {
      const color = colorStep * i;
      
      data[i * 4] = Math.round(color * 255);
      data[i * 4 + 1] = Math.round(color * 255);
      data[i * 4 + 2] = Math.round(color * 255);
      data[i * 4 + 3] = 255;
    }
    
    // Create the texture
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
   * Clear material cache
   * @private
   */
  _clearMaterialCache() {
    // Dispose of all cached materials
    this.materialCache.forEach(material => {
      if (material.dispose) {
        material.dispose();
      }
    });
    
    // Clear cache
    this.materialCache.clear();
    this.activeMaterials.clear();
  }
  
  /**
   * Update the effect strength on a material
   * @param {THREE.Material} material - Material to update
   * @param {number} strength - Effect strength (0.0 - 1.0)
   */
  updateEffectStrength(material, strength) {
    if (!material) return;
    
    try {
      // Clamp strength to valid range
      const clampedStrength = Math.max(0.0, Math.min(1.0, strength));
      
      // Store effect strength in userData (for context recovery)
      material.userData.effectStrength = clampedStrength;
      
      // Update only if shader exists
      if (material.userData.shader && material.userData.shader.uniforms) {
        // Update the uniform on the specific shader
        if (material.userData.shader.uniforms.effectStrength) {
          material.userData.shader.uniforms.effectStrength.value = clampedStrength;
        }
      }
      
      // For toon materials, update gradient steps based on strength
      if (material.isMeshToonMaterial && material.userData.gradientMap) {
        // Only update gradient map if strength changes significantly
        const prevSteps = material.userData.lastSteps || 4;
        const newSteps = Math.max(2, Math.floor(2 + clampedStrength * 4));
        
        if (prevSteps !== newSteps) {
          material.gradientMap = this._createToonGradientTexture(newSteps);
          material.userData.gradientMap = material.gradientMap;
          material.userData.lastSteps = newSteps;
          material.needsUpdate = true;
        }
      }
      
      // For glow materials, update emissive intensity
      if (material.isMeshStandardMaterial && material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.1 + clampedStrength * 0.8;
        material.needsUpdate = true;
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
    try {
      // Update time uniform
      if (this.uniforms && this.uniforms.time) {
        this.uniforms.time.value = time;
      }
      
      // Update camera position for fresnel calculations
      if (this.renderer && this.renderer.userData && this.renderer.userData.camera) {
        const camera = this.renderer.userData.camera;
        if (this.uniforms.cameraPosition) {
          this.uniforms.cameraPosition.value.copy(camera.position);
        }
      }
    } catch (error) {
      console.warn('Error in shader update:', error);
    }
  }
  
  /**
   * Set shader type
   * @param {string} type - New shader type
   */
  setType(type) {
    if (this.type === type) return;
    
    this.type = type;
    
    // Clear material cache when changing shader type
    this._clearMaterialCache();
    
    // Reinitialize shaders
    this._initializeShaders();
    
    console.log(`Shader type changed to ${type}`);
  }
  
  /**
   * Register callback for context loss
   * @param {Function} callback - Function to call when context is lost
   */
  onLost(callback) {
    this.contextLostCallback = callback;
  }
  
  /**
   * Register callback for context restoration
   * @param {Function} callback - Function to call when context is restored
   */
  onRestored(callback) {
    this.contextRestoredCallback = callback;
  }
  
  /**
   * Check if this is a mobile device (for quality settings)
   * @private
   * @returns {boolean} True if this is likely a mobile device
   */
  _checkIfMobile() {
    return (
      typeof navigator !== 'undefined' && 
      (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
      )
    );
  }
  
  /**
   * Update shader quality based on performance
   * @param {string} quality - Quality level ('high', 'medium', or 'low')
   */
  setQuality(quality) {
    if (!['high', 'medium', 'low'].includes(quality)) {
      console.warn(`Invalid quality setting: ${quality}. Using 'medium' instead.`);
      quality = 'medium';
    }
    
    this.quality = quality;
    
    // Update quality-dependent parameters
    switch (quality) {
      case 'high':
        this.uniforms.fresnelPower.value = 2.5;
        this.uniforms.pulseSpeed.value = 2.0;
        this.uniforms.pulseStrength.value = 0.15;
        break;
        
      case 'medium':
        this.uniforms.fresnelPower.value = 2.0;
        this.uniforms.pulseSpeed.value = 1.5;
        this.uniforms.pulseStrength.value = 0.1;
        break;
        
      case 'low':
        this.uniforms.fresnelPower.value = 1.5;
        this.uniforms.pulseSpeed.value = 1.0;
        this.uniforms.pulseStrength.value = 0.05;
        break;
    }
    
    console.log(`Shader quality set to ${quality}`);
  }
  
  /**
   * Apply global shader update to all active materials
   * @param {Object} params - Parameters to update
   */
  updateGlobalParameters(params) {
    // Update uniforms
    if (params.fresnelBias !== undefined) this.uniforms.fresnelBias.value = params.fresnelBias;
    if (params.fresnelScale !== undefined) this.uniforms.fresnelScale.value = params.fresnelScale;
    if (params.fresnelPower !== undefined) this.uniforms.fresnelPower.value = params.fresnelPower;
    if (params.pulseSpeed !== undefined) this.uniforms.pulseSpeed.value = params.pulseSpeed;
    if (params.pulseStrength !== undefined) this.uniforms.pulseStrength.value = params.pulseStrength;
    if (params.outlineThickness !== undefined) this.uniforms.outlineThickness.value = params.outlineThickness;
    if (params.aoStrength !== undefined) this.uniforms.aoStrength.value = params.aoStrength;
    
    // Update outline color if provided
    if (params.outlineColor) {
      this.uniforms.outlineColor.value.copy(params.outlineColor);
    }
    
    // Update effect strength on all active materials if provided
    if (params.effectStrength !== undefined) {
      this.uniforms.effectStrength.value = params.effectStrength;
      
      // Apply to all active materials
      this.activeMaterials.forEach(material => {
        this.updateEffectStrength(material, params.effectStrength);
      });
    }
  }
  
  /**
   * Dispose of shader resources
   */
  dispose() {
    // Clear material cache
    this._clearMaterialCache();
    
    // Dispose of all uniforms with disposable properties
    Object.values(this.uniforms).forEach(uniform => {
      if (uniform.value && typeof uniform.value.dispose === 'function') {
        uniform.value.dispose();
      }
    });
    
    // Remove context listeners
    if (this.renderer && this.renderer.domElement) {
      // No direct way to remove these specific event listeners,
      // but they will be garbage collected when renderer is disposed
    }
    
    // Clear callbacks
    this.contextLostCallback = null;
    this.contextRestoredCallback = null;
    
    // Clear references
    this.renderer = null;
    this.uniforms = null;
  }
}
