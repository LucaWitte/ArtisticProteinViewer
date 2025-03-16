/**
 * Scene.js - Three.js scene configuration and management
 * Handles scene creation, lighting setup, and object management
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class Scene {
  /**
   * Create a new Three.js scene with standard lighting
   * @param {Object} options - Scene configuration
   * @param {string} [options.backgroundColor=#000000] - Background color
   * @param {number} [options.ambientLightIntensity=0.4] - Ambient light intensity
   * @param {number} [options.directionalLightIntensity=0.8] - Directional light intensity
   */
  constructor(options = {}) {
    this.options = {
      backgroundColor: options.backgroundColor || CONFIG.SCENE.BACKGROUND_COLOR,
      ambientLightIntensity: options.ambientLightIntensity || CONFIG.SCENE.AMBIENT_LIGHT_INTENSITY,
      directionalLightIntensity: options.directionalLightIntensity || CONFIG.SCENE.DIRECTIONAL_LIGHT_INTENSITY
    };
    
    // Create the scene
    this._createScene();
    
    // Setup lighting
    this._setupLighting();
  }
  
  /**
   * Create the Three.js scene
   * @private
   */
  _createScene() {
    this.scene = new THREE.Scene();
    
    // Set background color
    this.scene.background = new THREE.Color(this.options.backgroundColor);
    
    // Add fog if enabled in config
    if (CONFIG.SCENE.FOG_ENABLED) {
      this.scene.fog = new THREE.Fog(
        CONFIG.SCENE.FOG_COLOR,
        CONFIG.SCENE.FOG_NEAR,
        CONFIG.SCENE.FOG_FAR
      );
    }
  }
  
  /**
   * Setup standard lighting for molecular visualization
   * @private
   */
  _setupLighting() {
    // Add ambient light for general illumination
    this.ambientLight = new THREE.AmbientLight(
      0xffffff,
      this.options.ambientLightIntensity
    );
    this.scene.add(this.ambientLight);
    
    // Add directional light for shadows and highlights
    this.directionalLight = new THREE.DirectionalLight(
      0xffffff,
      this.options.directionalLightIntensity
    );
    this.directionalLight.position.set(1, 1, 1).normalize();
    this.directionalLight.castShadow = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
    
    // Configure shadow properties if enabled
    if (CONFIG.RENDERER.SHADOW_MAP_ENABLED) {
      this.directionalLight.shadow.mapSize.width = 2048;
      this.directionalLight.shadow.mapSize.height = 2048;
      this.directionalLight.shadow.camera.near = 0.5;
      this.directionalLight.shadow.camera.far = 500;
      this.directionalLight.shadow.bias = -0.0001;
    }
    
    this.scene.add(this.directionalLight);
    
    // Add a softer directional light from the opposite direction for fill
    this.fillLight = new THREE.DirectionalLight(
      0xffffff,
      this.options.directionalLightIntensity * 0.5
    );
    this.fillLight.position.set(-1, -0.5, -1).normalize();
    this.scene.add(this.fillLight);
    
    // Add a subtle rim light for edge highlighting
    this.rimLight = new THREE.DirectionalLight(
      0xffffff,
      this.options.directionalLightIntensity * 0.3
    );
    this.rimLight.position.set(0, 0, -1).normalize();
    this.scene.add(this.rimLight);
  }
  
  /**
   * Add an object to the scene
   * @param {THREE.Object3D} object - The object to add
   * @returns {THREE.Object3D} The added object
   */
  add(object) {
    this.scene.add(object);
    return object;
  }
  
  /**
   * Remove an object from the scene
   * @param {THREE.Object3D} object - The object to remove
   */
  remove(object) {
    this.scene.remove(object);
  }
  
  /**
   * Set background color
   * @param {string} color - Color in hex format (#RRGGBB)
   */
  setBackgroundColor(color) {
    this.scene.background = new THREE.Color(color);
    
    // Update fog color if fog is enabled
    if (CONFIG.SCENE.FOG_ENABLED && this.scene.fog) {
      this.scene.fog.color = new THREE.Color(color);
    }
  }
  
  /**
   * Set ambient light intensity
   * @param {number} intensity - Light intensity (0.0 - 1.0)
   */
  setAmbientLightIntensity(intensity) {
    this.ambientLight.intensity = intensity;
  }
  
  /**
   * Set directional light intensity
   * @param {number} intensity - Light intensity (0.0 - 1.0)
   */
  setDirectionalLightIntensity(intensity) {
    this.directionalLight.intensity = intensity;
    this.fillLight.intensity = intensity * 0.5;
    this.rimLight.intensity = intensity * 0.3;
  }
  
  /**
   * Enable or disable fog
   * @param {boolean} enabled - Whether fog should be enabled
   * @param {Object} [options] - Fog options
   * @param {string} [options.color] - Fog color
   * @param {number} [options.near] - Fog near distance
   * @param {number} [options.far] - Fog far distance
   */
  setFogEnabled(enabled, options = {}) {
    if (enabled) {
      const color = options.color || CONFIG.SCENE.FOG_COLOR;
      const near = options.near || CONFIG.SCENE.FOG_NEAR;
      const far = options.far || CONFIG.SCENE.FOG_FAR;
      
      this.scene.fog = new THREE.Fog(color, near, far);
    } else {
      this.scene.fog = null;
    }
  }
  
  /**
   * Set the scene to display an HDRI environment
   * @param {string} url - URL to the HDRI image
   * @param {number} [intensity=1.0] - Environment map intensity
   * @returns {Promise<void>} Promise that resolves when the environment is loaded
   */
  async setEnvironmentMap(url, intensity = 1.0) {
    return new Promise((resolve, reject) => {
      // Load the environment map using THREE.RGBELoader
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();
      
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          this.scene.environment = envMap;
          this.scene.background = envMap;
          
          // Set environment map intensity
          this.scene.environmentIntensity = intensity;
          
          // Clean up
          texture.dispose();
          pmremGenerator.dispose();
          
          resolve();
        },
        undefined,
        reject
      );
    });
  }
  
  /**
   * Dispose of scene resources
   * Important for memory management when destroying the scene
   */
  dispose() {
    // Recursively dispose of materials and geometries
    this.scene.traverse(object => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => this._disposeMaterial(material));
        } else {
          this._disposeMaterial(object.material);
        }
      }
    });
    
    // Clear scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }
  
  /**
   * Helper to dispose of material resources
   * @private
   * @param {THREE.Material} material - The material to dispose
   */
  _disposeMaterial(material) {
    // Dispose of material properties
    for (const key in material) {
      const value = material[key];
      if (value && typeof value.dispose === 'function') {
        value.dispose();
      }
    }
    material.dispose();
  }
  
  /**
   * Get the Three.js Scene instance
   * @returns {THREE.Scene} The Three.js scene
   */
  get instance() {
    return this.scene;
  }
}
