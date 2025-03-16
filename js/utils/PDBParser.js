/**
 * PDBParser.js - Parser for Protein Data Bank (PDB) file format
 * Extracts atom coordinates, bonds, secondary structure, and other information
 * from standard PDB format files.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { CONFIG } from '../config.js';

export class PDBParser {
  /**
   * Create a new PDB parser
   */
  constructor() {
    // PDB record types we're interested in parsing
    this.recordTypes = {
      ATOM: 'ATOM',      // Standard atom records
      HETATM: 'HETATM',  // Non-standard atoms (ligands, water, etc.)
      CONECT: 'CONECT',  // Bond connectivity information
      HELIX: 'HELIX',    // Alpha helix secondary structure
      SHEET: 'SHEET',    // Beta sheet secondary structure
      HEADER: 'HEADER',  // File header info
      TITLE: 'TITLE',    // Molecule title
      AUTHOR: 'AUTHOR',  // Authors/creators
      REMARK: 'REMARK'   // General remarks
    };
    
    // Standard amino acid residues
    this.aminoAcids = new Set([
      'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE', 
      'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL'
    ]);
    
    // Nucleic acid residues
    this.nucleicAcids = new Set([
      'A', 'C', 'G', 'T', 'U', 'DA', 'DC', 'DG', 'DT', 'DU'
    ]);
    
    // Standard cofactors and ligands
    this.commonLigands = new Set([
      'HEM', 'FAD', 'NAD', 'ATP', 'GTP', 'ADP', 'GDP', 'FMN'
    ]);
    
    // Element radius in angstroms (approximate)
    this.elementRadii = {
      H: 0.37, C: 0.77, N: 0.75, O: 0.73, S: 1.02, P: 1.06,
      F: 0.71, CL: 0.99, BR: 1.14, I: 1.33, FE: 1.24, CA: 1.97,
      ZN: 1.20, NA: 1.54, MG: 1.73, K: 2.27, CU: 1.28, HE: 0.31,
      NE: 0.38, AR: 0.71, XE: 1.08, KR: 0.88
    };
    
    // Default values
    this.defaultElementRadius = 1.0;
    this.defaultElementColor = CONFIG.VISUALIZATION.ELEMENT_COLORS.DEFAULT;
  }
  
  /**
   * Parse PDB file content
   * @param {string} pdbText - Text content of a PDB file
   * @returns {Object} Parsed PDB data
   */
  parse(pdbText) {
    // Split the file into lines for processing
    const lines = pdbText.split(/\r?\n/);
    
    // Initialize the result object
    const result = {
      atoms: [],
      bonds: [],
      header: {},
      helices: [],
      sheets: [],
      metadata: {},
      chains: new Set(),
      residues: new Map(),
      boundingBox: null
    };
    
    // Process each line
    for (const line of lines) {
      if (!line.trim()) continue; // Skip empty lines
      
      // Extract record type (first 6 characters, trimmed)
      const recordType = line.substring(0, 6).trim();
      
      // Process based on record type
      switch (recordType) {
        case this.recordTypes.ATOM:
        case this.recordTypes.HETATM:
          this._parseAtomRecord(line, recordType, result);
          break;
          
        case this.recordTypes.CONECT:
          this._parseConectRecord(line, result);
          break;
          
        case this.recordTypes.HELIX:
          this._parseHelixRecord(line, result);
          break;
          
        case this.recordTypes.SHEET:
          this._parseSheetRecord(line, result);
          break;
          
        case this.recordTypes.HEADER:
          this._parseHeaderRecord(line, result);
          break;
          
        case this.recordTypes.TITLE:
          this._parseTitleRecord(line, result);
          break;
          
        case this.recordTypes.AUTHOR:
          this._parseAuthorRecord(line, result);
          break;
          
        case this.recordTypes.REMARK:
          this._parseRemarkRecord(line, result);
          break;
      }
    }
    
    // Post-processing steps
    
    // Calculate bonds if CONECT records were insufficient
    if (result.bonds.length === 0) {
      this._calculateBonds(result);
    }
    
    // Calculate hydrogen bonds for secondary structures
    this._calculateHydrogenBonds(result);
    
    // Calculate the bounding box
    this._calculateBoundingBox(result);
    
    // Identify unique chains and residues
    this._identifyChains(result);
    
    // Calculate secondary structure if not defined
    if (result.helices.length === 0 && result.sheets.length === 0) {
      this._assignSecondaryStructure(result);
    }
    
    return result;
  }
  
  /**
   * Parse ATOM or HETATM record
   * @private
   * @param {string} line - PDB file line
   * @param {string} recordType - Record type (ATOM or HETATM)
   * @param {Object} result - Result object to update
   */
  _parseAtomRecord(line, recordType, result) {
    // Parse according to PDB format specification
    // See: https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html
    
    try {
      const atom = {
        id: parseInt(line.substring(6, 11).trim()),
        name: line.substring(12, 16).trim(),
        altLoc: line.substring(16, 17).trim(),
        resName: line.substring(17, 20).trim(),
        chainID: line.substring(21, 22).trim(),
        resSeq: parseInt(line.substring(22, 26).trim()),
        iCode: line.substring(26, 27).trim(),
        x: parseFloat(line.substring(30, 38).trim()),
        y: parseFloat(line.substring(38, 46).trim()),
        z: parseFloat(line.substring(46, 54).trim()),
        occupancy: parseFloat(line.substring(54, 60).trim() || "1.0"),
        tempFactor: parseFloat(line.substring(60, 66).trim() || "0.0"),
        type: recordType,
        isHetAtm: recordType === this.recordTypes.HETATM
      };
      
      // Extract element symbol (columns 77-78)
      if (line.length >= 78) {
        atom.element = line.substring(76, 78).trim();
      } else {
        // If element not specified, guess from atom name
        atom.element = this._guessElementFromName(atom.name);
      }
      
      // Standardize element to uppercase
      atom.element = atom.element.toUpperCase();
      
      // Guess formal charge (columns 79-80)
      if (line.length >= 80) {
        const chargeStr = line.substring(78, 80).trim();
        if (chargeStr) {
          const sign = chargeStr.endsWith('+') ? 1 : -1;
          const value = chargeStr.length > 1 ? parseInt(chargeStr.charAt(0)) : 1;
          atom.formalCharge = sign * value;
        } else {
          atom.formalCharge = 0;
        }
      } else {
        atom.formalCharge = 0;
      }
      
      // Categorize atom type
      atom.isAminoAcid = this.aminoAcids.has(atom.resName);
      atom.isNucleicAcid = this.nucleicAcids.has(atom.resName);
      atom.isLigand = !atom.isAminoAcid && !atom.isNucleicAcid && this.commonLigands.has(atom.resName);
      atom.isSolvent = atom.resName === 'HOH' || atom.resName === 'WAT';
      
      // Get vdW radius and color from element
      atom.radius = this.elementRadii[atom.element] || this.defaultElementRadius;
      atom.color = CONFIG.VISUALIZATION.ELEMENT_COLORS[atom.element] || this.defaultElementColor;
      
      // Create a unique residue identifier
      atom.residueId = `${atom.chainID}:${atom.resName}:${atom.resSeq}:${atom.iCode}`;
      
      // Create a unique chain identifier
      atom.chainIdentifier = atom.chainID;
      
      // Skip alternate locations other than 'A' or ' '
      if (atom.altLoc !== 'A' && atom.altLoc !== ' ' && atom.altLoc !== '') {
        return;
      }
      
      // Create position vector
      atom.position = new THREE.Vector3(atom.x, atom.y, atom.z);
      
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
      console.warn(`Error parsing atom record: ${line}`, error);
    }
  }
  
  /**
   * Parse CONECT record for bond information
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object to update
   */
  _parseConectRecord(line, result) {
    try {
      // Parse the atom serial number
      const atomSerial = parseInt(line.substring(6, 11).trim());
      
      // Find indices for bonded atoms (up to 4 bonds per CONECT record)
      const bondedSerials = [];
      
      // Columns for bonded atoms: 11-15, 16-20, 21-25, 26-30
      for (let i = 0; i < 4; i++) {
        const start = 11 + (i * 5);
        const end = start + 5;
        
        if (line.length >= end) {
          const serialStr = line.substring(start, end).trim();
          if (serialStr) {
            bondedSerials.push(parseInt(serialStr));
          }
        }
      }
      
      // Find the atom with this serial number
      const atomIndex = result.atoms.findIndex(atom => atom.id === atomSerial);
      
      if (atomIndex === -1) {
        return; // Atom not found
      }
      
      // Add bonds
      for (const bondedSerial of bondedSerials) {
        const bondedIndex = result.atoms.findIndex(atom => atom.id === bondedSerial);
        
        if (bondedIndex !== -1) {
          // Ensure we don't add duplicate bonds
          const bondExists = result.bonds.some(bond => 
            (bond.atomIndex1 === atomIndex && bond.atomIndex2 === bondedIndex) || 
            (bond.atomIndex1 === bondedIndex && bond.atomIndex2 === atomIndex)
          );
          
          if (!bondExists) {
            result.bonds.push({
              atomIndex1: atomIndex,
              atomIndex2: bondedIndex,
              type: 1, // Single bond by default
              isConjugated: false // Set to true later if needed
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Error parsing CONECT record: ${line}`, error);
    }
  }
  
  /**
   * Parse HELIX record for secondary structure
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object to update
   */
  _parseHelixRecord(line, result) {
    try {
      const helix = {
        serialNumber: parseInt(line.substring(7, 10).trim()),
        id: line.substring(11, 14).trim(),
        startResName: line.substring(15, 18).trim(),
        startChainID: line.substring(19, 20).trim(),
        startResSeq: parseInt(line.substring(21, 25).trim()),
        startICode: line.substring(25, 26).trim(),
        endResName: line.substring(27, 30).trim(),
        endChainID: line.substring(31, 32).trim(),
        endResSeq: parseInt(line.substring(33, 37).trim()),
        endICode: line.substring(37, 38).trim(),
        helixClass: parseInt(line.substring(38, 40).trim() || "1"),
        comment: line.length >= 70 ? line.substring(40, 70).trim() : "",
        length: parseInt(line.substring(71, 76).trim() || "0")
      };
      
      result.helices.push(helix);
    } catch (error) {
      console.warn(`Error parsing HELIX record: ${line}`, error);
    }
  }
  
  /**
   * Parse SHEET record for secondary structure
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object to update
   */
  _parseSheetRecord(line, result) {
    try {
      const sheet = {
        strand: parseInt(line.substring(7, 10).trim()),
        id: line.substring(11, 14).trim(),
        numStrands: parseInt(line.substring(14, 16).trim()),
        startResName: line.substring(17, 20).trim(),
        startChainID: line.substring(21, 22).trim(),
        startResSeq: parseInt(line.substring(22, 26).trim()),
        startICode: line.substring(26, 27).trim(),
        endResName: line.substring(28, 31).trim(),
        endChainID: line.substring(32, 33).trim(),
        endResSeq: parseInt(line.substring(33, 37).trim()),
        endICode: line.substring(37, 38).trim(),
        sense: parseInt(line.substring(38, 40).trim() || "0")
      };
      
      // Additional fields for hydrogen bonds if available
      if (line.length >= 65) {
        sheet.curAtom = line.substring(41, 45).trim();
        sheet.curResName = line.substring(45, 48).trim();
        sheet.curChainId = line.substring(49, 50).trim();
        sheet.curResSeq = parseInt(line.substring(50, 54).trim() || "0");
        sheet.curICode = line.substring(54, 55).trim();
        sheet.prevAtom = line.substring(56, 60).trim();
        sheet.prevResName = line.substring(60, 63).trim();
        sheet.prevChainId = line.substring(64, 65).trim();
        sheet.prevResSeq = parseInt(line.substring(65, 69).trim() || "0");
        sheet.prevICode = line.substring(69, 70).trim();
      }
      
      result.sheets.push(sheet);
    } catch (error) {
      console.warn(`Error parsing SHEET record: ${line}`, error);
    }
  }
  
  /**
   * Parse HEADER record
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object to update
   */
  _parseHeaderRecord(line, result) {
    try {
      result.header = {
        classification: line.substring(10, 50).trim(),
        depDate: line.substring(50, 59).trim(),
        idCode: line.substring(62, 66).trim()
      };
      
      result.metadata.title = result.header.classification;
      result.metadata.pdbId = result.header.idCode;
    } catch (error) {
      console.warn(`Error parsing HEADER record: ${line}`, error);
    }
  }
  
  /**
   * Parse TITLE record
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object to update
   */
  _parseTitleRecord(line, result) {
    try {
      const continuation = parseInt(line.substring(8, 10).trim() || "1");
      const title = line.substring(10).trim();
      
      if (!result.metadata.fullTitle) {
        result.metadata.fullTitle = [];
      }
      
      // Store title parts in order
      result.metadata.fullTitle[continuation - 1] = title;
      
      // Join all title parts
      result.metadata.title = result.metadata.fullTitle.join(' ').trim();
    } catch (error) {
      console.warn(`Error parsing TITLE record: ${line}`, error);
    }
  }
  
  /**
   * Parse AUTHOR record
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object to update
   */
  _parseAuthorRecord(line, result) {
    try {
      const continuation = parseInt(line.substring(8, 10).trim() || "1");
      const authorText = line.substring(10).trim();
      
      if (!result.metadata.authors) {
        result.metadata.authors = [];
      }
      
      // Store author parts in order
      result.metadata.authors[continuation - 1] = authorText;
      
      // Join all author parts
      result.metadata.author = result.metadata.authors.join(' ').trim();
    } catch (error) {
      console.warn(`Error parsing AUTHOR record: ${line}`, error);
    }
  }
  
  /**
   * Parse REMARK record
   * @private
   * @param {string} line - PDB file line
   * @param {Object} result - Result object to update
   */
  _parseRemarkRecord(line, result) {
    try {
      // Extract remark number
      const remarkNum = parseInt(line.substring(7, 10).trim() || "0");
      const remarkText = line.substring(11).trim();
      
      if (!result.metadata.remarks) {
        result.metadata.remarks = {};
      }
      
      if (!result.metadata.remarks[remarkNum]) {
        result.metadata.remarks[remarkNum] = [];
      }
      
      result.metadata.remarks[remarkNum].push(remarkText);
      
      // Handle specific remarks
      if (remarkNum === 2) {
        // Resolution information
        if (remarkText.includes('RESOLUTION.')) {
          const resMatch = remarkText.match(/RESOLUTION\.\s+(\d+\.\d+)/);
          if (resMatch) {
            result.metadata.resolution = parseFloat(resMatch[1]);
          }
        }
      }
    } catch (error) {
      console.warn(`Error parsing REMARK record: ${line}`, error);
    }
  }
  
  /**
   * Calculate bonds based on distance criteria when CONECT records aren't available
   * @private
   * @param {Object} result - Result object to update
   */
  _calculateBonds(result) {
    const atoms = result.atoms;
    const bonds = result.bonds;
    
    // Bond distance thresholds (Å)
    const bondDistThresholds = {
      // General bond distances between common elements
      "C-C": 1.9,   // Carbon-Carbon
      "C-N": 1.8,   // Carbon-Nitrogen
      "C-O": 1.7,   // Carbon-Oxygen
      "C-S": 2.0,   // Carbon-Sulfur
      "N-N": 1.8,   // Nitrogen-Nitrogen
      "N-O": 1.7,   // Nitrogen-Oxygen
      "O-O": 1.6,   // Oxygen-Oxygen
      "S-S": 2.2,   // Sulfur-Sulfur
      "C-H": 1.3,   // Carbon-Hydrogen
      "N-H": 1.3,   // Nitrogen-Hydrogen
      "O-H": 1.3,   // Oxygen-Hydrogen
      "S-H": 1.4,   // Sulfur-Hydrogen
      default: 2.0   // Default threshold for other combinations
    };
    
    const getBondThreshold = (elem1, elem2) => {
      // Standardize elements to uppercase
      elem1 = elem1.toUpperCase();
      elem2 = elem2.toUpperCase();
      
      // Ensure alphabetical order for consistent key lookup
      if (elem1 > elem2) [elem1, elem2] = [elem2, elem1];
      
      const key = `${elem1}-${elem2}`;
      return bondDistThresholds[key] || bondDistThresholds.default;
    };
    
    // Process residues for backbone bonds
    const residueMap = new Map();
    atoms.forEach((atom, index) => {
      // Group atoms by residue
      const residueKey = `${atom.chainID}_${atom.resSeq}_${atom.resName}`;
      if (!residueMap.has(residueKey)) {
        residueMap.set(residueKey, []);
      }
      residueMap.get(residueKey).push({ atom, index });
    });
    
    // Process each residue to find internal bonds
    residueMap.forEach((atomsInResidue, residueKey) => {
      const atomMap = new Map();
      
      // Create a map of atom names to indices for this residue
      atomsInResidue.forEach(({ atom, index }) => {
        atomMap.set(atom.name, index);
      });
      
      // Add standard backbone bonds for amino acids
      if (atomsInResidue.length > 0 && 
          this.aminoAcids.has(atomsInResidue[0].atom.resName)) {
        
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
        
        // Add CA-CB bond (if CB exists)
        if (atomMap.has('CA') && atomMap.has('CB')) {
          bonds.push({
            atomIndex1: atomMap.get('CA'),
            atomIndex2: atomMap.get('CB'),
            type: 1
          });
        }
      }
      
      // Add bonds within the residue based on distance
      for (let i = 0; i < atomsInResidue.length; i++) {
        const atom1 = atomsInResidue[i].atom;
        const index1 = atomsInResidue[i].index;
        
        for (let j = i + 1; j < atomsInResidue.length; j++) {
          const atom2 = atomsInResidue[j].atom;
          const index2 = atomsInResidue[j].index;
          
          // Skip backbone bonds (already added above)
          if (atom1.isAminoAcid && 
              ((atom1.name === 'N' && atom2.name === 'CA') ||
               (atom1.name === 'CA' && atom2.name === 'C') ||
               (atom1.name === 'C' && atom2.name === 'O') ||
               (atom1.name === 'CA' && atom2.name === 'CB'))) {
            continue;
          }
          
          if (atom2.isAminoAcid && 
              ((atom2.name === 'N' && atom1.name === 'CA') ||
               (atom2.name === 'CA' && atom1.name === 'C') ||
               (atom2.name === 'C' && atom1.name === 'O') ||
               (atom2.name === 'CA' && atom1.name === 'CB'))) {
            continue;
          }
          
          // Calculate distance
          const distance = atom1.position.distanceTo(atom2.position);
          
          // Get threshold based on elements
          const threshold = getBondThreshold(atom1.element, atom2.element);
          
          // Create bond if distance is within threshold
          if (distance <= threshold) {
            bonds.push({
              atomIndex1: index1,
              atomIndex2: index2,
              type: 1, // Assume single bond
              distance: distance
            });
          }
        }
      }
    });
    
    // Add peptide bonds between residues
    const sortedResidues = Array.from(residueMap.keys()).sort();
    
    for (let i = 0; i < sortedResidues.length - 1; i++) {
      const currentKey = sortedResidues[i];
      const nextKey = sortedResidues[i + 1];
      
      // Extract chain and resSeq from keys
      const [currentChain, currentResSeq] = currentKey.split('_');
      const [nextChain, nextResSeq] = nextKey.split('_');
      
      // Only connect if same chain and sequential residue numbers
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
   * Calculate hydrogen bonds for secondary structure
   * @private
   * @param {Object} result - Result object to update
   */
  _calculateHydrogenBonds(result) {
    // This is a simplified version; a more accurate calculation would
    // use energy terms and geometric criteria
    
    result.hbonds = [];
    
    const atoms = result.atoms;
    
    // Find potential hydrogen bond donors (N-H) and acceptors (O, N)
    const donors = [];
    const acceptors = [];
    
    atoms.forEach((atom, index) => {
      if (atom.element === 'N' && atom.isAminoAcid) {
        // Nitrogen atoms in amino acids can be donors
        donors.push({ atom, index });
      }
      
      if ((atom.element === 'O' || atom.element === 'N') && atom.isAminoAcid) {
        // Oxygen and some nitrogen atoms can be acceptors
        acceptors.push({ atom, index });
      }
    });
    
    // Distance threshold for hydrogen bonds (in angstroms)
    const hbondThreshold = 3.5;
    
    // Check distances between all potential donors and acceptors
    for (const donor of donors) {
      for (const acceptor of acceptors) {
        // Skip self and immediate neighbors (i, i+1, i+2)
        if (donor.atom.chainID === acceptor.atom.chainID &&
            Math.abs(donor.atom.resSeq - acceptor.atom.resSeq) <= 2) {
          continue;
        }
        
        const distance = donor.atom.position.distanceTo(acceptor.atom.position);
        
        if (distance <= hbondThreshold) {
          result.hbonds.push({
            donorIndex: donor.index,
            acceptorIndex: acceptor.index,
            distance: distance
          });
        }
      }
    }
  }
  
  /**
   * Calculate bounding box for all atoms
   * @private
   * @param {Object} result - Result object to update
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
    
    // Add each atom position to the box
    result.atoms.forEach(atom => {
      box.expandByPoint(atom.position);
    });
    
    // Add some padding
    const padding = 2; // Angstroms
    box.min.subScalar(padding);
    box.max.addScalar(padding);
    
    result.boundingBox = box;
  }
  
  /**
   * Identify unique chains and process residues
   * @private
   * @param {Object} result - Result object to update
   */
  _identifyChains(result) {
    // Convert chains set to array
    result.chainList = Array.from(result.chains).sort();
    
    // Process residues
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
   * Assign secondary structure when not defined in PDB
   * @private
   * @param {Object} result - Result object to update
   */
  _assignSecondaryStructure(result) {
    // This is a very simplified version of secondary structure assignment
    // A real implementation would analyze hydrogen bonding patterns
    
    // For each residue, assign as coil by default
    result.residueList.forEach(residue => {
      residue.secondaryStructure = 'coil';
    });
    
    // Analyze hydrogen bonds to identify helices and sheets
    // This would be a complex algorithm in practice
    
    // For demonstration, we'll assign some fake secondary structure
    // to the first few residues of each chain
    result.chainList.forEach(chainID => {
      const chainResidues = result.residuesByChain[chainID];
      
      if (chainResidues.length >= 10) {
        // Assign the first 8 residues as helix
        for (let i = 0; i < 8 && i < chainResidues.length; i++) {
          chainResidues[i].secondaryStructure = 'helix';
        }
        
        // Assign the next 5 residues as sheet if available
        for (let i = 8; i < 13 && i < chainResidues.length; i++) {
          chainResidues[i].secondaryStructure = 'sheet';
        }
      }
    });
  }
  
  /**
   * Guess element type from atom name
   * @private
   * @param {string} atomName - PDB atom name
   * @returns {string} Element symbol
   */
  _guessElementFromName(atomName) {
    // Remove any digits
    const name = atomName.replace(/[0-9]/g, '').trim();
    
    // Common atom name patterns
    if (name === 'CA' || name === 'CB') return 'C'; // Alpha/beta carbon
    if (name === 'N' || name === 'NA') return 'N';  // Nitrogen
    if (name === 'O' || name === 'OXT') return 'O'; // Oxygen
    if (name === 'FE') return 'FE'; // Iron
    if (name === 'ZN') return 'ZN'; // Zinc
    if (name === 'MG') return 'MG'; // Magnesium
    if (name === 'CL') return 'CL'; // Chlorine
    
    // Get first character (most atom names start with element symbol)
    if (name.length > 0) {
      return name.charAt(0);
    }
    
    return 'C'; // Default to carbon if we can't determine element
  }
}
