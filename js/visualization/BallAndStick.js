/**
 * BallAndStick.js - Ball and stick protein visualization style
 * Represents atoms as spheres and bonds as cylinders
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class BallAndStick {
  /**
   * Create a new ball and stick visualization
   * @param {Object} options - Visualization options
   * @param {Object} options.proteinModel - Protein model to visualize
   * @param {string} options.colorScheme - Color scheme to use
   * @param {Object} options.shader - Shader to apply
   */
  constructor(options) {
    this.proteinModel = options.proteinModel;
    this.colorScheme = options.colorScheme || CONFIG.VISUALIZATION.DEFAULT_COLOR_SCHEME;
    this.shader = options.shader;
    
    // Configuration
    this.config = CONFIG.VISUALIZATION.BALL_STICK;
    
    // Parameters
    this.atomScale = this.config.ATOM_SCALE;
    this.bondScale = this.config.BOND_SCALE;
    this.segmentCount = this.config.SEGMENT_COUNT;
    this.showHydrogens = this.config.SHOW_HYDROGENS;
    
    // Create group for this visualization
    this.object = new THREE.Group();
    this.object.name = 'BallAndStick';
    
    // Create containers for geometry
    this.atomsGroup = new THREE.Group();
    this.atomsGroup.name = 'Atoms';
    this.bondsGroup = new THREE.Group();
    this.bondsGroup.name = 'Bonds';
    
    this.object.add(this.atomsGroup);
    this.object.add(this.bondsGroup);
    
    // Track created meshes
    this.atomMeshes = [];
    this.bondMeshes = [];
    
    // Effect strength
    this.effectStrength = 1.0;
  }
  
  /**
   * Create the visualization
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async create() {
    const useInstancing = this.config.INSTANCING_ENABLED && 
                         this._shouldUseInstancing();
    
    if (useInstancing) {
      await this._createWithInstancing();
    } else {
      await this._createStandard();
    }
    
    // Apply initial effect strength
    this.updateEffectStrength(this.effectStrength);
    
    return this.object;
  }
  
  /**
   * Create the visualization using instanced meshes
   * @private
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async _createWithInstancing() {
    return new Promise(resolve => {
      const atoms = this.proteinModel.atoms;
      const bonds = this.proteinModel.bonds;
      
      // Skip hydrogens if configured
      const filteredAtoms = this.showHydrogens
        ? atoms
        : atoms.filter(atom => atom.element !== 'H');
      
      // Create shared sphere geometry for atoms
      const sphereGeometry = new THREE.SphereGeometry(
        1.0, // Base radius of 1, will be scaled per atom
        this.segmentCount,
        this.segmentCount
      );
      
      // Create shared cylinder geometry for bonds
      const cylinderGeometry = new THREE.CylinderGeometry(
        1.0, // Base radius of 1, will be scaled
        1.0,
        1.0, // Base height of 1, will be scaled
        this.segmentCount,
        1, // heightSegments
        false // openEnded
      );
      
      // Rotate cylinder to align with Y axis
      cylinderGeometry.rotateX(Math.PI / 2);
      
      // Create instanced materials for atoms (one per color)
      const colorMap = new Map();
      
      // Process atoms
      filteredAtoms.forEach(atom => {
        const color = this.proteinModel.getAtomColor(atom, this.colorScheme);
        const colorHex = '#' + color.getHexString();
        
        if (!colorMap.has(colorHex)) {
          // Create new material for this color
          const material = this._createMaterial(color);
          
          colorMap.set(colorHex, {
            color,
            material,
            atoms: []
          });
        }
        
        // Add atom to its color group
        colorMap.get(colorHex).atoms.push(atom);
      });
      
      // Create instanced meshes for each color
      colorMap.forEach(({ color, material, atoms }) => {
        // Create instanced mesh
        const instancedMesh = new THREE.InstancedMesh(
          sphereGeometry,
          material,
          atoms.length
        );
        
        instancedMesh.name = `Atoms_${color.getHexString()}`;
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        
        // Set instance matrices and colors
        const matrix = new THREE.Matrix4();
        
        atoms.forEach((atom, i) => {
          // Calculate scale based on element
          const scale = atom.radius * this.atomScale;
          
          // Set position and scale
          matrix.makeScale(scale, scale, scale);
          matrix.setPosition(
            atom.position.x - this.proteinModel.centerOfMass.x,
            atom.position.y - this.proteinModel.centerOfMass.y,
            atom.position.z - this.proteinModel.centerOfMass.z
          );
          
          instancedMesh.setMatrixAt(i, matrix);
          instancedMesh.setColorAt(i, color);
        });
        
        // Update instance matrices
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        // Add to atoms group
        this.atomsGroup.add(instancedMesh);
        this.atomMeshes.push(instancedMesh);
      });
      
      // Process bonds
      const bondInstances = [];
      
      bonds.forEach(bond => {
        const atom1 = atoms[bond.atomIndex1];
        const atom2 = atoms[bond.atomIndex2];
        
        // Skip bonds to hydrogen if configured
        if (!this.showHydrogens && 
            (atom1.element === 'H' || atom2.element === 'H')) {
          return;
        }
        
        // Get positions
        const pos1 = new THREE.Vector3(
          atom1.position.x - this.proteinModel.centerOfMass.x,
          atom1.position.y - this.proteinModel.centerOfMass.y,
          atom1.position.z - this.proteinModel.centerOfMass.z
        );
        
        const pos2 = new THREE.Vector3(
          atom2.position.x - this.proteinModel.centerOfMass.x,
          atom2.position.y - this.proteinModel.centerOfMass.y,
          atom2.position.z - this.proteinModel.centerOfMass.z
        );
        
        // Calculate bond properties
        const bondLength = pos1.distanceTo(pos2);
        const bondMidpoint = pos1.clone().add(pos2).multiplyScalar(0.5);
        
        // Get colors
        const color1 = this.proteinModel.getAtomColor(atom1, this.colorScheme);
        const color2 = this.proteinModel.getAtomColor(atom2, this.colorScheme);
        
        // For now, use the average color for bonds
        const bondColor = color1.clone().lerp(color2, 0.5);
        
        // Add to bond instances
        bondInstances.push({
          start: pos1,
          end: pos2,
          length: bondLength,
          midpoint: bondMidpoint,
          color: bondColor
        });
      });
      
      // Create instanced mesh for bonds
      if (bondInstances.length > 0) {
        const bondMaterial = this._createMaterial(new THREE.Color(0x808080));
        const bondInstancedMesh = new THREE.InstancedMesh(
          cylinderGeometry,
          bondMaterial,
          bondInstances.length
        );
        
        bondInstancedMesh.name = 'Bonds';
        bondInstancedMesh.castShadow = true;
        bondInstancedMesh.receiveShadow = true;
        
        // Set instance matrices and colors
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        
        bondInstances.forEach((bond, i) => {
          // Calculate direction and orientation
          const direction = bond.end.clone().sub(bond.start).normalize();
          
          // Rotation to align with bond direction
          quaternion.setFromUnitVectors(up, direction);
          
          // Scale
          const scale = this.bondScale;
          
          // Set transform
          matrix.compose(
            bond.midpoint,
            quaternion,
            new THREE.Vector3(scale, bond.length, scale)
          );
          
          bondInstancedMesh.setMatrixAt(i, matrix);
          bondInstancedMesh.setColorAt(i, bond.color);
        });
        
        // Update instance matrices
        bondInstancedMesh.instanceMatrix.needsUpdate = true;
        
        // Add to bonds group
        this.bondsGroup.add(bondInstancedMesh);
        this.bondMeshes.push(bondInstancedMesh);
      }
      
      resolve();
    });
  }
  
  /**
   * Create the visualization using standard meshes (for older GPUs)
   * @private
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async _createStandard() {
    return new Promise(resolve => {
      const atoms = this.proteinModel.atoms;
      const bonds = this.proteinModel.bonds;
      
      // Skip hydrogens if configured
      const filteredAtoms = this.showHydrogens
        ? atoms
        : atoms.filter(atom => atom.element !== 'H');
      
      // Create shared geometries
      const sphereGeometries = {};
      const cylinderGeometry = new THREE.CylinderGeometry(
        this.bondScale,
        this.bondScale,
        1, // Will be scaled later
        this.segmentCount,
        1,
        false
      );
      
      // Rotate cylinder to align with Y axis
      cylinderGeometry.rotateX(Math.PI / 2);
      
      // Process atoms
      filteredAtoms.forEach(atom => {
        // Calculate atom radius based on element
        const radius = atom.radius * this.atomScale;
        
        // Create or reuse sphere geometry
        if (!sphereGeometries[atom.element]) {
          sphereGeometries[atom.element] = new THREE.SphereGeometry(
            radius,
            this.segmentCount,
            this.segmentCount
          );
        }
        
        // Get color
        const color = this.proteinModel.getAtomColor(atom, this.colorScheme);
        
        // Create material
        const material = this._createMaterial(color);
        
        // Create mesh
        const mesh = new THREE.Mesh(sphereGeometries[atom.element], material);
        mesh.position.set(
          atom.position.x - this.proteinModel.centerOfMass.x,
          atom.position.y - this.proteinModel.centerOfMass.y,
          atom.position.z - this.proteinModel.centerOfMass.z
        );
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Add to atoms group
        this.atomsGroup.add(mesh);
        this.atomMeshes.push(mesh);
      });
      
      // Process bonds
      bonds.forEach(bond => {
        const atom1 = atoms[bond.atomIndex1];
        const atom2 = atoms[bond.atomIndex2];
        
        // Skip bonds to hydrogen if configured
        if (!this.showHydrogens && 
            (atom1.element === 'H' || atom2.element === 'H')) {
          return;
        }
        
        // Get positions
        const pos1 = new THREE.Vector3(
          atom1.position.x - this.proteinModel.centerOfMass.x,
          atom1.position.y - this.proteinModel.centerOfMass.y,
          atom1.position.z - this.proteinModel.centerOfMass.z
        );
        
        const pos2 = new THREE.Vector3(
          atom2.position.x - this.proteinModel.centerOfMass.x,
          atom2.position.y - this.proteinModel.centerOfMass.y,
          atom2.position.z - this.proteinModel.centerOfMass.z
        );
        
        // Calculate bond properties
        const bondLength = pos1.distanceTo(pos2);
        const bondCenter = pos1.clone().add(pos2).multiplyScalar(0.5);
        
        // Get colors
        const color1 = this.proteinModel.getAtomColor(atom1, this.colorScheme);
        const color2 = this.proteinModel.getAtomColor(atom2, this.colorScheme);
        
        // For now, use the average color for bonds
        const bondColor = color1.clone().lerp(color2, 0.5);
        
        // Create material
        const material = this._createMaterial(bondColor);
        
        // Create mesh
        const mesh = new THREE.Mesh(cylinderGeometry.clone(), material);
        
        // Position and scale
        mesh.position.copy(bondCenter);
        mesh.scale.set(1, bondLength, 1);
        
        // Orient along bond direction
        const direction = pos2.clone().sub(pos1).normalize();
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        mesh.quaternion.copy(quaternion);
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Add to bonds group
        this.bondsGroup.add(mesh);
        this.bondMeshes.push(mesh);
      });
      
      resolve();
    });
  }
  
  /**
   * Create a material for an atom or bond
   * @private
   * @param {THREE.Color} color - Color for the material
   * @returns {THREE.Material} Material
   */
  _createMaterial(color) {
    if (this.shader && this.shader.getMaterial) {
      // Use shader manager's material
      return this.shader.getMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.4
      });
    }
    
    // Fallback to standard material
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.4,
      metalness: 0.4
    });
  }
  
  /**
   * Determine if instancing should be used
   * @private
   * @returns {boolean} True if instancing should be used
   */
  _shouldUseInstancing() {
    // Check if hardware supports instancing
    if (!CONFIG.CAPABILITIES.instancedArrays) {
      return false;
    }
    
    // Check if enough atoms to benefit
    const atomCount = this.showHydrogens
      ? this.proteinModel.atoms.length
      : this.proteinModel.atoms.filter(atom => atom.element !== 'H').length;
    
    return atomCount >= CONFIG.PERFORMANCE.INSTANCING_THRESHOLD;
  }
  
  /**
   * Update the color scheme
   * @param {string} colorScheme - New color scheme
   */
  updateColorScheme(colorScheme) {
    this.colorScheme = colorScheme;
    
    // Remove existing visualization and recreate
    this._disposeGeometry();
    
    this.atomsGroup.clear();
    this.bondsGroup.clear();
    
    this.atomMeshes = [];
    this.bondMeshes = [];
    
    this.create();
  }
  
  /**
   * Update the shader
   * @param {Object} shader - New shader
   */
  updateShader(shader) {
    this.shader = shader;
    
    // Remove existing visualization and recreate
    this._disposeGeometry();
    
    this.atomsGroup.clear();
    this.bondsGroup.clear();
    
    this.atomMeshes = [];
    this.bondMeshes = [];
    
    this.create();
  }
  
  /**
   * Update effect strength
   * @param {number} strength - Effect strength (0.0 - 1.0)
   */
  updateEffectStrength(strength) {
    this.effectStrength = strength;
    
    // Apply to shader if available
    if (this.shader && this.shader.updateEffectStrength) {
      // Apply to all materials
      [...this.atomMeshes, ...this.bondMeshes].forEach(mesh => {
        if (mesh.material) {
          this.shader.updateEffectStrength(mesh.material, strength);
        }
      });
    }
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this._disposeGeometry();
  }
  
  /**
   * Dispose of geometry and materials
   * @private
   */
  _disposeGeometry() {
    // Dispose of atoms meshes
    this.atomMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    
    // Dispose of bond meshes
    this.bondMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }
}
