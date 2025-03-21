/**
 * ProteinShowcaseRenderer.js - High-quality protein renderer with artistic effects
 * Provides a simple interface for rendering proteins with customizable artistic effects
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ArtisticEffects } from './ArtisticEffects.js';

export class ProteinShowcaseRenderer {
  /**
   * Create a new protein showcase renderer
   * @param {Object} options - Configuration options
   * @param {HTMLElement|string} options.container - Container element or ID
   * @param {string} [options.backgroundColor='#1a1a2e'] - Background color
   * @param {boolean} [options.shadows=false] - Whether to enable shadows
   * @param {boolean} [options.antialias=true] - Whether to enable antialiasing
   */
  constructor(options = {}) {
    // Get container
    this.container = typeof options.container === 'string' 
      ? document.getElementById(options.container)
      : options.container;
      
    if (!this.container) {
      throw new Error('Container element not found');
    }
    
    // Set configuration options
    this.config = {
      backgroundColor: options.backgroundColor || '#1a1a2e',
      shadows: options.shadows !== undefined ? options.shadows : false,
      antialias: options.antialias !== undefined ? options.antialias : true,
      pixelRatio: options.pixelRatio || Math.min(window.devicePixelRatio, 2)
    };
    
    // Initialize state
    this.state = {
      isInitialized: false,
      isRendering: false,
      activeEffect: 'standard',
      autoRotate: false,
      contextLost: false
    };
    
    // Container for geometries
    this.geometries = new Map();
    
    // Container for materials
    this.materials = new Map();
    
    // Container for meshes and groups
    this.meshes = new Map();
    
    // Main rendering objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = null;
    
    // Artistic effects manager
    this.effectsManager = null;
    
    // Current protein model
    this.proteinModel = null;
    
    // Initialize
    this._initialize();
    
    // Handle window resize
    window.addEventListener('resize', this._handleResize.bind(this));
  }
  
  /**
   * Initialize the renderer and scene
   * @private
   */
  _initialize() {
    try {
      // Create scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(this.config.backgroundColor);
      
      // Create camera
      const aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      this.camera.position.set(0, 0, 50);
      
      // Create renderer with context loss handling
      this.renderer = this._createRenderer();
      this.container.appendChild(this.renderer.domElement);
      
      // Create clock for animations
      this.clock = new THREE.Clock();
      
      // Create controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      
      // Set up lighting
      this._setupLighting();
      
      // Create artistic effects manager
      this.effectsManager = new ArtisticEffects({
        renderer: this.renderer,
        camera: this.camera
      });
      
      // Create test cube for initial scene
      this._createTestCube();
      
      // Start rendering
      this._startRendering();
      
      // Set initialization flag
      this.state.isInitialized = true;
      
      console.log('ProteinShowcaseRenderer initialized successfully');
    } catch (error) {
      console.error('Error initializing ProteinShowcaseRenderer:', error);
      this._showError('Failed to initialize renderer: ' + error.message);
    }
  }
  
  /**
   * Create the WebGL renderer with context loss handling
   * @private
   * @returns {THREE.WebGLRenderer} Three.js renderer
   */
  _createRenderer() {
    // Create canvas
    const canvas = document.createElement('canvas');
    
    // Try to create renderer
    try {
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: this.config.antialias,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
      
      // Configure renderer
      renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      renderer.setPixelRatio(this.config.pixelRatio);
      renderer.shadowMap.enabled = this.config.shadows;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      
      // Setup context loss handling
      this._setupContextLossHandling(renderer);
      
      return renderer;
    } catch (error) {
      console.error('Error creating WebGL renderer:', error);
      
      // Try to create a simpler renderer as fallback
      try {
        const fallbackRenderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
          preserveDrawingBuffer: true
        });
        
        // Configure with minimal settings
        fallbackRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        fallbackRenderer.setPixelRatio(1);
        fallbackRenderer.shadowMap.enabled = false;
        
        // Setup context loss handling
        this._setupContextLossHandling(fallbackRenderer);
        
        return fallbackRenderer;
      } catch (fallbackError) {
        console.error('Failed to create even fallback renderer:', fallbackError);
        throw new Error('Could not initialize WebGL renderer');
      }
    }
  }
  
  /**
   * Set up WebGL context loss handling
   * @private
   * @param {THREE.WebGLRenderer} renderer - Three.js renderer
   */
  _setupContextLossHandling(renderer) {
    if (!renderer || !renderer.domElement) return;
    
    // Handle WebGL context loss
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context lost in ProteinShowcaseRenderer');
      event.preventDefault();
      
      this.state.contextLost = true;
      this._stopRendering();
      
      // Show context loss message
      this._showError('WebGL context lost. Attempting to recover...');
      
      // Try to recover after a delay
      setTimeout(() => {
        this._attemptContextRecovery();
      }, 2000);
    }, false);
    
    // Handle WebGL context restoration
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored in ProteinShowcaseRenderer');
      this.state.contextLost = false;
      
      // Hide error message
      this._hideError();
      
      // Reinitialize renderer properties
      this._onContextRestored();
      
      // Resume rendering
      this._startRendering();
    }, false);
  }
  
  /**
   * Attempt to recover from context loss
   * @private
   */
  _attemptContextRecovery() {
    if (!this.state.contextLost) return;
    
    console.log('Attempting context recovery...');
    
    try {
      // Get the WebGL context
      const gl = this.renderer.getContext();
      
      // Try to use the WEBGL_lose_context extension to restore
      const extension = gl.getExtension('WEBGL_lose_context');
      if (extension) {
        console.log('Using WEBGL_lose_context to attempt restoration');
        extension.restoreContext();
      } else {
        console.warn('WEBGL_lose_context extension not available for recovery');
        
        // Show message to refresh
        this._showError('WebGL context could not be restored. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error during context recovery attempt:', error);
      
      // Show message to refresh
      this._showError('WebGL context recovery failed. Please refresh the page.');
    }
  }
  
  /**
   * Handle actions after context is restored
   * @private
   */
  _onContextRestored() {
    console.log('Handling context restoration');
    
    // Reset renderer configuration
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(this.config.pixelRatio);
    this.renderer.shadowMap.enabled = this.config.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // If effects manager exists, dispose and recreate
    if (this.effectsManager) {
      this.effectsManager.dispose();
      this.effectsManager = new ArtisticEffects({
        renderer: this.renderer,
        camera: this.camera
      });
    }
    
    // Recreate all materials with current effect
    if (this.proteinModel) {
      this._updateAllMaterials();
    }
  }
  
  /**
   * Set up lighting for the scene
   * @private
   */
  _setupLighting() {
    // Create ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Create directional light for shadows
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 10, 10);
    mainLight.castShadow = this.config.shadows;
    
    if (this.config.shadows) {
      mainLight.shadow.camera.near = 0.1;
      mainLight.shadow.camera.far = 100;
      mainLight.shadow.camera.left = -10;
      mainLight.shadow.camera.right = 10;
      mainLight.shadow.camera.top = 10;
      mainLight.shadow.camera.bottom = -10;
      mainLight.shadow.mapSize.width = 1024;
      mainLight.shadow.mapSize.height = 1024;
    }
    
    this.scene.add(mainLight);
    
    // Add some fill lights for better illumination
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight1.position.set(-10, -5, -10);
    this.scene.add(fillLight1);
    
    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight2.position.set(0, -10, 0);
    this.scene.add(fillLight2);
  }
  
  /**
   * Create a test cube for initial scene
   * @private
   */
  _createTestCube() {
    // Create geometry
    const geometry = new THREE.BoxGeometry(5, 5, 5);
    
    // Create material with standard effect
    const material = this.effectsManager.getMaterial('standard', {
      color: new THREE.Color(0x3498db)
    });
    
    // Create mesh
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = this.config.shadows;
    cube.receiveShadow = this.config.shadows;
    
    // Add to scene
    this.scene.add(cube);
    
    // Store for later use
    this.meshes.set('test-cube', cube);
  }
  
  /**
   * Start the rendering loop
   * @private
   */
  _startRendering() {
    if (this.state.isRendering) return;
    
    this.state.isRendering = true;
    this._render();
  }
  
  /**
   * Stop the rendering loop
   * @private
   */
  _stopRendering() {
    this.state.isRendering = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Main render function (called every frame)
   * @private
   */
  _render() {
    if (!this.state.isRendering) return;
    
    // Request next frame
    this.animationFrameId = requestAnimationFrame(this._render.bind(this));
    
    // Skip if context is lost
    if (this.state.contextLost) return;
    
    // Update controls
    this.controls.update();
    
    // Get delta time for animations
    const delta = this.clock.getDelta();
    
    // Update effects
    if (this.effectsManager) {
      this.effectsManager.update(delta);
    }
    
    // Update test cube rotation
    const cube = this.meshes.get('test-cube');
    if (cube) {
      cube.rotation.x += 0.005;
      cube.rotation.y += 0.01;
    }
    
    // Render scene
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('Error rendering scene:', error);
      
      // Stop rendering on error
      this._stopRendering();
    }
  }
  
  /**
   * Handle window resize
   * @private
   */
  _handleResize() {
    if (!this.renderer || !this.camera) return;
    
    // Update camera aspect ratio
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    
    // Update renderer size
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  /**
   * Show error message overlay
   * @private
   * @param {string} message - Error message to display
   */
  _showError(message) {
    // Create error display if it doesn't exist
    if (!this.errorDisplay) {
      this.errorDisplay = document.createElement('div');
      this.errorDisplay.style.position = 'absolute';
      this.errorDisplay.style.top = '0';
      this.errorDisplay.style.left = '0';
      this.errorDisplay.style.width = '100%';
      this.errorDisplay.style.height = '100%';
      this.errorDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      this.errorDisplay.style.color = 'white';
      this.errorDisplay.style.display = 'flex';
      this.errorDisplay.style.alignItems = 'center';
      this.errorDisplay.style.justifyContent = 'center';
      this.errorDisplay.style.textAlign = 'center';
      this.errorDisplay.style.padding = '20px';
      this.errorDisplay.style.zIndex = '1000';
      this.errorDisplay.style.fontFamily = 'Arial, sans-serif';
      
      // Make sure container is relatively positioned for absolute positioning
      if (this.container.style.position !== 'absolute' && 
          this.container.style.position !== 'relative') {
        this.container.style.position = 'relative';
      }
      
      this.container.appendChild(this.errorDisplay);
    }
    
    // Set error message
    this.errorDisplay.innerHTML = `
      <div>
        <h3 style="margin-bottom: 10px;">Error</h3>
        <p>${message}</p>
      </div>
    `;
    
    // Show error display
    this.errorDisplay.style.display = 'flex';
  }
  
  /**
   * Hide error message overlay
   * @private
   */
  _hideError() {
    if (this.errorDisplay) {
      this.errorDisplay.style.display = 'none';
    }
  }
  
  /**
   * Load and display a protein model 
   * @param {Object} proteinData - Protein data (atoms, bonds, etc.)
   * @returns {Promise<void>} Promise that resolves when protein is loaded
   */
  async loadProtein(proteinData) {
    if (!proteinData || !proteinData.atoms || proteinData.atoms.length === 0) {
      throw new Error('Invalid protein data');
    }
    
    try {
      // Store protein data
      this.proteinModel = proteinData;
      
      // Remove test cube
      const testCube = this.meshes.get('test-cube');
      if (testCube) {
        this.scene.remove(testCube);
        this.meshes.delete('test-cube');
      }
      
      // Clear existing protein visualization
      this._clearProteinVisualization();
      
      // Create new visualization
      await this._createProteinVisualization();
      
      // Center camera on protein
      this._centerCameraOnProtein();
      
      return true;
    } catch (error) {
      console.error('Error loading protein:', error);
      this._showError('Failed to load protein: ' + error.message);
      return false;
    }
  }
  
  /**
   * Clear existing protein visualization
   * @private
   */
  _clearProteinVisualization() {
    // Remove existing protein group
    const proteinGroup = this.meshes.get('protein-group');
    if (proteinGroup) {
      this.scene.remove(proteinGroup);
    }
    
    // Dispose of geometries and materials
    this.geometries.forEach(geometry => {
      if (geometry.dispose) {
        geometry.dispose();
      }
    });
    
    this.materials.forEach(material => {
      if (material.dispose) {
        material.dispose();
      }
    });
    
    // Clear collections
    this.geometries.clear();
    this.materials.clear();
    
    // Clear protein meshes
    this.meshes.delete('protein-group');
    this.meshes.delete('atoms-group');
    this.meshes.delete('bonds-group');
  }
  
  /**
   * Create visualization for the current protein model
   * @private
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async _createProteinVisualization() {
    // Create group for protein
    const proteinGroup = new THREE.Group();
    proteinGroup.name = 'Protein';
    
    // Create groups for atoms and bonds
    const atomsGroup = new THREE.Group();
    atomsGroup.name = 'Atoms';
    
    const bondsGroup = new THREE.Group();
    bondsGroup.name = 'Bonds';
    
    // Add to protein group
    proteinGroup.add(atomsGroup);
    proteinGroup.add(bondsGroup);
    
    // Add to scene
    this.scene.add(proteinGroup);
    
    // Store references
    this.meshes.set('protein-group', proteinGroup);
    this.meshes.set('atoms-group', atomsGroup);
    this.meshes.set('bonds-group', bondsGroup);
    
    // Create ball and stick visualization
    await this._createBallAndStickVisualization(atomsGroup, bondsGroup);
    
    // Find center of mass
    const centerOfMass = this._calculateCenterOfMass();
    
    // Center the protein group at origin
    proteinGroup.position.copy(centerOfMass.clone().negate());
    
    return proteinGroup;
  }
  
  /**
   * Create ball and stick visualization for protein
   * @private
   * @param {THREE.Group} atomsGroup - Group for atom meshes
   * @param {THREE.Group} bondsGroup - Group for bond meshes
   * @returns {Promise<void>} Promise that resolves when visualization is created
   */
  async _createBallAndStickVisualization(atomsGroup, bondsGroup) {
    return new Promise(resolve => {
      // Configuration
      const atomScale = 0.4; // Scale factor for atom radii
      const bondScale = 0.2; // Scale for bond radius
      
      // Create shared geometries
      const sphereGeom = new THREE.IcosahedronGeometry(1.0, 2);
      const cylinderGeom = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
      cylinderGeom.rotateX(Math.PI / 2);
      
      // Store shared geometries
      this.geometries.set('sphere', sphereGeom);
      this.geometries.set('cylinder', cylinderGeom);
      
      // Group materials by element for efficiency
      const elementMaterials = new Map();
      
      // Track atoms and bonds for processing
      const atoms = this.proteinModel.atoms;
      const bonds = this.proteinModel.bonds;
      
      // Process atoms (use chunking for large proteins)
      const processAtoms = () => {
        const CHUNK_SIZE = 500;
        let processedCount = 0;
        
        const processChunk = () => {
          const remaining = atoms.length - processedCount;
          
          if (remaining <= 0) {
            // Move on to processing bonds
            processBonds();
            return;
          }
          
          // Process a chunk of atoms
          const chunkSize = Math.min(CHUNK_SIZE, remaining);
          
          for (let i = 0; i < chunkSize; i++) {
            const atom = atoms[processedCount + i];
            
            // Skip hydrogen for performance
            if (atom.element === 'H') continue;
            
            // Get material for this element
            let material;
            
            if (elementMaterials.has(atom.element)) {
              material = elementMaterials.get(atom.element);
            } else {
              // Create new material
              const color = this._getAtomColor(atom);
              
              material = this.effectsManager.getMaterial(this.state.activeEffect, {
                color: color,
                roughness: 0.4,
                metalness: 0.2
              });
              
              // Store for reuse
              elementMaterials.set(atom.element, material);
              this.materials.set(`atom-${atom.element}`, material);
            }
            
            // Create atom mesh
            const mesh = new THREE.Mesh(sphereGeom, material);
            
            // Scale by atom radius
            const radius = atom.radius * atomScale;
            mesh.scale.set(radius, radius, radius);
            
            // Position
            mesh.position.set(atom.position.x, atom.position.y, atom.position.z);
            
            // Set shadows
            mesh.castShadow = this.config.shadows;
            mesh.receiveShadow = this.config.shadows;
            
            // Add to group
            atomsGroup.add(mesh);
          }
          
          // Update processed count
          processedCount += chunkSize;
          
          // Process next chunk with setTimeout for better responsiveness
          setTimeout(processChunk, 0);
        };
        
        // Start processing atoms
        processChunk();
      };
      
      // Process bonds (after atoms are processed)
      const processBonds = () => {
        const CHUNK_SIZE = 500;
        let processedCount = 0;
        
        // Create bond material
        const bondMaterial = this.effectsManager.getMaterial(this.state.activeEffect, {
          color: new THREE.Color(0x808080),
          roughness: 0.5,
          metalness: 0.0
        });
        
        this.materials.set('bond', bondMaterial);
        
        const processChunk = () => {
          const remaining = bonds.length - processedCount;
          
          if (remaining <= 0) {
            // All done
            resolve();
            return;
          }
          
          // Process a chunk of bonds
          const chunkSize = Math.min(CHUNK_SIZE, remaining);
          
          for (let i = 0; i < chunkSize; i++) {
            const bond = bonds[processedCount + i];
            
            const atom1 = atoms[bond.atomIndex1];
            const atom2 = atoms[bond.atomIndex2];
            
            // Skip if either atom doesn't exist
            if (!atom1 || !atom2) continue;
            
            // Skip bonds involving hydrogen for performance
            if (atom1.element === 'H' || atom2.element === 'H') continue;
            
            // Calculate bond vector
            const startPos = new THREE.Vector3(atom1.position.x, atom1.position.y, atom1.position.z);
            const endPos = new THREE.Vector3(atom2.position.x, atom2.position.y, atom2.position.z);
            const bondVector = endPos.clone().sub(startPos);
            
            // Calculate bond length and midpoint
            const bondLength = bondVector.length();
            const midpoint = startPos.clone().add(endPos).multiplyScalar(0.5);
            
            // Skip if bond is too long (probably an error)
            if (bondLength > 10) continue;
            
            // Create bond mesh
            const bondMesh = new THREE.Mesh(cylinderGeom, bondMaterial);
            
            // Scale
            bondMesh.scale.set(bondScale, bondLength, bondScale);
            
            // Position at midpoint
            bondMesh.position.copy(midpoint);
            
            // Orient along bond vector
            const direction = bondVector.clone().normalize();
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            bondMesh.quaternion.copy(quaternion);
            
            // Set shadows
            bondMesh.castShadow = this.config.shadows;
            bondMesh.receiveShadow = this.config.shadows;
            
            // Add to group
            bondsGroup.add(bondMesh);
          }
          
          // Update processed count
          processedCount += chunkSize;
          
          // Process next chunk
          setTimeout(processChunk, 0);
        };
        
        // Start processing bonds
        processChunk();
      };
      
      // Start processing atoms
      processAtoms();
    });
  }
  
  /**
   * Calculate center of mass for protein
   * @private
   * @returns {THREE.Vector3} Center of mass
   */
  _calculateCenterOfMass() {
    const center = new THREE.Vector3();
    
    if (!this.proteinModel || !this.proteinModel.atoms || this.proteinModel.atoms.length === 0) {
      return center;
    }
    
    // Average atom positions (simple centroid)
    const atoms = this.proteinModel.atoms;
    let count = 0;
    
    atoms.forEach(atom => {
      center.x += atom.position.x;
      center.y += atom.position.y;
      center.z += atom.position.z;
      count++;
    });
    
    if (count > 0) {
      center.divideScalar(count);
    }
    
    return center;
  }
  
  /**
   * Get color for an atom based on element
   * @private
   * @param {Object} atom - Atom data
   * @returns {THREE.Color} Atom color
   */
  _getAtomColor(atom) {
    // CPK coloring
    const elementColors = {
      'H': 0xFFFFFF, // White
      'C': 0x909090, // Grey
      'N': 0x3050F8, // Blue
      'O': 0xFF0D0D, // Red
      'S': 0xFFFF30, // Yellow
      'P': 0xFF8000, // Orange
      'F': 0x90E050, // Light Green
      'CL': 0x1FF01F, // Green
      'BR': 0xA62929, // Brown
      'I': 0x940094, // Purple
      'FE': 0xE06633, // Orange-Brown
      'CA': 0x3DFF00, // Bright Green
      'MG': 0x8AFF00  // Yellow-Green
    };
    
    // Get color by element
    const color = elementColors[atom.element] !== undefined ? 
      new THREE.Color(elementColors[atom.element]) : 
      new THREE.Color(0xFFFF00); // Default yellow
    
    return color;
  }
  
  /**
   * Center camera on protein
   * @private
   */
  _centerCameraOnProtein() {
    if (!this.proteinModel) return;
    
    // Calculate bounding box
    const box = new THREE.Box3();
    
    // Add atom positions to bounding box
    this.proteinModel.atoms.forEach(atom => {
      const position = new THREE.Vector3(atom.position.x, atom.position.y, atom.position.z);
      box.expandByPoint(position);
    });
    
    // Get bounding sphere
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    
    // Calculate ideal camera distance based on bounding sphere
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (sphere.radius * 2.5) / Math.sin(fov / 2);
    
    // Position camera
    this.camera.position.set(0, 0, distance);
    
    // Set control target to center of protein
    this.controls.target.copy(this.meshes.get('protein-group').position);
    this.controls.update();
  }
  
  /**
   * Set the active effect for visualization
   * @param {string} effectName - Effect preset name
   */
  setEffect(effectName) {
    if (!this.effectsManager) return;
    
    // Check if effect exists
    const presets = this.effectsManager.getAvailablePresets();
    if (!presets[effectName]) {
      console.warn(`Effect '${effectName}' not found, using 'standard' instead`);
      effectName = 'standard';
    }
    
    // Store current effect
    this.state.activeEffect = effectName;
    
    // Update materials
    this._updateAllMaterials();
  }
  
  /**
   * Update all materials with current effect
   * @private
   */
  _updateAllMaterials() {
    if (!this.effectsManager) return;
    
    // Get all materials
    const materials = Array.from(this.materials.values());
    
    // Update each material with current effect
    this.effectsManager.applyPreset(this.state.activeEffect, materials);
  }
  
  /**
   * Get a list of available effects
   * @returns {Object} Object with effect names as keys and descriptions as values
   */
  getAvailableEffects() {
    if (!this.effectsManager) return {};
    
    return this.effectsManager.getAvailablePresets();
  }
  
  /**
   * Set background color
   * @param {string} color - CSS color string
   */
  setBackgroundColor(color) {
    this.config.backgroundColor = color;
    this.scene.background = new THREE.Color(color);
  }
  
  /**
* Toggle auto-rotation
   * @param {boolean} [enable] - Whether to enable auto-rotation (toggles if not provided)
   */
  toggleAutoRotate(enable) {
    if (enable === undefined) {
      this.state.autoRotate = !this.state.autoRotate;
    } else {
      this.state.autoRotate = enable;
    }
    
    // Update controls
    if (this.controls) {
      this.controls.autoRotate = this.state.autoRotate;
      this.controls.autoRotateSpeed = 2.0;
    }
  }
  
  /**
   * Take screenshot of current view
   * @param {Object} [options] - Screenshot options
   * @param {number} [options.width] - Width of screenshot
   * @param {number} [options.height] - Height of screenshot
   * @param {number} [options.scale=2] - Scale factor
   * @returns {string|null} Data URL of screenshot or null if failed
   */
  takeScreenshot(options = {}) {
    if (!this.renderer || this.state.contextLost) {
      console.warn('Cannot take screenshot: renderer unavailable or context lost');
      return null;
    }
    
    try {
      // Get current size
      const currentSize = {
        width: this.renderer.domElement.width,
        height: this.renderer.domElement.height
      };
      
      // Set temporary screenshot size
      const width = options.width || currentSize.width;
      const height = options.height || currentSize.height;
      const scale = options.scale || 2;
      
      // Adjust renderer size if needed
      if (width !== currentSize.width || height !== currentSize.height) {
        this.renderer.setSize(width, height, false);
      } else if (scale !== 1) {
        // Use scale factor
        this.renderer.setSize(
          currentSize.width * scale,
          currentSize.height * scale,
          false
        );
      }
      
      // Render scene to capture screenshot
      this.renderer.render(this.scene, this.camera);
      
      // Get screenshot data
      const dataURL = this.renderer.domElement.toDataURL('image/png');
      
      // Restore original size
      this.renderer.setSize(currentSize.width, currentSize.height, false);
      
      // Re-render at original size
      this.renderer.render(this.scene, this.camera);
      
      return dataURL;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      return null;
    }
  }
  
  /**
   * Apply a watermark to a screenshot
   * @param {string} dataURL - Screenshot data URL
   * @param {Object} options - Watermark options
   * @param {string} [options.text='Created with Artistic Protein Visualizer'] - Watermark text
   * @param {string} [options.position='bottom-right'] - Watermark position
   * @param {string} [options.font='14px Arial'] - Font CSS
   * @param {string} [options.color='rgba(255, 255, 255, 0.7)'] - Text color
   * @returns {Promise<string>} Data URL with watermark
   */
  async applyWatermark(dataURL, options = {}) {
    return new Promise((resolve, reject) => {
      const text = options.text || 'Created with Artistic Protein Visualizer';
      const position = options.position || 'bottom-right';
      const font = options.font || '14px Arial';
      const color = options.color || 'rgba(255, 255, 255, 0.7)';
      
      // Create image to draw
      const img = new Image();
      
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Get context and draw original image
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Draw watermark text
        ctx.font = font;
        ctx.fillStyle = color;
        
        // Calculate text dimensions
        const textWidth = ctx.measureText(text).width;
        const textHeight = parseInt(font, 10) || 14;
        
        // Calculate position
        let x, y;
        const padding = 20;
        
        switch (position) {
          case 'top-left':
            x = padding;
            y = textHeight + padding;
            break;
          case 'top-right':
            x = canvas.width - textWidth - padding;
            y = textHeight + padding;
            break;
          case 'bottom-left':
            x = padding;
            y = canvas.height - padding;
            break;
          case 'bottom-right':
          default:
            x = canvas.width - textWidth - padding;
            y = canvas.height - padding;
            break;
        }
        
        // Draw text
        ctx.fillText(text, x, y);
        
        // Get data URL with watermark
        const watermarkedURL = canvas.toDataURL('image/png');
        
        resolve(watermarkedURL);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for watermarking'));
      };
      
      // Set image source to start loading
      img.src = dataURL;
    });
  }
  
  /**
   * Reset view to show the entire protein
   */
  resetView() {
    this._centerCameraOnProtein();
  }
  
  /**
   * Toggle shadows
   * @param {boolean} [enable] - Whether to enable shadows (toggles if not provided)
   */
  toggleShadows(enable) {
    if (enable === undefined) {
      this.config.shadows = !this.config.shadows;
    } else {
      this.config.shadows = enable;
    }
    
    // Update renderer
    if (this.renderer) {
      this.renderer.shadowMap.enabled = this.config.shadows;
      
      // Force shadow map update
      this.renderer.shadowMap.needsUpdate = true;
    }
    
    // Update all meshes
    this.scene.traverse(object => {
      if (object.isMesh) {
        object.castShadow = this.config.shadows;
        object.receiveShadow = this.config.shadows;
      }
    });
  }
  
  /**
   * Dispose of renderer resources
   */
  dispose() {
    // Stop rendering
    this._stopRendering();
    
    // Dispose of geometries
    this.geometries.forEach(geometry => {
      if (geometry.dispose) {
        geometry.dispose();
      }
    });
    
    // Dispose of materials
    this.materials.forEach(material => {
      if (material.dispose) {
        material.dispose();
      }
    });
    
    // Dispose of effects manager
    if (this.effectsManager && this.effectsManager.dispose) {
      this.effectsManager.dispose();
    }
    
    // Dispose of controls
    if (this.controls && this.controls.dispose) {
      this.controls.dispose();
    }
    
    // Dispose of renderer
    if (this.renderer && this.renderer.dispose) {
      this.renderer.dispose();
    }
    
    // Remove DOM elements
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    
    if (this.errorDisplay && this.errorDisplay.parentNode) {
      this.errorDisplay.parentNode.removeChild(this.errorDisplay);
    }
    
    // Remove event listeners
    window.removeEventListener('resize', this._handleResize.bind(this));
    
    // Clear references
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = null;
    this.effectsManager = null;
    this.geometries.clear();
    this.materials.clear();
    this.meshes.clear();
    this.proteinModel = null;
  }
}
