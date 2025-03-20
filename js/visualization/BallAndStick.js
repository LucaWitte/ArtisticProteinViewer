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
    
    // Parameters with more conservative defaults
    this.atomScale = this.config.ATOM_SCALE * 0.8; // Reduce atom size
    this.bondScale = this.config.BOND_SCALE * 0.8; // Reduce bond size
    this.segmentCount = Math.min(8, this.config.SEGMENT_COUNT); // Force lower polygon count
    this.showHydrogens = false; // Always hide hydrogens for performance
    
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
    
    // Set a limit on how many atoms we'll render
    this.MAX_ATOMS = 2000;
    this.MAX_BONDS = 3000;
    
    // Track creation state
    this.isCreating = false;
    this.creationFailed = false;
    this.creationPromise = null;
  }
  
  /**
   * Create the visualization
   * @returns {Promise<THREE.Group>} Promise that resolves to the visualization object
   */
  async create() {
    // Check if already creating
    if (this.isCreating) {
      return this.creationPromise;
    }
    
    // Create a promise and store it
    this.creationPromise = new Promise(async (resolve) => {
      this.isCreating = true;
      
      try {
        // Check if protein data exists
        if (!this.proteinModel || !this.proteinModel.atoms || this.proteinModel.atoms.length === 0) {
          console.warn('No protein data available for BallAndStick visualization');
          this.isCreating = false;
          resolve(this.object);
          return;
        }
        
        console.log(`Creating ball and stick visualization for ${this.proteinModel.atoms.length} atoms`);
        
        // Create shared geometries with lower polygon counts
        this._createSharedGeometries();
        
        // Use a phased approach for large proteins
        if (this.proteinModel.atoms.length > this.MAX_ATOMS) {
          await this._createLowResolutionVisualization();
        } else {
          // For small proteins, determine the best method
          const useInstancing = CONFIG.CAPABILITIES.instancedArrays && this._shouldUseInstancing();
          
          if (useInstancing) {
            await this._createWithChunkedInstancing();
          } else {
            await this._createStandard();
          }
        }
        
        // Apply initial effect strength
        this.updateEffectStrength(this.effectStrength);
        
        this.isCreating = false;
        resolve(this.object);
      } catch (error) {
        console.error('Error creating Ball and Stick visualization:', error);
        this.creationFailed = true;
        
        // Create a minimal representation as fallback
        this._createFallbackVisualization();
        
        this.isCreating = false;
        resolve(this.object);
      }
    });
    
    return this.creationPromise;
  }
  
  /**
   * Create shared geometries for reuse
   * @private
   */
  _createSharedGeometries() {
    try {
      // Create low-poly sphere geometry for atoms (reused for all atoms)
      // Use icosahedron for better performance at low polygon counts
      this.sharedGeometries.sphere = new THREE.IcosahedronGeometry(
        1.0, // Base radius of 1, will be scaled per atom
        1    // Low detail level (0 or 1 for best performance)
      );
      
      // Create cylinder geometry for bonds (reused for all bonds)
      this.sharedGeometries.cylinder = new THREE.CylinderGeometry(
        1.0, // Base radius of 1, will be scaled
        1.0,
        1.0, // Base height of 1, will be scaled
        6,   // Reduced radial segments
        1,   // Just 1 height segment
        false // Not open-ended
      );
      
      // Rotate cylinder to align with Y axis
      this.sharedGeometries.cylinder.rotateX(Math.PI / 2);
    } catch (error) {
      console.error('Error creating shared geometries:', error);
      
      // Create truly minimal backup geometries
      this.sharedGeometries.sphere = new THREE.IcosahedronGeometry(1.0, 0);
      this.sharedGeometries.cylinder = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 4, 1);
      this.sharedGeometries.cylinder.rotateX(Math.PI / 2);
    }
  }
  
  /**
   * Create a low-resolution visualization for large proteins
   * @private
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async _createLowResolutionVisualization() {
    return new Promise(resolve => {
      const atoms = this.proteinModel.atoms;
      
      // Take only a subset of atoms
      const stride = Math.max(1, Math.ceil(atoms.length / this.MAX_ATOMS));
      
      console.log(`Creating low-resolution visualization with stride ${stride} (${Math.floor(atoms.length / stride)} atoms)`);
      
      // Group atoms by element for batch creation and shared materials
      const elementGroups = {};
      
      // Select atoms with stride for better distribution
      for (let i = 0; i < atoms.length; i += stride) {
        const atom = atoms[i];
        if (!atom) continue;
        
        // Skip hydrogens
        if (atom.element === 'H') continue;
        
        // Group by element
        if (!elementGroups[atom.element]) {
          elementGroups[atom.element] = [];
        }
        elementGroups[atom.element].push(atom);
      }
      
      // Process each element group in batches
      const BATCH_SIZE = 500;
      let totalProcessed = 0;
      
      const processNextBatch = () => {
        // Get next element to process
        const elements = Object.keys(elementGroups);
        if (elements.length === 0) {
          // All done, process some bonds
          this._addRepresentativeBonds(atoms, stride * 2); // Use larger stride for bonds
          resolve();
          return;
        }
        
        const element = elements[0];
        const atomsToProcess = elementGroups[element].splice(0, BATCH_SIZE);
        
        if (elementGroups[element].length === 0) {
          delete elementGroups[element];
        }
        
        // Create a material for this element
        const color = this.proteinModel.getAtomColor(atomsToProcess[0], this.colorScheme);
        const material = this._createSimpleMaterial(color);
        
        // Create atoms for this batch
        atomsToProcess.forEach(atom => {
          // Calculate atom radius based on element
          const radius = atom.radius * this.atomScale;
          
          // Create mesh
          const mesh = new THREE.Mesh(
            this.sharedGeometries.sphere,
            material
          );
          
          // Scale by radius
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
          
          totalProcessed++;
        });
        
        // Process next batch on next frame to avoid blocking UI
        setTimeout(processNextBatch, 0);
      };
      
      // Start processing
      processNextBatch();
    });
  }
  
  /**
   * Add representative bonds to the visualization
   * @private
   * @param {Array} atoms - All atoms
   * @param {number} stride - Stride for selecting bonds
   */
  _addRepresentativeBonds(atoms, stride) {
    const bonds = this.proteinModel.bonds;
    
    // Cap the number of bonds
    const maxBonds = Math.min(bonds.length, this.MAX_BONDS);
    const bondStride = Math.max(1, Math.ceil(bonds.length / maxBonds));
    
    // Create a simple bond material
    const bondMaterial = this._createSimpleMaterial(new THREE.Color(0x808080));
    
    // Process a subset of bonds
    for (let i = 0; i < bonds.length; i += bondStride) {
      const bond = bonds[i];
      if (!bond) continue;
      
      const atom1 = atoms[bond.atomIndex1];
      const atom2 = atoms[bond.atomIndex2];
      
      // Skip if either atom doesn't exist
      if (!atom1 || !atom2) continue;
      
      // Skip bonds involving hydrogen
      if (atom1.element === 'H' || atom2.element === 'H') continue;
      
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
      const mesh = new THREE.Mesh(this.sharedGeometries.cylinder, bondMaterial);
      
      // Position and scale
      mesh.position.copy(bondCenter);
      mesh.scale.set(this.bondScale, bondLength, this.bondScale);
      
      // Orient along bond direction
      const direction = bondVector.normalize();
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      mesh.quaternion.copy(quaternion);
      
      // Add to bonds group
      this.bondsGroup.add(mesh);
      this.bondMeshes.push(mesh);
      
      // Limit the number of bonds
      if (this.bondMeshes.length >= this.MAX_BONDS) {
        break;
      }
    }
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
      
      // Skip hydrogens
      const filteredAtoms = atoms.filter(atom => atom.element !== 'H');
      
      console.log(`Creating instanced visualization for ${filteredAtoms.length} non-hydrogen atoms`);
      
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
      const CHUNK_SIZE = 500; // Much smaller chunks to avoid context loss
      
      // Limit total atoms for performance
      let totalAtoms = 0;
      const MAX_TOTAL_ATOMS = this.MAX_ATOMS;
      
      // Process each element type
      const processNextElement = () => {
        const elements = Object.keys(atomsByElement);
        if (elements.length === 0 || totalAtoms >= MAX_TOTAL_ATOMS) {
          // Now process bonds
          this._createBondChunks(bonds, atoms, resolve);
          return;
        }
        
        const element = elements[0];
        const elementAtoms = atomsByElement[element];
        delete atomsByElement[element];
        
        // Get color for this element
        const color = this.proteinModel.getAtomColor(elementAtoms[0], this.colorScheme);
        
        // Get number of chunks needed
        const numChunks = Math.ceil(elementAtoms.length / CHUNK_SIZE);
        
        // Process chunks
        for (let i = 0; i < numChunks; i++) {
          const startIdx = i * CHUNK_SIZE;
          const endIdx = Math.min((i + 1) * CHUNK_SIZE, elementAtoms.length);
          const chunkAtoms = elementAtoms.slice(startIdx, endIdx);
          
          if (totalAtoms + chunkAtoms.length > MAX_TOTAL_ATOMS) {
            // Hit the atom limit, move to bonds
            console.log(`Reached max atom limit of ${MAX_TOTAL_ATOMS}`);
            this._createBondChunks(bonds, atoms, resolve);
            return;
          }
          
          // Create material
          const material = this._createSimpleMaterial(color);
          
          try {
            // Use instancing for this chunk
            const instancedMesh = new THREE.InstancedMesh(
              this.sharedGeometries.sphere,
              material,
              chunkAtoms.length
            );
            
            instancedMesh.name = `Atoms_${element}_${i}`;
            instancedMesh.castShadow = false;
            instancedMesh.receiveShadow = false;
            
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
            
            totalAtoms += chunkAtoms.length;
          } catch (error) {
            console.error(`Error creating instanced chunk for ${element}:`, error);
            // Try non-instanced fallback if instancing fails
            this._createNonInstancedChunk(chunkAtoms, color);
            totalAtoms += chunkAtoms.length;
          }
        }
        
        // Process next element on next frame to avoid blocking
        setTimeout(processNextElement, 0);
      };
      
      // Start processing elements
      processNextElement();
    });
  }
  
  /**
   * Create bond chunks with instancing
   * @private
   * @param {Array} bonds - All bonds
   * @param {Array} atoms - All atoms
   * @param {Function} resolve - Promise resolve function
   */
  _createBondChunks(bonds, atoms, resolve) {
    // Filter bonds to skip hydrogen bonds
    const filteredBonds = bonds.filter(bond => {
      const atom1 = atoms[bond.atomIndex1];
      const atom2 = atoms[bond.atomIndex2];
      return atom1 && atom2 && atom1.element !== 'H' && atom2.element !== 'H';
    });
    
    console.log(`Creating instanced visualization for ${filteredBonds.length} bonds`);
    
    // Calculate how many bonds to actually render
    const maxBonds = Math.min(filteredBonds.length, this.MAX_BONDS);
    
    // Stride if we need to reduce
    const stride = Math.max(1, Math.ceil(filteredBonds.length / maxBonds));
    const bondsToRender = [];
    
    for (let i = 0; i < filteredBonds.length; i += stride) {
      bondsToRender.push(filteredBonds[i]);
    }
    
    // Process bonds in chunks
    const BOND_CHUNK_SIZE = 500;
    const numBondChunks = Math.ceil(bondsToRender.length / BOND_CHUNK_SIZE);
    
    let processedChunks = 0;
    
    const processNextBondChunk = () => {
      if (processedChunks >= numBondChunks) {
        // All done!
        resolve();
        return;
      }
      
      const startIdx = processedChunks * BOND_CHUNK_SIZE;
      const endIdx = Math.min((processedChunks + 1) * BOND_CHUNK_SIZE, bondsToRender.length);
      const chunkBonds = bondsToRender.slice(startIdx, endIdx);
      
      try {
        // Create one instanced mesh for this chunk of bonds
        const bondInstancedMesh = new THREE.InstancedMesh(
          this.sharedGeometries.cylinder,
          this._createSimpleMaterial(new THREE.Color(0x808080)),
          chunkBonds.length
        );
        
        bondInstancedMesh.name = `Bonds_${processedChunks}`;
        bondInstancedMesh.castShadow = false;
        bondInstancedMesh.receiveShadow = false;
        
        // Set instance matrices and colors
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        
        chunkBonds.forEach((bond, idx) => {
          const atom1 = atoms[bond.atomIndex1];
          const atom2 = atoms[bond.atomIndex2];
          
          if (!atom1 || !atom2) return;
          
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
          
          // Skip if bond is too long (probably an error)
          if (bondLength > 10) return;
          
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
      } catch (error) {
        console.error('Error creating instanced bonds chunk:', error);
        // Don't try fallback for bonds to save resources
      }
      
      processedChunks++;
      
      // Process next chunk
      setTimeout(processNextBondChunk, 0);
    };
    
    // Start processing bond chunks
    processNextBondChunk();
  }
  
  /**
   * Create a non-instanced chunk as fallback when instancing fails
   * @private
   * @param {Array} atoms - Atoms to render
   * @param {THREE.Color} color - Color for atoms
   */
  _createNonInstancedChunk(atoms, color) {
    // Create a material
    const material = this._createSimpleMaterial(color);
    
    // Take a subset if too many
    const MAX_SUBSET = 100;
    const stride = Math.max(1, Math.ceil(atoms.length / MAX_SUBSET));
    const subset = [];
    
    for (let i = 0; i < atoms.length; i += stride) {
      subset.push(atoms[i]);
    }
    
    // Create meshes
    subset.forEach(atom => {
      // Calculate atom radius
      const radius = atom.radius * this.atomScale;
      
      // Create mesh
      const mesh = new THREE.Mesh(
        this.sharedGeometries.sphere,
        material
      );
      
      // Scale
      mesh.scale.set(radius, radius, radius);
      
      // Position
      mesh.position.set(
        atom.position.x - this.proteinModel.centerOfMass.x,
        atom.position.y - this.proteinModel.centerOfMass.y,
        atom.position.z - this.proteinModel.centerOfMass.z
      );
      
      // Add to group
      this.atomsGroup.add(mesh);
      this.atomMeshes.push(mesh);
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
      
      // Skip hydrogens
      const filteredAtoms = atoms.filter(atom => atom.element !== 'H');
      
      console.log(`Creating standard visualization for ${filteredAtoms.length} non-hydrogen atoms`);
      
      // Process only a subset of atoms if there are too many (for performance)
      let atomsToProcess = filteredAtoms;
      
      if (filteredAtoms.length > this.MAX_ATOMS) {
        console.warn(`Too many atoms (${filteredAtoms.length}), rendering a subset of ${this.MAX_ATOMS}`);
        
        // Try to select evenly distributed atoms
        const stride = Math.ceil(filteredAtoms.length / this.MAX_ATOMS);
        atomsToProcess = [];
        
        for (let i = 0; i < filteredAtoms.length; i += stride) {
          atomsToProcess.push(filteredAtoms[i]);
        }
      }
      
      // Group atoms by element for batch creation
      const elementGroups = {};
      
      atomsToProcess.forEach(atom => {
        const element = atom.element;
        if (!elementGroups[element]) {
          elementGroups[element] = [];
        }
        elementGroups[element].push(atom);
      });
      
      // Process element groups in batches
      const BATCH_SIZE = 200;
      let totalProcessed = 0;
      const materialCache = {};
      
      const processNextBatch = () => {
        // Get next element to process
        const elements = Object.keys(elementGroups);
        if (elements.length === 0 || totalProcessed >= this.MAX_ATOMS) {
          // All done, process some bonds
          this._addRepresentativeBonds(atoms, Math.max(2, Math.ceil(bonds.length / this.MAX_BONDS)));
          resolve();
          return;
        }
        
        const element = elements[0];
        const atomsToProcess = elementGroups[element].splice(0, BATCH_SIZE);
        
        if (elementGroups[element].length === 0) {
          delete elementGroups[element];
        }
        
        // Get or create material for this element
        let material;
        
        if (materialCache[element]) {
          material = materialCache[element];
        } else {
          const color = this.proteinModel.getAtomColor(atomsToProcess[0], this.colorScheme);
          material = this._createSimpleMaterial(color);
          materialCache[element] = material;
        }
        
        // Create atoms for this batch
        atomsToProcess.forEach(atom => {
          // Calculate atom radius based on element
          const radius = atom.radius * this.atomScale;
          
          // Create mesh
          const mesh = new THREE.Mesh(
            this.sharedGeometries.sphere,
            material
          );
          
          // Scale by radius
          mesh.scale.set(radius, radius, radius);
          
          // Position
          mesh.position.set(
            atom.position.x - this.proteinModel.centerOfMass.x,
            atom.position.y - this.proteinModel.centerOfMass.y,
            atom.position.z - this.proteinModel.centerOfMass.z
          );
          
          // Disable shadows for better performance
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          
          // Add to atoms group
          this.atomsGroup.add(mesh);
          this.atomMeshes.push(mesh);
          
          totalProcessed++;
        });
        
        // Process next batch on next frame to avoid blocking UI
        setTimeout(processNextBatch, 0);
      };
      
      // Start processing
      processNextBatch();
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
      
      // Take only a tiny subset of atoms for the fallback
      const MAX_FALLBACK_ATOMS = 200;
      const stride = Math.max(1, Math.floor(atoms.length / MAX_FALLBACK_ATOMS));
      
      // Create very low-poly sphere (octahedron is more stable)
      const lowPolySphere = new THREE.OctahedronGeometry(1, 0);
      
      // Create shared material
      const material = new THREE.MeshBasicMaterial({ color: 0x3498db });
      
      // Add representative atoms
      for (let i = 0; i < atoms.length; i += stride) {
        const atom = atoms[i];
        if (!atom) continue;
        
        // Skip hydrogen
        if (atom.element === 'H') continue;
        
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
        
        // Limit number of atoms
        if (this.atomMeshes.length >= MAX_FALLBACK_ATOMS) {
          break;
        }
      }
    } catch (error) {
      console.error('Error creating fallback visualization:', error);
      
      // Create an absolute minimal representation - just a sphere
      try {
        const geometry = new THREE.SphereGeometry(5, 8, 6);
        const material = new THREE.MeshBasicMaterial({ color: 0x3498db, wireframe: true });
        const mesh = new THREE.Mesh(geometry, material);
        this.atomsGroup.add(mesh);
        this.atomMeshes.push(mesh);
      } catch (e) {
        console.error('Failed to create even minimal fallback:', e);
      }
    }
  }
  
  /**
   * Create a simple material for better performance
   * @private
   * @param {THREE.Color} color - Color for the material
   * @returns {THREE.Material} Material
   */
  _createSimpleMaterial(color) {
    // Always use a simple material for better performance
    return new THREE.MeshLambertMaterial({
      color: color,
      flatShading: true
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
      try {
        // Use shader manager's material with simplified parameters
        return this.shader.getMaterial({
          color: color,
          roughness: 0.6,
          metalness: 0.2
        });
      } catch (error) {
        console.warn('Error creating shader material, falling back to standard material:', error);
      }
    }
    
    // Fallback to simpler material for better performance
    return new THREE.MeshLambertMaterial({
      color: color,
      flatShading: true
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
    
    // Set a higher threshold to avoid trying instancing on borderline cases
    const atomCount = this.proteinModel.atoms.filter(atom => atom.element !== 'H').length;
    const threshold = CONFIG.PERFORMANCE.INSTANCING_THRESHOLD * 2;
    
    return atomCount >= threshold;
  }
  
  /**
   * Update the color scheme
   * @param {string} colorScheme - New color scheme
   */
  updateColorScheme(colorScheme) {
    if (this.colorScheme === colorScheme) return;
    
    this.colorScheme = colorScheme;
    
    // Don't recreate - too expensive. Just update material colors where possible.
    try {
      // Get atoms by element
      const atomsByElement = {};
      this.proteinModel.atoms.forEach(atom => {
        if (atom.element !== 'H') {
          if (!atomsByElement[atom.element]) {
            atomsByElement[atom.element] = [];
          }
          atomsByElement[atom.element].push(atom);
        }
      });
      
      // Update materials for atom meshes
      this.atomMeshes.forEach(mesh => {
        if (mesh.isInstancedMesh) {
          // Try to determine element
          const elementMatch = mesh.name.match(/Atoms_(\w+)_/);
          if (elementMatch && elementMatch[1]) {
            const element = elementMatch[1];
            if (atomsByElement[element] && atomsByElement[element].length > 0) {
              const color = this.proteinModel.getAtomColor(atomsByElement[element][0], this.colorScheme);
              if (mesh.material) {
                mesh.material.color = color;
              }
            }
          }
        } else if (mesh.isMesh && mesh.parent === this.atomsGroup) {
          // Find closest atom to this mesh
          const pos = mesh.position.clone().add(this.proteinModel.centerOfMass);
          let closest = null;
          let minDist = Infinity;
          
          // Only check a sample of atoms for performance
          for (const element in atomsByElement) {
            const atoms = atomsByElement[element];
            for (let i = 0; i < Math.min(atoms.length, 100); i++) {
              const atom = atoms[i];
              const dist = pos.distanceToSquared(atom.position);
              if (dist < minDist) {
                minDist = dist;
                closest = atom;
              }
            }
          }
          
          if (closest) {
            const color = this.proteinModel.getAtomColor(closest, this.colorScheme);
            if (mesh.material) {
              mesh.material.color = color;
            }
          }
        }
      });
    } catch (error) {
      console.warn('Error updating color scheme:', error);
    }
  }
  
  /**
   * Update the shader
   * @param {Object} shader - New shader
   */
  updateShader(shader) {
    // Store new shader but don't recreate - too expensive
    this.shader = shader;
    console.log("Shader changed - for full effect, reload the protein");
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
        // Only update a few materials to avoid overwhelming the GPU
        const MAX_UPDATES = 10;
        let updated = 0;
        
        // Apply to atom materials
        for (let i = 0; i < this.atomMeshes.length && updated < MAX_UPDATES; i++) {
          const mesh = this.atomMeshes[i];
          if (mesh.material) {
            this.shader.updateEffectStrength(mesh.material, strength);
            updated++;
          }
        }
        
        // Apply to bond materials if we have updates left
        if (updated < MAX_UPDATES) {
          for (let i = 0; i < this.bondMeshes.length && updated < MAX_UPDATES; i++) {
            const mesh = this.bondMeshes[i];
            if (mesh.material) {
              this.shader.updateEffectStrength(mesh.material, strength);
              updated++;
            }
          }
        }
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
      if (mesh.geometry && 
          mesh.geometry !== this.sharedGeometries.sphere &&
          mesh.geometry.dispose) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            if (mat && mat.dispose) mat.dispose();
          });
        } else if (mesh.material.dispose) {
          mesh.material.dispose();
        }
      }
    });
    
    // Dispose of bond meshes
    this.bondMeshes.forEach(mesh => {
      if (mesh.geometry && 
          mesh.geometry !== this.sharedGeometries.cylinder &&
          mesh.geometry.dispose) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            if (mat && mat.dispose) mat.dispose();
          });
        } else if (mesh.material.dispose) {
          mesh.material.dispose();
        }
      }
    });
    
    // Clear arrays
    this.atomMeshes = [];
    this.bondMeshes = [];
    
    // Clear groups
    this.atomsGroup.clear();
    this.bondsGroup.clear();
  }
}
