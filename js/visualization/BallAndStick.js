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
    
    // Shared geometries for reuse
    this.sharedGeometries = {};
  }
  
  /**
   * Create the visualization
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async create() {
    try {
      // Check if protein data exists
      if (!this.proteinModel || !this.proteinModel.atoms || this.proteinModel.atoms.length === 0) {
        console.warn('No protein data available for BallAndStick visualization');
        return this.object;
      }
      
      // Determine which method to use based on system capabilities and protein size
      const useInstancing = this.config.INSTANCING_ENABLED && 
                           this._shouldUseInstancing();
      
      // Create shared geometries once
      this._createSharedGeometries();
      
      // Choose creation method based on capabilities
      if (useInstancing) {
        // Break large proteins into chunks to prevent context loss
        await this._createWithChunkedInstancing();
      } else {
        await this._createStandard();
      }
      
      // Apply initial effect strength
      this.updateEffectStrength(this.effectStrength);
      
      return this.object;
    } catch (error) {
      console.error('Error creating Ball and Stick visualization:', error);
      // Create a minimal representation as fallback
      this._createFallbackVisualization();
      return this.object;
    }
  }
  
  /**
   * Create shared geometries for reuse
   * @private
   */
  _createSharedGeometries() {
    // Create low-poly sphere geometry for atoms (reused for all atoms)
    this.sharedGeometries.sphere = new THREE.SphereGeometry(
      1.0, // Base radius of 1, will be scaled per atom
      this.segmentCount,
      this.segmentCount / 2 // Reduce segments for better performance
    );
    
    // Create cylinder geometry for bonds (reused for all bonds)
    this.sharedGeometries.cylinder = new THREE.CylinderGeometry(
      1.0, // Base radius of 1, will be scaled
      1.0,
      1.0, // Base height of 1, will be scaled
      Math.max(6, this.segmentCount / 2), // Reduce segments for better performance
      1, // heightSegments
      false // openEnded
    );
    
    // Rotate cylinder to align with Y axis
    this.sharedGeometries.cylinder.rotateX(Math.PI / 2);
  }
  
  /**
   * Create visualization with instancing, but in smaller chunks to prevent context loss
   * @private
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async _createWithChunkedInstancing() {
    return new Promise(resolve => {
      const atoms = this.proteinModel.atoms;
      const bonds = this.proteinModel.bonds;
      
      // Skip hydrogens if configured
      const filteredAtoms = this.showHydrogens
        ? atoms
        : atoms.filter(atom => atom.element !== 'H');
      
      // Group atoms by element for efficient rendering
      const atomsByElement = {};
      filteredAtoms.forEach(atom => {
        const element = atom.element;
        if (!atomsByElement[element]) {
          atomsByElement[element] = [];
        }
        atomsByElement[element].push(atom);
      });
      
      // Process atom groups in manageable chunks
      const CHUNK_SIZE = 1000; // Process atoms in chunks of 1000
      
      // Process each element type
      Object.entries(atomsByElement).forEach(([element, elementAtoms]) => {
        // Get color for this element
        const color = this.proteinModel.getAtomColor(elementAtoms[0], this.colorScheme);
        
        // Get number of chunks needed
        const numChunks = Math.ceil(elementAtoms.length / CHUNK_SIZE);
        
        // Process each chunk
        for (let i = 0; i < numChunks; i++) {
          const startIdx = i * CHUNK_SIZE;
          const endIdx = Math.min((i + 1) * CHUNK_SIZE, elementAtoms.length);
          const chunkAtoms = elementAtoms.slice(startIdx, endIdx);
          
          // Create material
          const material = this._createMaterial(color);
          
          // Use instancing for this chunk
          const instancedMesh = new THREE.InstancedMesh(
            this.sharedGeometries.sphere,
            material,
            chunkAtoms.length
          );
          
          instancedMesh.name = `Atoms_${element}_${i}`;
          instancedMesh.castShadow = true;
          instancedMesh.receiveShadow = true;
          
          // Set instance matrices
          const matrix = new THREE.Matrix4();
          
          chunkAtoms.forEach((atom, idx) => {
            // Calculate scale based on element
            const scale = atom.radius * this.atomScale;
            
            // Set position and scale
            matrix.makeScale(scale, scale, scale);
            matrix.setPosition(
              atom.position.x - this.proteinModel.centerOfMass.x,
              atom.position.y - this.proteinModel.centerOfMass.y,
              atom.position.z - this.proteinModel.centerOfMass.z
            );
            
            instancedMesh.setMatrixAt(idx, matrix);
          });
          
          // Update instance matrices
          instancedMesh.instanceMatrix.needsUpdate = true;
          
          // Add to atoms group
          this.atomsGroup.add(instancedMesh);
          this.atomMeshes.push(instancedMesh);
        }
      });
      
      // Process bonds in chunks too
      const BOND_CHUNK_SIZE = 1000;
      const numBondChunks = Math.ceil(bonds.length / BOND_CHUNK_SIZE);
      
      for (let i = 0; i < numBondChunks; i++) {
        const startIdx = i * BOND_CHUNK_SIZE;
        const endIdx = Math.min((i + 1) * BOND_CHUNK_SIZE, bonds.length);
        const chunkBonds = bonds.slice(startIdx, endIdx);
        
        // Filter bonds to skip hydrogen bonds if needed
        const filteredBonds = this.showHydrogens 
          ? chunkBonds 
          : chunkBonds.filter(bond => {
              const atom1 = atoms[bond.atomIndex1];
              const atom2 = atoms[bond.atomIndex2];
              return atom1.element !== 'H' && atom2.element !== 'H';
            });
        
        if (filteredBonds.length === 0) continue;
        
        // Create one instanced mesh for this chunk of bonds
        const bondInstancedMesh = new THREE.InstancedMesh(
          this.sharedGeometries.cylinder,
          this._createMaterial(new THREE.Color(0x808080)),
          filteredBonds.length
        );
        
        bondInstancedMesh.name = `Bonds_${i}`;
        bondInstancedMesh.castShadow = true;
        bondInstancedMesh.receiveShadow = true;
        
        // Set instance matrices and colors
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        
        filteredBonds.forEach((bond, idx) => {
          const atom1 = atoms[bond.atomIndex1];
          const atom2 = atoms[bond.atomIndex2];
          
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
          const bondVector = pos2.clone().sub(pos1);
          const bondLength = bondVector.length();
          const bondCenter = pos1.clone().add(pos2).multiplyScalar(0.5);
          
          // Create direction vector
          const direction = bondVector.normalize();
          
          // Calculate rotation to align with bond direction
          quaternion.setFromUnitVectors(up, direction);
          
          // Set transform
          matrix.compose(
            bondCenter,
            quaternion,
            new THREE.Vector3(this.bondScale, bondLength, this.bondScale)
          );
          
          bondInstancedMesh.setMatrixAt(idx, matrix);
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
      
      // Process only a subset of atoms if there are too many (for performance)
      const MAX_ATOMS = 10000;
      let atomsToProcess = filteredAtoms;
      
      if (filteredAtoms.length > MAX_ATOMS) {
        console.warn(`Too many atoms (${filteredAtoms.length}), rendering a subset of ${MAX_ATOMS}`);
        
        // Try to select evenly distributed atoms
        const stride = Math.ceil(filteredAtoms.length / MAX_ATOMS);
        atomsToProcess = [];
        
        for (let i = 0; i < filteredAtoms.length; i += stride) {
          atomsToProcess.push(filteredAtoms[i]);
        }
      }
      
      // Group atoms by element for shared materials
      const materialCache = {};
      
      // Process atoms
      atomsToProcess.forEach(atom => {
        // Get color
        const color = this.proteinModel.getAtomColor(atom, this.colorScheme);
        const colorHex = color.getHexString();
        
        // Use cached material if available
        if (!materialCache[colorHex]) {
          materialCache[colorHex] = this._createMaterial(color);
        }
        
        // Calculate atom radius based on element
        const radius = atom.radius * this.atomScale;
        
        // Create mesh
        const mesh = new THREE.Mesh(
          this.sharedGeometries.sphere.clone(),
          materialCache[colorHex]
        );
        
        // Scale by radius
        mesh.scale.set(radius, radius, radius);
        
        // Position
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
      
      // Limit the number of bonds for performance
      const MAX_BONDS = 15000;
      let bondsToProcess = this.showHydrogens
        ? bonds
        : bonds.filter(bond => {
            const atom1 = atoms[bond.atomIndex1];
            const atom2 = atoms[bond.atomIndex2];
            return atom1.element !== 'H' && atom2.element !== 'H';
          });
      
      if (bondsToProcess.length > MAX_BONDS) {
        console.warn(`Too many bonds (${bondsToProcess.length}), rendering a subset of ${MAX_BONDS}`);
        
        // Try to select evenly distributed bonds
        const stride = Math.ceil(bondsToProcess.length / MAX_BONDS);
        const tempBonds = [];
        
        for (let i = 0; i < bondsToProcess.length; i += stride) {
          tempBonds.push(bondsToProcess[i]);
        }
        
        bondsToProcess = tempBonds;
      }
      
      // Create shared bond material
      const bondMaterial = this._createMaterial(new THREE.Color(0x808080));
      
      // Process bonds
      bondsToProcess.forEach(bond => {
        const atom1 = atoms[bond.atomIndex1];
        const atom2 = atoms[bond.atomIndex2];
        
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
        const bondVector = pos2.clone().sub(pos1);
        const bondLength = bondVector.length();
        const bondCenter = pos1.clone().add(pos2).multiplyScalar(0.5);
        
        // Create bond mesh
        const mesh = new THREE.Mesh(this.sharedGeometries.cylinder.clone(), bondMaterial);
        
        // Position and scale
        mesh.position.copy(bondCenter);
        mesh.scale.set(this.bondScale, bondLength, this.bondScale);
        
        // Orient along bond direction
        const direction = bondVector.normalize();
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
   * Create a minimal fallback visualization when normal creation fails
   * @private
   */
  _createFallbackVisualization() {
    console.log('Creating fallback ball and stick visualization');
    
    try {
      const atoms = this.proteinModel.atoms;
      
      // Take only a small subset of atoms for the fallback
      const MAX_FALLBACK_ATOMS = 500;
      const stride = Math.max(1, Math.floor(atoms.length / MAX_FALLBACK_ATOMS));
      
      // Create very low-poly sphere
      const lowPolySphere = new THREE.SphereGeometry(1, 8, 6);
      
      // Create shared material
      const material = new THREE.MeshBasicMaterial({ color: 0x3498db });
      
      // Add representative atoms
      for (let i = 0; i < atoms.length; i += stride) {
        const atom = atoms[i];
        
        // Create mesh
        const mesh = new THREE.Mesh(lowPolySphere, material);
        
        // Scale by radius
        const radius = atom.radius * this.atomScale;
        mesh.scale.set(radius, radius, radius);
        
        // Position
        mesh.position.set(
          atom.position.x - this.proteinModel.centerOfMass.x,
          atom.position.y - this.proteinModel.centerOfMass.y,
          atom.position.z - this.proteinModel.centerOfMass.z
        );
        
        // Add to atoms group
        this.atomsGroup.add(mesh);
        this.atomMeshes.push(mesh);
      }
    } catch (error) {
      console.error('Error creating fallback visualization:', error);
    }
  }
  
  /**
   * Create a material for an atom or bond
   * @private
   * @param {THREE.Color} color - Color for the material
   * @returns {THREE.Material} Material
   */
  _createMaterial(color) {
    if (this.shader && this.shader.getMaterial) {
      try {
        // Use shader manager's material
        return this.shader.getMaterial({
          color: color,
          roughness: 0.4,
          metalness: 0.4
        });
      } catch (error) {
        console.warn('Error creating shader material, falling back to standard material:', error);
      }
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
    if (this.colorScheme === colorScheme) return;
    
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
    if (this.shader === shader) return;
    
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
      try {
        // Apply to all materials
        [...this.atomMeshes, ...this.bondMeshes].forEach(mesh => {
          if (mesh.material) {
            this.shader.updateEffectStrength(mesh.material, strength);
          }
        });
      } catch (error) {
        console.warn('Error updating effect strength:', error);
      }
    }
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this._disposeGeometry();
    
    // Also dispose of shared geometries
    if (this.sharedGeometries) {
      Object.values(this.sharedGeometries).forEach(geometry => {
        if (geometry && geometry.dispose) {
          geometry.dispose();
        }
      });
      this.sharedGeometries = {};
    }
  }
  
  /**
   * Dispose of geometry and materials
   * @private
   */
  _disposeGeometry() {
    // Dispose of atoms meshes
    this.atomMeshes.forEach(mesh => {
      if (mesh.geometry && mesh.geometry !== this.sharedGeometries.sphere) {
        mesh.geometry.dispose();
      }
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
      if (mesh.geometry && mesh.geometry !== this.sharedGeometries.cylinder) {
        mesh.geometry.dispose();
      }
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
