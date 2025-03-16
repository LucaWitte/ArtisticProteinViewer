/**
 * ProteinModel.js - Core protein model representation
 * Maintains the protein structure data and coordinates visualization methods
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class ProteinModel {
  /**
   * Create a new protein model
   * @param {Object} options - Protein model options
   * @param {Object} options.pdbData - Parsed PDB data
   * @param {Object} options.scene - Scene instance
   */
  constructor(options) {
    this.pdbData = options.pdbData;
    this.scene = options.scene;
    
    // Core properties
    this.atoms = this.pdbData.atoms;
    this.bonds = this.pdbData.bonds;
    this.chains = Array.from(this.pdbData.chains);
    this.residues = this.pdbData.residueList;
    this.boundingBox = this.pdbData.boundingBox;
    
    // Create group to hold all visualizations
    this.object = new THREE.Group();
    this.object.name = 'ProteinModel';
    
    // Add to scene
    this.scene.add(this.object);
    
    // Visualization containers
    this.activeVisualizations = [];
    
    // Process data
    this._preprocessData();
  }
  
  /**
   * Preprocess protein data for efficient visualization
   * @private
   */
  _preprocessData() {
    // Calculate center of mass
    this.centerOfMass = new THREE.Vector3();
    let totalMass = 0;
    
    this.atoms.forEach(atom => {
      const mass = this._getAtomicMass(atom.element);
      this.centerOfMass.x += atom.position.x * mass;
      this.centerOfMass.y += atom.position.y * mass;
      this.centerOfMass.z += atom.position.z * mass;
      totalMass += mass;
    });
    
    if (totalMass > 0) {
      this.centerOfMass.divideScalar(totalMass);
    }
    
    // Set position
    this.object.position.copy(this.centerOfMass.clone().negate());
    
    // Create efficient lookup maps
    this._createLookupMaps();
  }
  
  /**
   * Create efficient lookup maps for atoms, residues, and chains
   * @private
   */
  _createLookupMaps() {
    // Create atom ID to index map
    this.atomMap = new Map();
    this.atoms.forEach((atom, index) => {
      this.atomMap.set(atom.id, index);
    });
    
    // Group atoms by chain
    this.atomsByChain = {};
    this.chains.forEach(chainId => {
      this.atomsByChain[chainId] = this.atoms.filter(atom => atom.chainID === chainId);
    });
    
    // Group atoms by residue
    this.atomsByResidue = {};
    this.residues.forEach(residue => {
      this.atomsByResidue[residue.id] = this.atoms.filter(atom => atom.residueId === residue.id);
    });
    
    // Group bonds by atom
    this.bondsByAtom = {};
    this.atoms.forEach((atom, atomIndex) => {
      this.bondsByAtom[atomIndex] = this.bonds.filter(bond => 
        bond.atomIndex1 === atomIndex || bond.atomIndex2 === atomIndex
      );
    });
  }
  
  /**
   * Get approximate atomic mass for element
   * @private
   * @param {string} element - Element symbol
   * @returns {number} Atomic mass
   */
  _getAtomicMass(element) {
    const masses = {
      'H': 1.008,
      'C': 12.011,
      'N': 14.007,
      'O': 15.999,
      'P': 30.974,
      'S': 32.065,
      'FE': 55.845,
      'ZN': 65.38,
      'CA': 40.078,
      'MG': 24.305,
      'NA': 22.990,
      'CL': 35.453,
      'K': 39.098,
      'F': 18.998,
      'BR': 79.904,
      'I': 126.904
    };
    
    return masses[element] || 12.0; // Default to carbon mass
  }
  
  /**
   * Add a visualization to the model
   * @param {Object} visualization - Visualization object to add
   */
  addVisualization(visualization) {
    this.activeVisualizations.push(visualization);
    this.object.add(visualization.object);
  }
  
  /**
   * Remove current visualizations
   */
  removeVisualization() {
    // Dispose and remove active visualizations
    this.activeVisualizations.forEach(vis => {
      if (vis.dispose) {
        vis.dispose();
      }
      this.object.remove(vis.object);
    });
    
    this.activeVisualizations = [];
  }
  
  /**
   * Get bounding box for the protein
   * @returns {THREE.Box3} Bounding box
   */
  getBoundingBox() {
    // Clone the bounding box to avoid modification
    const box = this.boundingBox.clone();
    
    // Transform by model position
    box.translate(this.object.position);
    
    return box;
  }
  
  /**
   * Get color for atom based on color scheme
   * @param {Object} atom - Atom object
   * @param {string} colorScheme - Color scheme name
   * @returns {THREE.Color} Color for the atom
   */
  getAtomColor(atom, colorScheme) {
    let colorHex;
    
    switch (colorScheme) {
      case 'element':
        // Color by element type (CPK coloring)
        colorHex = CONFIG.VISUALIZATION.ELEMENT_COLORS[atom.element] || 
                  CONFIG.VISUALIZATION.ELEMENT_COLORS.DEFAULT;
        break;
        
      case 'chain':
        // Color by chain ID
        const chainIndex = this.chains.indexOf(atom.chainID);
        const hue = (chainIndex / this.chains.length) * 360;
        return new THREE.Color().setHSL(hue / 360, 0.7, 0.5);
        
      case 'residue':
        // Color by residue type
        const residueColors = {
          'ALA': '#C8C8C8', // Alanine
          'ARG': '#145AFF', // Arginine
          'ASN': '#00DCDC', // Asparagine
          'ASP': '#E60A0A', // Aspartic acid
          'CYS': '#E6E600', // Cysteine
          'GLN': '#00DCDC', // Glutamine
          'GLU': '#E60A0A', // Glutamic acid
          'GLY': '#EBEBEB', // Glycine
          'HIS': '#8282D2', // Histidine
          'ILE': '#0F820F', // Isoleucine
          'LEU': '#0F820F', // Leucine
          'LYS': '#145AFF', // Lysine
          'MET': '#E6E600', // Methionine
          'PHE': '#3232AA', // Phenylalanine
          'PRO': '#DC9682', // Proline
          'SER': '#FA9600', // Serine
          'THR': '#FA9600', // Threonine
          'TRP': '#B45AB4', // Tryptophan
          'TYR': '#3232AA', // Tyrosine
          'VAL': '#0F820F', // Valine
          'HOH': '#00FFFF', // Water
          'default': '#FFFFFF'  // Default
        };
        
        colorHex = residueColors[atom.resName] || residueColors.default;
        break;
        
      case 'rainbow':
        // Color based on sequence position (rainbow gradient)
        const residue = this.residues.find(r => r.id === atom.residueId);
        if (residue) {
          const index = this.residues.indexOf(residue);
          const hue = (index / this.residues.length) * 360;
          return new THREE.Color().setHSL(hue / 360, 0.7, 0.5);
        }
        colorHex = CONFIG.VISUALIZATION.ELEMENT_COLORS.DEFAULT;
        break;
        
      default:
        colorHex = CONFIG.VISUALIZATION.ELEMENT_COLORS.DEFAULT;
    }
    
    return new THREE.Color(colorHex);
  }
  
  /**
   * Get specific atoms based on selector function
   * @param {Function} selector - Function that takes an atom and returns boolean
   * @returns {Array} Array of selected atoms
   */
  getAtoms(selector = null) {
    if (!selector) {
      return this.atoms;
    }
    
    return this.atoms.filter(selector);
  }
  
  /**
   * Get atoms of a specific element
   * @param {string} element - Element symbol
   * @returns {Array} Array of matching atoms
   */
  getAtomsByElement(element) {
    return this.getAtoms(atom => atom.element === element);
  }
  
  /**
   * Get atoms in a specific chain
   * @param {string} chainId - Chain identifier
   * @returns {Array} Array of matching atoms
   */
  getAtomsByChain(chainId) {
    return this.atomsByChain[chainId] || [];
  }
  
  /**
   * Get atoms in a specific residue
   * @param {string} residueId - Residue identifier
   * @returns {Array} Array of matching atoms
   */
  getAtomsByResidue(residueId) {
    return this.atomsByResidue[residueId] || [];
  }
  
  /**
   * Get bonds for a specific atom
   * @param {number} atomIndex - Atom index
   * @returns {Array} Array of bonds
   */
  getBondsForAtom(atomIndex) {
    return this.bondsByAtom[atomIndex] || [];
  }
  
  /**
   * Dispose of protein model resources
   */
  dispose() {
    this.removeVisualization();
    
    // Clean up references
    this.atoms = null;
    this.bonds = null;
    this.residues = null;
    this.boundingBox = null;
    this.atomMap = null;
    this.atomsByChain = null;
    this.atomsByResidue = null;
    this.bondsByAtom = null;
  }
}
