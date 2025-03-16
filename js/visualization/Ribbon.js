/**
 * Ribbon.js - Ribbon/cartoon visualization style for proteins
 * Represents the protein backbone as a smooth ribbon with specialized
 * representations for secondary structure elements
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class Ribbon {
  /**
   * Create a new ribbon visualization
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
    this.config = CONFIG.VISUALIZATION.RIBBON;
    
    // Parameters
    this.thickness = this.config.THICKNESS;
    this.tension = this.config.TENSION;
    this.subdivision = this.config.SUBDIVISION;
    this.curveSegments = this.config.CURVE_SEGMENTS;
    this.helixWidth = this.config.HELIX_WIDTH;
    this.sheetWidth = this.config.SHEET_WIDTH;
    this.coilWidth = this.config.COIL_WIDTH;
    
    // Create group for this visualization
    this.object = new THREE.Group();
    this.object.name = 'Ribbon';
    
    // Create separate groups for different secondary structures
    this.helixGroup = new THREE.Group();
    this.helixGroup.name = 'Helices';
    
    this.sheetGroup = new THREE.Group();
    this.sheetGroup.name = 'Sheets';
    
    this.coilGroup = new THREE.Group();
    this.coilGroup.name = 'Coils';
    
    this.object.add(this.helixGroup);
    this.object.add(this.sheetGroup);
    this.object.add(this.coilGroup);
    
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
      const residues = this.proteinModel.residues;
      const chains = this.proteinModel.chains;
      
      // Process each chain separately
      chains.forEach(chainId => {
        const chainResidues = residues.filter(r => r.chainID === chainId);
        
        // Skip chains with too few residues
        if (chainResidues.length < 3) return;
        
        // Get trace points
        const tracePoints = this._getBackboneTrace(chainResidues);
        
        // Skip if insufficient trace points
        if (tracePoints.length < 3) return;
        
        // Draw chain ribbon
        this._createChainRibbon(chainId, chainResidues, tracePoints);
      });
      
      // Apply initial effect strength
      this.updateEffectStrength(this.effectStrength);
      
      resolve();
    });
  }
  
  /**
   * Get backbone trace points from residues
   * @private
   * @param {Array} residues - Array of residues
   * @returns {Array} Array of trace points
   */
  _getBackboneTrace(residues) {
    const tracePoints = [];
    
    // Extract CA atoms (alpha carbons) for the trace
    residues.forEach(residue => {
      // Skip non-amino acid residues
      if (!residue.atoms.some(a => a.isAminoAcid)) return;
      
      // Find the CA atom
      const caAtom = residue.atoms.find(a => a.name === 'CA');
      
      if (caAtom) {
        // Create a trace point
        tracePoints.push({
          position: new THREE.Vector3(
            caAtom.position.x - this.proteinModel.centerOfMass.x,
            caAtom.position.y - this.proteinModel.centerOfMass.y,
            caAtom.position.z - this.proteinModel.centerOfMass.z
          ),
          residue: residue,
          secondaryStructure: residue.secondaryStructure || 'coil',
          color: this._getResidueColor(residue)
        });
      }
    });
    
    return tracePoints;
  }
  
  /**
   * Get color for a residue based on the selected color scheme
   * @private
   * @param {Object} residue - Residue object
   * @returns {THREE.Color} Color for the residue
   */
  _getResidueColor(residue) {
    switch (this.colorScheme) {
      case 'rainbow':
        // Color based on sequence position (rainbow gradient)
        const index = this.proteinModel.residues.indexOf(residue);
        const hue = (index / this.proteinModel.residues.length) * 360;
        return new THREE.Color().setHSL(hue / 360, 0.7, 0.5);
        
      case 'chain':
        // Color by chain ID
        const chainIndex = this.proteinModel.chains.indexOf(residue.chainID);
        const chainHue = (chainIndex / this.proteinModel.chains.length) * 360;
        return new THREE.Color().setHSL(chainHue / 360, 0.7, 0.5);
        
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
          'default': '#FFFFFF'  // Default
        };
        
        return new THREE.Color(residueColors[residue.name] || residueColors.default);
        
      case 'secondary':
        // Color by secondary structure
        const ssColors = {
          'helix': '#FF0000', // Red
          'sheet': '#FFFF00', // Yellow
          'coil': '#00FFFF'  // Cyan
        };
        
        return new THREE.Color(ssColors[residue.secondaryStructure] || ssColors.coil);
        
      case 'element':
      default:
        // Default to a single color for ribbons
        return new THREE.Color(0x3498db);  // Blue
    }
  }
  
  /**
   * Create a ribbon for a chain
   * @private
   * @param {string} chainId - Chain identifier
   * @param {Array} residues - Array of residues in the chain
   * @param {Array} tracePoints - Array of trace points
   */
  _createChainRibbon(chainId, residues, tracePoints) {
    // Create a smooth curve through the trace points
    const curve = this._createSplineCurve(tracePoints);
    
    // Divide the curve into segments
    const points = curve.getPoints(tracePoints.length * this.subdivision);
    
    // Create ribbon geometry
    const segments = [];
    
    // Current structure type
    let currentStructure = null;
    let currentStart = 0;
    
    // Break ribbon into segments by secondary structure
    for (let i = 0; i < tracePoints.length; i++) {
      const structure = tracePoints[i].secondaryStructure;
      
      if (structure !== currentStructure && i > 0) {
        // New structure type - create segment
        segments.push({
          start: currentStart,
          end: i - 1,
          type: currentStructure || 'coil'
        });
        
        currentStart = i;
      }
      
      currentStructure = structure;
    }
    
    // Add the final segment
    if (currentStart < tracePoints.length - 1) {
      segments.push({
        start: currentStart,
        end: tracePoints.length - 1,
        type: currentStructure || 'coil'
      });
    }
    
    // Process each segment
    segments.forEach(segment => {
      // Get width based on secondary structure
      let width;
      switch (segment.type) {
        case 'helix':
          width = this.helixWidth;
          break;
        case 'sheet':
          width = this.sheetWidth;
          break;
        default:
          width = this.coilWidth;
      }
      
      // Calculate the segment points
      const segStart = segment.start * this.subdivision;
      const segEnd = (segment.end + 1) * this.subdivision;
      const segPoints = points.slice(segStart, segEnd);
      
      // Create the segment
      const segmentMesh = this._createSegmentMesh(
        segPoints,
        width,
        tracePoints.slice(segment.start, segment.end + 1),
        segment.type
      );
      
      // Add to the appropriate group
      switch (segment.type) {
        case 'helix':
          this.helixGroup.add(segmentMesh);
          break;
        case 'sheet':
          this.sheetGroup.add(segmentMesh);
          break;
        default:
          this.coilGroup.add(segmentMesh);
      }
      
      this.meshes.push(segmentMesh);
    });
  }
  
  /**
   * Create a spline curve through trace points
   * @private
   * @param {Array} tracePoints - Array of trace points
   * @returns {THREE.CatmullRomCurve3} Spline curve
   */
  _createSplineCurve(tracePoints) {
    // Extract positions
    const positions = tracePoints.map(p => p.position);
    
    // Create a spline curve
    const curve = new THREE.CatmullRomCurve3(
      positions,
      false, // closed
      'centripetal', // curve type
      this.tension
    );
    
    return curve;
  }
  
  /**
   * Create a mesh for a segment of the ribbon
   * @private
   * @param {Array} points - Array of points along the curve
   * @param {number} width - Width of the ribbon
   * @param {Array} tracePoints - Original trace points for this segment
   * @param {string} type - Segment type (helix, sheet, coil)
   * @returns {THREE.Mesh} Segment mesh
   */
  _createSegmentMesh(points, width, tracePoints, type) {
    // Create geometry
    let geometry;
    
    if (type === 'helix') {
      // Create a tube geometry for helices
      geometry = this._createHelix(points, width);
    } else {
      // Create a ribbon geometry for sheets and coils
      geometry = this._createRibbon(points, width);
    }
    
    // Create material based on color scheme
    const colors = tracePoints.map(p => p.color);
    
    // Use average color for now 
    // (a more sophisticated approach would use vertex colors)
    const color = colors.reduce((avg, c) => avg.add(c), new THREE.Color())
      .multiplyScalar(1 / colors.length);
    
    const material = this._createMaterial(color);
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Create a ribbon geometry
   * @private
   * @param {Array} points - Array of points along the curve
   * @param {number} width - Width of the ribbon
   * @returns {THREE.BufferGeometry} Ribbon geometry
   */
  _createRibbon(points, width) {
    if (points.length < 2) {
      return new THREE.BufferGeometry();
    }
    
    // Create a path for the ribbon
    const path = new THREE.CatmullRomCurve3(points);
    
    // Create ribbon geometry
    const geometry = new THREE.TubeGeometry(
      path,
      points.length * 2, // tubularSegments
      width * this.thickness / 2, // radius
      this.curveSegments, // radialSegments
      false // closed
    );
    
    return geometry;
  }
  
  /**
   * Create a helix geometry
   * @private
   * @param {Array} points - Array of points along the curve
   * @param {number} width - Width of the helix
   * @returns {THREE.BufferGeometry} Helix geometry
   */
  _createHelix(points, width) {
    if (points.length < 2) {
      return new THREE.BufferGeometry();
    }
    
    // Create a path for the helix
    const path = new THREE.CatmullRomCurve3(points);
    
    // Create helix geometry
    const geometry = new THREE.TubeGeometry(
      path,
      points.length * 2, // tubularSegments
      width * this.thickness / 2, // radius
      this.curveSegments, // radialSegments
      false // closed
    );
    
    return geometry;
  }
  
  /**
   * Create a material for the ribbon
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
        metalness: 0.3,
        side: THREE.DoubleSide
      });
    }
    
    // Fallback to standard material
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide
    });
  }
  
  /**
   * Update the color scheme
   * @param {string} colorScheme - New color scheme
   */
  updateColorScheme(colorScheme) {
    this.colorScheme = colorScheme;
    
    // Remove existing visualization and recreate
    this._disposeGeometry();
    
    this.helixGroup.clear();
    this.sheetGroup.clear();
    this.coilGroup.clear();
    
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
    
    this.helixGroup.clear();
    this.sheetGroup.clear();
    this.coilGroup.clear();
    
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
