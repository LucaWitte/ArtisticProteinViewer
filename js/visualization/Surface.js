/**
 * Surface.js - Molecular surface visualization
 * Generates and displays solvent-accessible surface or electron density isosurface
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { MarchingCubes } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/objects/MarchingCubes.js';
import { CONFIG } from '../config.js';

export class Surface {
  /**
   * Create a new surface visualization
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
    this.config = CONFIG.VISUALIZATION.SURFACE;
    
    // Parameters
    this.probeRadius = this.config.PROBE_RADIUS;
    this.resolution = this.config.RESOLUTION;
    this.isoValue = this.config.ISO_VALUE;
    this.smoothing = this.config.SMOOTHING;
    this.wireframe = this.config.WIREFRAME;
    
    // Create group for this visualization
    this.object = new THREE.Group();
    this.object.name = 'Surface';
    
    // Create containers for different parts
    this.proteinsGroup = new THREE.Group();
    this.proteinsGroup.name = 'Proteins';
    
    this.ligandsGroup = new THREE.Group();
    this.ligandsGroup.name = 'Ligands';
    
    this.object.add(this.proteinsGroup);
    this.object.add(this.ligandsGroup);
    
    // Track meshes
    this.meshes = [];
    
    // Effect strength
    this.effectStrength = 1.0;
  }
  
  /**
   * Create the visualization
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async create() {
    return new Promise(resolve => {
      // Get protein data
      const atoms = this.proteinModel.atoms;
      const chains = this.proteinModel.chains;
      
      // Calculate bounds for grid
      const boundingBox = this.proteinModel.boundingBox.clone();
      
      // Add padding
      const padding = 5.0; // Angstroms
      boundingBox.min.subScalar(padding);
      boundingBox.max.addScalar(padding);
      
      // Calculate grid size
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      // Calculate grid resolution
      const gridSize = Math.max(
        Math.ceil(size.x / this.resolution),
        Math.ceil(size.y / this.resolution),
        Math.ceil(size.z / this.resolution)
      );
      
      // Apply performance limits for mobile
      const limitedGridSize = CONFIG.CAPABILITIES.isMobile ? 
        Math.min(gridSize, 64) : 
        Math.min(gridSize, 128);
      
      // Create marching cubes for the surface
      const marchingCubes = new MarchingCubes(
        limitedGridSize,
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.0,
          roughness: 0.5,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        }),
        false, // enableUvs
        false  // enableColors
      );
      
      // Position within bounding box
      marchingCubes.position.copy(boundingBox.min);
      
      // Scale to fit bounding box
      marchingCubes.scale.set(
        size.x / limitedGridSize,
        size.y / limitedGridSize,
        size.z / limitedGridSize
      );
      
      // Process each chain
      chains.forEach(chainId => {
        // Get atoms for this chain
        const chainAtoms = this.proteinModel.getAtomsByChain(chainId);
        
        // Split into protein and ligand atoms
        const proteinAtoms = chainAtoms.filter(atom => atom.isAminoAcid || atom.isNucleicAcid);
        const ligandAtoms = chainAtoms.filter(atom => !atom.isAminoAcid && !atom.isNucleicAcid && !atom.isSolvent);
        
        // Create protein surface
        if (proteinAtoms.length > 0) {
          this._createSurface(
            proteinAtoms,
            marchingCubes, 
            boundingBox, 
            size, 
            limitedGridSize, 
            this.proteinsGroup
          );
        }
        
        // Create ligand surface if there are significant ligands
        if (ligandAtoms.length > 5) {
          this._createSurface(
            ligandAtoms,
            marchingCubes, 
            boundingBox, 
            size, 
            limitedGridSize, 
            this.ligandsGroup
          );
        }
      });
      
      // Clean up
      marchingCubes.dispose();
      
      // Apply initial effect strength
      this.updateEffectStrength(this.effectStrength);
      
      resolve();
    });
  }
  
  /**
   * Create a surface for a set of atoms
   * @private
   * @param {Array} atoms - Array of atoms
   * @param {MarchingCubes} marchingCubes - Marching cubes instance
   * @param {THREE.Box3} boundingBox - Bounding box
   * @param {THREE.Vector3} size - Size of the bounding box
   * @param {number} gridSize - Grid size
   * @param {THREE.Group} group - Group to add the surface to
   */
  _createSurface(atoms, marchingCubes, boundingBox, size, gridSize, group) {
    // Reset marching cubes
    marchingCubes.reset();
    
    // Add atoms to the grid
    atoms.forEach(atom => {
      // Convert atom position to grid coordinates
      const gridPos = new THREE.Vector3(
        atom.position.x - this.proteinModel.centerOfMass.x,
        atom.position.y - this.proteinModel.centerOfMass.y,
        atom.position.z - this.proteinModel.centerOfMass.z
      );
      
      // Calculate grid position
      const localPos = gridPos.clone().sub(boundingBox.min);
      const x = (localPos.x / size.x) * gridSize;
      const y = (localPos.y / size.y) * gridSize;
      const z = (localPos.z / size.z) * gridSize;
      
      // Get atom radius (Angstroms) and strength
      const radius = atom.radius + this.probeRadius;
      const strength = 1.0;
      
      // Add to marching cubes
      marchingCubes.addBall(x, y, z, strength, radius);
    });
    
    // Apply smoothing if configured
    for (let i = 0; i < this.smoothing; i++) {
      marchingCubes.blur();
    }
    
    // Generate the surface mesh
    const surfaceGeometry = marchingCubes.generateGeometry();
    surfaceGeometry.computeVertexNormals();
    
    // Fix geometry position
    const positionAttribute = surfaceGeometry.getAttribute('position');
    
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      const z = positionAttribute.getZ(i);
      
      positionAttribute.setXYZ(
        i,
        x + boundingBox.min.x,
        y + boundingBox.min.y,
        z + boundingBox.min.z
      );
    }
    
    positionAttribute.needsUpdate = true;
    
    // Get color based on scheme
    const color = this._getSurfaceColor(atoms);
    
    // Create material
    const material = this._createMaterial(color);
    
    // Create mesh
    const surfaceMesh = new THREE.Mesh(surfaceGeometry, material);
    surfaceMesh.castShadow = true;
    surfaceMesh.receiveShadow = true;
    
    // Add to group
    group.add(surfaceMesh);
    
    // Track for disposal
    this.meshes.push(surfaceMesh);
  }
  
  /**
   * Create a material for the surface
   * @private
   * @param {THREE.Color} color - Color for the material
   * @returns {THREE.Material} Material
   */
  _createMaterial(color) {
    if (this.shader && this.shader.getMaterial) {
      // Use shader manager's material
      return this.shader.getMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        wireframe: this.wireframe
      });
    }
    
    // Fallback to standard material
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      wireframe: this.wireframe
    });
  }
  
  /**
   * Get color for a surface based on the selected color scheme
   * @private
   * @param {Array} atoms - Atoms in the surface
   * @returns {THREE.Color} Color for the surface
   */
  _getSurfaceColor(atoms) {
    const colors = [];
    
    switch (this.colorScheme) {
      case 'element':
        // Get average color of all atoms (weighted by radius)
        let totalWeight = 0;
        const avgColor = new THREE.Color();
        
        atoms.forEach(atom => {
          const color = this.proteinModel.getAtomColor(atom, 'element');
          const weight = atom.radius;
          
          avgColor.r += color.r * weight;
          avgColor.g += color.g * weight;
          avgColor.b += color.b * weight;
          
          totalWeight += weight;
        });
        
        if (totalWeight > 0) {
          avgColor.r /= totalWeight;
          avgColor.g /= totalWeight;
          avgColor.b /= totalWeight;
        }
        
        return avgColor;
        
      case 'chain':
        // Get chain color
        if (atoms.length > 0) {
          const chainId = atoms[0].chainID;
          const chainIndex = this.proteinModel.chains.indexOf(chainId);
          const hue = (chainIndex / this.proteinModel.chains.length) * 360;
          return new THREE.Color().setHSL(hue / 360, 0.7, 0.5);
        }
        return new THREE.Color(0x3498db);
        
      case 'residue':
        // Get average color of residues
        const residueIds = new Set();
        atoms.forEach(atom => residueIds.add(atom.residueId));
        
        residueIds.forEach(id => {
          const residue = this.proteinModel.residues.find(r => r.id === id);
          if (residue && residue.atoms.length > 0) {
            colors.push(this.proteinModel.getAtomColor(residue.atoms[0], 'residue'));
          }
        });
        
        if (colors.length > 0) {
          const avgColor = colors.reduce((avg, c) => avg.add(c), new THREE.Color())
            .multiplyScalar(1 / colors.length);
          return avgColor;
        }
        return new THREE.Color(0x3498db);
        
      case 'rainbow':
        // Average rainbow coloring across residues
        const residues = [];
        atoms.forEach(atom => {
          const residue = this.proteinModel.residues.find(r => r.id === atom.residueId);
          if (residue && !residues.includes(residue)) {
            residues.push(residue);
          }
        });
        
        if (residues.length > 0) {
          const avgIndex = residues.reduce((sum, r) => 
            sum + this.proteinModel.residues.indexOf(r), 0
          ) / residues.length;
          
          const hue = (avgIndex / this.proteinModel.residues.length) * 360;
          return new THREE.Color().setHSL(hue / 360, 0.7, 0.5);
        }
        return new THREE.Color(0x3498db);
        
      default:
        // Default to hydrophobicity coloring
        return new THREE.Color(0x3498db);
    }
  }
  
  /**
   * Update the color scheme
   * @param {string} colorScheme - New color scheme
   */
  updateColorScheme(colorScheme) {
    this.colorScheme = colorScheme;
    
    // Remove existing visualization and recreate
    this._disposeGeometry();
    
    this.proteinsGroup.clear();
    this.ligandsGroup.clear();
    
    this.meshes = [];
    
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
    
    this.proteinsGroup.clear();
    this.ligandsGroup.clear();
    
    this.meshes = [];
    
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
      this.meshes.forEach(mesh => {
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
    // Dispose of meshes
    this.meshes.forEach(mesh => {
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
