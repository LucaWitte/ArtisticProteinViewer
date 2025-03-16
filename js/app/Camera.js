/**
 * Camera.js - Three.js camera configuration and management
 * Handles camera creation, positioning, and view adjustments
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class Camera {
  /**
   * Create a new Three.js camera
   * @param {Object} options - Camera configuration options
   * @param {number} [options.fov=45] - Field of view (degrees)
   * @param {number} [options.near=0.1] - Near clipping plane
   * @param {number} [options.far=10000] - Far clipping plane
   * @param {Array<number>} [options.position=[0,0,50]] - Initial camera position [x,y,z]
   */
  constructor(options = {}) {
    this.options = {
      fov: options.fov || CONFIG.CAMERA.FOV,
      near: options.near || CONFIG.CAMERA.NEAR,
      far: options.far || CONFIG.CAMERA.FAR,
      position: options.position || CONFIG.CAMERA.POSITION
    };
    
    // Calculate initial aspect ratio
    this.aspect = window.innerWidth / window.innerHeight;
    
    // Create the camera
    this._createCamera();
  }
  
  /**
   * Create a PerspectiveCamera
   * @private
   */
  _createCamera() {
    // Create perspective camera
    this.camera = new THREE.PerspectiveCamera(
      this.options.fov,
      this.aspect,
      this.options.near,
      this.options.far
    );
    
    // Set initial position
    this.camera.position.set(
      this.options.position[0],
      this.options.position[1],
      this.options.position[2]
    );
    
    // Look at center by default
    this.camera.lookAt(0, 0, 0);
  }
  
  /**
   * Update camera aspect ratio based on container size
   * @param {number} width - Container width
   * @param {number} height - Container height
   */
  updateAspect(width, height) {
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }
  
  /**
   * Set camera position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   */
  setPosition(x, y, z) {
    this.camera.position.set(x, y, z);
  }
  
  /**
   * Set camera target/look-at point
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   */
  setTarget(x, y, z) {
    this.camera.lookAt(x, y, z);
  }
  
  /**
   * Set field of view
   * @param {number} fov - Field of view in degrees
   */
  setFOV(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
  
  /**
   * Zoom the camera to fit a bounding box
   * @param {THREE.Box3} boundingBox - Bounding box to fit in view
   * @param {number} [padding=1.2] - Padding factor (1.0 = no padding)
   */
  fitToBox(boundingBox, padding = 1.2) {
    if (!boundingBox) {
      console.warn('Cannot fit camera to undefined bounding box');
      return;
    }
    
    // Create a sphere around the bounding box
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    // Get the bounding sphere
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    
    // Calculate the required distance
    let distance = (maxDim / 2) / Math.tan(fov / 2);
    
    // Apply padding factor
    distance *= padding;
    
    // Position the camera to look at the center of the box from a distance
    const direction = new THREE.Vector3(0, 0, 1);
    direction.normalize();
    
    const position = new THREE.Vector3();
    position.copy(center).add(direction.multiplyScalar(distance));
    
    // Update camera
    this.setPosition(position.x, position.y, position.z);
    this.setTarget(center.x, center.y, center.z);
  }
  
  /**
   * Get camera position vector
   * @returns {THREE.Vector3} Camera position
   */
  getPosition() {
    return this.camera.position.clone();
  }
  
  /**
   * Get camera's viewing direction
   * @returns {THREE.Vector3} Camera direction
   */
  getDirection() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }
  
  /**
   * Get the Three.js Camera instance
   * @returns {THREE.PerspectiveCamera} The Three.js camera
   */
  get instance() {
    return this.camera;
  }
}
