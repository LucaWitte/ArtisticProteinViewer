/**
 * EnhancedPDBLoader.js - Robust loader for Protein Data Bank (PDB) files
 * Handles file loading, parsing, and error recovery with better error handling
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class PDBLoader {
  /**
   * Create a new PDB loader
   */
  constructor() {
    // Element radius in angstroms
    this.elementRadii = {
      H: 0.37, C: 0.77, N: 0.75, O: 0.73, S: 1.02, P: 1.06,
      F: 0.71, CL: 0.99, BR: 1.14, I: 1.33, FE: 1.24, CA: 1.97,
      ZN: 1.20, NA: 1.54, MG: 1.73, K: 2.27, CU: 1.28, HE: 0.31,
      NE: 0.38, AR: 0.71, XE: 1.08, KR: 0.88
    };
    
    // Default values
    this.defaultElementRadius = 1.0;
    this.defaultElementColor = CONFIG.VISUALIZATION.ELEMENT_COLORS.DEFAULT;
    
    // Track active load requests
    this.activeRequests = new Map();
    
    // Request timeout in milliseconds
    this.requestTimeout = 30000; // 30 seconds
  }
  
  /**
   * Load a PDB file from a URL
   * @param {string} url - URL to the PDB file
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Promise resolving to parsed PDB data
   */
  async load(url, onProgress = null) {
    // Check for duplicate requests
    if (this.activeRequests.has(url)) {
      // Return the existing promise
      return this.activeRequests.get(url);
    }
    
    // Create a new request
    const requestPromise = new Promise(async (resolve, reject) => {
      // Create timeout promise
      const timeoutPromise = new Promise((_, timeoutReject) => {
        setTimeout(() => {
          timeoutReject(new Error(`PDB loading timed out for ${url}`));
        }, this.requestTimeout);
      });
      
      try {
        // Race fetch against timeout
        const response = await Promise.race([
          this._fetchWithProgress(url, onProgress),
          timeoutPromise
        ]);
        
        if (!response.ok) {
          throw new Error(`Failed to load PDB file: ${response.status} ${response.statusText}`);
        }
        
        // Read the text content
        const pdbText = await response.text();
        
        // Count lines for validation
        const lineCount = pdbText.split('\n').length;
        if (lineCount < 10) {
          throw new Error('Invalid PDB file: too few lines');
        }
        
        // Parse the PDB content
        const pdbData = this._parsePDB(pdbText);
        
        // Validate parsed data
        if (!pdbData.atoms || pdbData.atoms.length === 0) {
          throw new Error('No atoms found in PDB file');
        }
        
        // Resolve with parsed data
        resolve(pdbData);
      } catch (error) {
        console.error('Error loading PDB file:', error);
        reject(error);
      } finally {
        // Remove from active requests
        this.activeRequests.delete(url);
      }
    });
    
    // Store the promise
    this.activeRequests.set(url, requestPromise);
    
    return requestPromise;
  }
  
  /**
   * Load a PDB file from a File object
   * @param {File} file - File object
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Promise resolving to parsed PDB data
   */
  async loadFromFile(file, onProgress = null) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // Setup progress handler
      if (onProgress) {
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = event.loaded / event.total;
            onProgress(progress);
          }
        };
      }
      
      // Set load handler
      reader.onload = (event) => {
        try {
          const pdbText = event.target.result;
          
          // Count lines for validation
          const lineCount = pdbText.split('\n').length;
          if (lineCount < 10) {
            reject(new Error('Invalid PDB file: too few lines'));
            return;
          }
          
          // Parse the PDB content
          const pdbData = this._parsePDB(pdbText);
          
          // Validate parsed data
          if (!pdbData.atoms || pdbData.atoms.length === 0) {
            reject(new Error('No atoms found in PDB file'));
            return;
          }
          
          resolve(pdbData);
        } catch (error) {
          console.error('Error parsing PDB file:', error);
          reject(error);
        }
      };
      
      // Set error handler
      reader.onerror = (error) => {
        reject(new Error('Error reading file: ' + error));
      };
      
      // Read file
      reader.readAsText(file);
    });
  }
  
  /**
   * Fetch with progress tracking
   * @private
   * @param {string} url - URL to fetch
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Response>} Fetch response
   */
  async _fetchWithProgress(url, onProgress) {
    // If no progress callback, use regular fetch
    if (!onProgress) {
      return fetch(url, { 
        method: 'GET',
        cache: 'no-cache',
        mode: 'cors'
      });
    }
    
    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      
      // Track progress
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = event.loaded / event.total;
          onProgress(progress);
        }
      };
      
      // Handle load completion
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText
          });
          resolve(response);
        } else {
          reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
        }
      };
      
      // Handle network errors
      xhr.onerror = () => {
        reject(new Error('Network error while loading PDB file'));
      };
      
      // Handle timeouts
      xhr.ontimeout = () => {
        reject(new Error('Request timeout while loading PDB file'));
      };
      
      // Start request
      xhr.send();
    });
  }
  
  /**
   * Parse PDB file content
   * @private
   * @param {string} pdbText - Text content of PDB file
   * @returns {Object} Parsed PDB data
   */
  _parsePDB(pdbText) {
    const lines = pdbText.split(/\r?\n/);
    
    // Initialize result object
    const result = {
      atoms: [],
      bonds: [],
      header: {},
      metadata: {},
      chains: new Set(),
      residues: new Map(),
      boundingBox: null
    };
    
    // Process each line
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Get line type from first 6 characters
      const recordType = line.substring(0, 6).trim();
      
      try {
        // Process based on record type
        switch (recordType) {
          case 'ATOM':
          case 'HETATM':
            this._parseAtomRecord(line, recordType, result);
            break;
          case 'CONECT':
            this._parseConnectRecord(line, result);
            break;
          case 'HEADER':
            this._parseHeaderRecord(line, result);
            break;
          case 'TITLE':
            this._parseTitleRecord(line, result);
            break;
        }
      } catch (error) {
        console.warn(`Error parsing PDB record: ${recordType}`, error);
        // Continue processing other lines
      }
    }
    
    // Post-processing
    this._postProcessPDB(result);
    
    return result;
  }
  
  /**
   * Parse ATOM or HETATM record
   * @private
   * @param {string} line - PDB file line
   * @param {string} recordType - Record type
   * @param {Object} result - Result object
   */
  _parseAtomRecord(line, recordType, result) {
    // Basic validation
    if (line.length < 54) {
      console.warn('Skipping short ATOM record:', line);
      return;
    }
    
    try {
      const atom = {
        id: parseInt(line.substring(6, 11).trim()) || 0,
        name: line.substring(12, 16).trim(),
        altLoc: line.substring(16, 17).trim(),
        resName: line.substring(17, 20).trim(),
        chainID: line.substring(21, 22).trim() || 'A',
        resSeq: parseInt(line.substring(22, 26).trim()) || 0,
        iCode: line.substring(26, 27).trim(),
        type: recordType,
        isHetAtm: recordType === 'HETATM'
      };
      
      // Parse coordinates - critical part that needs careful handling
      try {
        atom.x = parseFloat(line.substring(30, 38).trim() || "0.0");
        atom.y = parseFloat(line.substring(38, 46).trim() || "0.0");
        atom.z = parseFloat(line.substring(46, 54).trim() || "0.0");
        
        // Check if coordinates are valid numbers
        if (isNaN(atom.x) || isNaN(atom.y) || isNaN(atom.z)) {
          throw new Error('Invalid atom coordinates');
        }
      } catch (coordError) {
        console.warn('Error parsing atom coordinates:', line);
        // Use default coordinates so parsing can continue
        atom.x = 0.0;
        atom.y = 0.0;
        atom.z = 0.0;
      }
      
      // Optional fields
      if (line.length >= 60) {
        atom.occupancy = parseFloat(line.substring(54, 60).trim() || "1.0");
      } else {
        atom.occupancy = 1.0;
      }
      
      if (line.length >= 66) {
        atom.tempFactor = parseFloat(line.substring(60, 66).trim() || "0.0");
      } else {
        atom.tempFactor = 0.0;
      }
      
      // Extract element symbol (columns 77-78)
      if (line.length >= 78) {
        atom.element = line.substring(76, 78).trim();
      } else {
        // If element not specified, guess from atom name
        atom.element = this._guessElementFromName(atom.name);
      }
      
      // Standardize element to uppercase
      atom.element = atom.element.toUpperCase();
      
      // Create a position vector
      atom.position = new THREE.Vector3(atom.x, atom.y, atom.z);
      
      // Get radius and color
      atom.radius = this.elementRadii[atom.element] || this.defaultElementRadius;
      atom.color = CONFIG.VISUALIZATION.ELEMENT_COLORS[atom.element] || this.defaultElementColor;
      
      // Skip alternate locations other than 'A' or ' '
      if (atom.altLoc !== 'A' && atom.altLoc !== ' ' && atom.altLoc !== '') {
        return;
      }
      
      // Create a unique residue identifier
      atom.residueId = `${atom.chainID}:${atom.resName}:${atom.resSeq}:${atom.iCode}`;
      
      // Add to result
      result.atoms.push(atom);
      
      // Track chains
      result.chains.add(atom.chainID);
      
      // Track residues
      if (!result.residues.has(atom.residueId)) {
        result.residues.set(atom.residueId, {
          id: atom.residueId,
          name: atom.resName,
          sequence: atom.resSeq,
          chainID: atom.chainID,
          atoms: []
        });
      }
      
      // Add atom to its residue
      result.residues.get(atom.residueId).atoms.push(atom);
    } catch (error) {
      console.warn('Error parsing atom record:', error);
    }
  }
  
  /**
   * Parse CONECT record for bond information
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object
   */
  _parseConnectRecord(line, result) {
    try {
      // Parse the atom serial number
      const atomSerial = parseInt(line.substring(6, 11).trim() || "0");
      if (atomSerial === 0) return;
      
      // Find bonded atoms
      const bondedSerials = [];
      
      // Read bonded atom serials (columns 11-15, 16-20, 21-25, 26-30)
      for (let i = 0; i < 4; i++) {
        const start = 11 + (i * 5);
        const end = start + 5;
        
        if (line.length >= end) {
          const serialStr = line.substring(start, end).trim();
          if (serialStr) {
            const serial = parseInt(serialStr);
            if (!isNaN(serial) && serial > 0) {
              bondedSerials.push(serial);
            }
          }
        }
      }
      
      // Find atoms and create bonds
      const atomIndex = result.atoms.findIndex(atom => atom.id === atomSerial);
      if (atomIndex === -1) return; // Atom not found
      
      // Add bonds
      for (const bondedSerial of bondedSerials) {
        const bondedIndex = result.atoms.findIndex(atom => atom.id === bondedSerial);
        
        if (bondedIndex !== -1) {
          // Check for duplicate bonds
          const bondExists = result.bonds.some(bond => 
            (bond.atomIndex1 === atomIndex && bond.atomIndex2 === bondedIndex) || 
            (bond.atomIndex1 === bondedIndex && bond.atomIndex2 === atomIndex)
          );
          
          if (!bondExists) {
            result.bonds.push({
              atomIndex1: atomIndex,
              atomIndex2: bondedIndex,
              type: 1, // Single bond by default
              isConjugated: false
            });
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing CONECT record:', error);
    }
  }
  
  /**
   * Parse HEADER record
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object
   */
  _parseHeaderRecord(line, result) {
    try {
      if (line.length < 50) return;
      
      result.header = {
        classification: line.substring(10, 50).trim(),
        depDate: line.length >= 59 ? line.substring(50, 59).trim() : '',
        idCode: line.length >= 66 ? line.substring(62, 66).trim() : ''
      };
      
      result.metadata.title = result.header.classification;
      result.metadata.pdbId = result.header.idCode;
    } catch (error) {
      console.warn('Error parsing HEADER record:', error);
    }
  }
  
  /**
   * Parse TITLE record
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object
   */
  _parseTitleRecord(line, result) {
    try {
      let continuation = 1;
      if (line.length >= 10) {
        const contStr = line.substring(8, 10).trim();
        if (contStr) {
          continuation = parseInt(contStr) || 1;
        }
      }
      
      const title = line.substring(10).trim();
      
      if (!result.metadata.fullTitle) {
        result.metadata.fullTitle = [];
      }
      
      // Store title parts in order
      result.metadata.fullTitle[continuation - 1] = title;
      
      // Join all title parts
      result.metadata.title = result.metadata.fullTitle
        .filter(part => part !== undefined)
        .join(' ').trim();
    } catch (error) {
      console.warn('Error parsing TITLE record:', error);
    }
  }
  
  /**
   * Post-process PDB data
   * @private
   * @param {Object} result - Result object
   */
  _postProcessPDB(result) {
    // If no bonds were found, calculate them
    if (result.bonds.length === 0) {
      this._calculateBonds(result);
    }
    
    // Calculate bounding box
    this._calculateBoundingBox(result);
    
    // Process chains and residues
    this._processChains(result);
    
    // Calculate center of mass
    this._calculateCenterOfMass(result);
  }
  
  /**
   * Calculate bonds based on distance
   * @private
   * @param {Object} result - Result object
   */
  _calculateBonds(result) {
    const atoms = result.atoms;
    const bonds = result.bonds;
    
    // Bond distance thresholds (Å)
    const bondDistThresholds = {
      "C-C": 1.8,   // Carbon-Carbon
      "C-N": 1.7,   // Carbon-Nitrogen
      "C-O": 1.6,   // Carbon-Oxygen
      "C-S": 2.0,   // Carbon-Sulfur
      "N-N": 1.8,   // Nitrogen-Nitrogen
      "N-O": 1.6,   // Nitrogen-Oxygen
      "O-O": 1.5,   // Oxygen-Oxygen
      "S-S": 2.2,   // Sulfur-Sulfur
      "default": 2.0 // Default threshold
    };
    
    // Get threshold for two elements
    const getBondThreshold = (elem1, elem2) => {
      elem1 = elem1.toUpperCase();
      elem2 = elem2.toUpperCase();
      
      // Sort elements alphabetically
      if (elem1 > elem2) [elem1, elem2] = [elem2, elem1];
      
      const key = `${elem1}-${elem2}`;
      return bondDistThresholds[key] || bondDistThresholds.default;
    };
    
    // Group atoms by residue
    const residueMap = new Map();
    atoms.forEach((atom, index) => {
      const residueKey = `${atom.chainID}_${atom.resSeq}_${atom.resName}`;
      if (!residueMap.has(residueKey)) {
        residueMap.set(residueKey, []);
      }
      residueMap.get(residueKey).push({ atom, index });
    });
    
    // Process each residue for internal bonds
    residueMap.forEach((atomsInResidue) => {
      // Create map of atom names in this residue
      const atomMap = new Map();
      atomsInResidue.forEach(({ atom, index }) => {
        atomMap.set(atom.name, index);
      });
      
      // Add standard backbone bonds in amino acids
      if (atomsInResidue.length > 0 && 
          this._isAminoAcid(atomsInResidue[0].atom.resName)) {
        
        // Add N-CA bond
        if (atomMap.has('N') && atomMap.has('CA')) {
          bonds.push({
            atomIndex1: atomMap.get('N'),
            atomIndex2: atomMap.get('CA'),
            type: 1
          });
        }
        
        // Add CA-C bond
        if (atomMap.has('CA') && atomMap.has('C')) {
          bonds.push({
            atomIndex1: atomMap.get('CA'),
            atomIndex2: atomMap.get('C'),
            type: 1
          });
        }
        
        // Add C-O bond
        if (atomMap.has('C') && atomMap.has('O')) {
          bonds.push({
            atomIndex1: atomMap.get('C'),
            atomIndex2: atomMap.get('O'),
            type: 1
          });
        }
      }
      
      // Calculate distance-based bonds within residue
      for (let i = 0; i < atomsInResidue.length; i++) {
        const atom1 = atomsInResidue[i].atom;
        const index1 = atomsInResidue[i].index;
        
        for (let j = i + 1; j < atomsInResidue.length; j++) {
          const atom2 = atomsInResidue[j].atom;
          const index2 = atomsInResidue[j].index;
          
          // Skip backbone bonds (already added)
          if (this._isAminoAcid(atom1.resName) && 
              ((atom1.name === 'N' && atom2.name === 'CA') ||
               (atom1.name === 'CA' && atom2.name === 'C') ||
               (atom1.name === 'C' && atom2.name === 'O'))) {
            continue;
          }
          
          // Calculate distance
          const distance = atom1.position.distanceTo(atom2.position);
          
          // Get threshold
          const threshold = getBondThreshold(atom1.element, atom2.element);
          
          // Create bond if within threshold
          if (distance <= threshold) {
            bonds.push({
              atomIndex1: index1,
              atomIndex2: index2,
              type: 1,
              distance: distance
            });
          }
        }
      }
    });
    
    // Connect adjacent residues with peptide bonds
    const sortedResidues = Array.from(residueMap.keys()).sort();
    
    for (let i = 0; i < sortedResidues.length - 1; i++) {
      const currentKey = sortedResidues[i];
      const nextKey = sortedResidues[i + 1];
      
      // Extract chain and resSeq
      const [currentChain, currentResSeq] = currentKey.split('_');
      const [nextChain, nextResSeq] = nextKey.split('_');
      
      // Connect if same chain and sequential
      if (currentChain === nextChain && 
          parseInt(nextResSeq) === parseInt(currentResSeq) + 1) {
        
        const currentResidue = residueMap.get(currentKey);
        const nextResidue = residueMap.get(nextKey);
        
        // Find C atom in current residue
        const cAtom = currentResidue.find(a => a.atom.name === 'C');
        
        // Find N atom in next residue
        const nAtom = nextResidue.find(a => a.atom.name === 'N');
        
        // Create peptide bond
        if (cAtom && nAtom) {
          bonds.push({
            atomIndex1: cAtom.index,
            atomIndex2: nAtom.index,
            type: 1,
            isPeptideBond: true
          });
        }
      }
    }
  }
  
  /**
   * Calculate bounding box for all atoms
   * @private
   * @param {Object} result - Result object
   */
  _calculateBoundingBox(result) {
    if (result.atoms.length === 0) {
      result.boundingBox = new THREE.Box3(
        new THREE.Vector3(-10, -10, -10),
        new THREE.Vector3(10, 10, 10)
      );
      return;
    }
    
    // Create bounding box
    const box = new THREE.Box3();
    
    // Add each atom position
    result.atoms.forEach(atom => {
      box.expandByPoint(atom.position);
    });
    
    // Add padding
    const padding = 2; // Angstroms
    box.min.subScalar(padding);
    box.max.addScalar(padding);
    
    result.boundingBox = box;
  }
  
  /**
   * Process chains and residues
   * @private
   * @param {Object} result - Result object
   */
  _processChains(result) {
    // Convert chains to array
    result.chainList = Array.from(result.chains).sort();
    
    // Convert residues to array
    result.residueList = Array.from(result.residues.values());
    
    // Sort residues by chain and sequence
    result.residueList.sort((a, b) => {
      if (a.chainID !== b.chainID) {
        return a.chainID.localeCompare(b.chainID);
      }
      return a.sequence - b.sequence;
    });
    
    // Group residues by chain
    result.residuesByChain = {};
    result.chainList.forEach(chainID => {
      result.residuesByChain[chainID] = result.residueList.filter(r => r.chainID === chainID);
    });
  }
  
  /**
   * Calculate center of mass
   * @private
   * @param {Object} result - Result object
   */
  _calculateCenterOfMass(result) {
    const center = new THREE.Vector3();
    
    if (result.atoms.length === 0) {
      result.centerOfMass = center;
      return;
    }
    
    // Calculate average position (simple centroid)
    result.atoms.forEach(atom => {
      center.add(atom.position);
    });
    
    center.divideScalar(result.atoms.length);
    result.centerOfMass = center;
  }
  
  /**
   * Check if a residue is an amino acid
   * @private
   * @param {string} resName - Residue name
   * @returns {boolean} True if residue is an amino acid
   */
  _isAminoAcid(resName) {
    const aminoAcids = new Set([
      'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE', 
      'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL'
    ]);
    
    return aminoAcids.has(resName);
  }
  
  /**
   * Guess element from atom name
   * @private
   * @param {string} atomName - Atom name
   * @returns {string} Element symbol
   */
  _guessElementFromName(atomName) {
    // Remove digits
    const name = atomName.replace(/[0-9]/g, '').trim();
    
    // Common atom patterns
    if (name === 'CA' || name === 'CB') return 'C';
    if (name === 'N' || name === 'NA') return 'N';
    if (name === 'O' || name === 'OXT') return 'O';
    if (name === 'FE') return 'FE';
    if (name === 'ZN') return 'ZN';
    if (name === 'MG') return 'MG';
    if (name === 'CL') return 'CL';
    
    // Get first character as fallback
    if (name.length > 0) {
      return name.charAt(0);
    }
    
    return 'C'; // Default to carbon
  }
}
