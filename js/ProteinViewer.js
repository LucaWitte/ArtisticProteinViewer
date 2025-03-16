/**
 * ProteinViewer.js - Main application for protein visualization
 * Implements a standalone viewer that can be added to any webpage
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { WebGLDetector } from './utils/WebGLDetector.js';
import { RendererFactory } from './app/RendererFactory.js';
import { PDBLoader } from './loaders/PDBLoader.js';
import { ProteinShader } from './shaders/ProteinShader.js';

export class ProteinViewer {
  /**
   * Create a new protein viewer
   * @param {Object} options - Viewer configuration
   * @param {string|HTMLElement} options.container - Container element or ID
   * @param {string} [options.backgroundColor='#1a1a2e'] - Background color
   * @param {string} [options.defaultUrl=null] - Default PDB URL to load
   */
  constructor(options) {
    // Get container
    this.container = typeof options.container === 'string' 
      ? document.getElementById(options.container)
      : options.container;
      
    if (!this.container) {
      throw new Error('Container element not found');
    }
    
    // Set configuration
    this.config = {
      backgroundColor: options.backgroundColor || '#1a1a2e',
      defaultUrl: options.defaultUrl || null,
      initialStyle: options.initialStyle || 'ball-stick',
      initialShader: options.initialShader || 'standard'
    };
    
    // Initialize state
    this.state = {
      isInitialized: false,
      isLoading: false,
      isReady: false,
      currentStyle: this.config.initialStyle,
      currentShader: this.config.initialShader,
      effectStrength: 0.5
    };
    
    // Storage for rendering objects
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.protein = null;
    
    // Bind methods to ensure correct this context
    this._handleResize = this._handleResize.bind(this);
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    this._handleContextLost = this._handleContextLost.bind(this);
    this._handleContextRestored = this._handleContextRestored.bind(this);
    
    // Monitor visible status
    this._setupVisibilityTracking();
    
    // Initialize the viewer
    this._init();
  }
  
  /**
   * Initialize the viewer
   * @private
   */
  async _init() {
    try {
      // Check WebGL support
      if (!WebGLDetector.isWebGLAvailable()) {
        this._showError('WebGL is not supported by your browser');
        return;
      }
      
      // Create canvas if needed
      if (!this.container.tagName || this.container.tagName !== 'CANVAS') {
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        
        this.container.appendChild(canvas);
        this.canvas = canvas;
      } else {
        this.canvas = this.container;
      }
      
      // Initialize viewer components
      await this._initRenderer();
      this._initScene();
      this._initCamera();
      this._initControls();
      this._initLights();
      this._initShaders();
      this._initEventListeners();
      
      // Start animation loop
      this._startAnimationLoop();
      
      // Set initialized flag
      this.state.isInitialized = true;
      
      // Load default model if specified
      if (this.config.defaultUrl) {
        this.loadProtein(this.config.defaultUrl);
      }
      
      // Emit initialized event
      this._emitEvent('initialized');
    } catch (error) {
      console.error('Error initializing protein viewer:', error);
      this._showError('Failed to initialize viewer: ' + error.message);
    }
  }
  
  /**
   * Initialize the WebGL renderer
   * @private
   */
  async _initRenderer() {
    try {
      // Create renderer with a fallback mechanism
      this.renderer = this._createRenderer();
      
      // Set initial size
      this._updateRendererSize();
      
      // Set background color
      this.renderer.setClearColor(new THREE.Color(this.config.backgroundColor), 1.0);
    } catch (error) {
      console.error('Error initializing renderer:', error);
      throw new Error('Failed to initialize WebGL renderer');
    }
  }
  
  /**
   * Create a WebGL renderer with fallback and error handling
   * @private
   * @returns {THREE.WebGLRenderer} The created renderer
   */
  _createRenderer() {
    // First try with recommended settings
    try {
      const renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
      
      // Set pixel ratio (capped for performance)
      const pixelRatio = window.devicePixelRatio || 1;
      renderer.setPixelRatio(Math.min(pixelRatio, 2));
      
      // Setup context handlers
      this._setupContextHandlers(renderer);
      
      console.log('WebGL renderer created successfully');
      return renderer;
    } catch (error) {
      console.warn('Error creating WebGL renderer with normal settings:', error);
      
      // Try again with minimal settings
      try {
        console.log('Attempting to create renderer with minimal settings');
        const renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'default'
        });
        
        // Setup context handlers
        this._setupContextHandlers(renderer);
        
        console.log('Fallback WebGL renderer created successfully');
        return renderer;
      } catch (fallbackError) {
        console.error('Failed to create even fallback renderer:', fallbackError);
        throw new Error('WebGL initialization failed');
      }
    }
  }
  
  /**
   * Setup context loss/restore handlers for renderer
   * @private
   * @param {THREE.WebGLRenderer} renderer - The renderer to monitor
   */
  _setupContextHandlers(renderer) {
    const gl = renderer.getContext();
    
    // Add context loss listener
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context loss detected');
      event.preventDefault();
      this._handleContextLost();
    }, false);
    
    // Add context restored listener
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
      this._handleContextRestored();
    }, false);
    
    // Add experimental context handler (only in Chrome)
    if (gl && gl.getExtension('WEBGL_lose_context')) {
      console.log('WEBGL_lose_context extension available');
    }
  }
  
  /**
   * Initialize the scene
   * @private
   */
  _initScene() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.config.backgroundColor);
    
    // Create container for protein
    this.proteinGroup = new THREE.Group();
    this.proteinGroup.name = 'ProteinContainer';
    this.scene.add(this.proteinGroup);
  }
  
  /**
   * Initialize the camera
   * @private
   */
  _initCamera() {
    // Calculate aspect ratio
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const aspect = width / height;
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 2000);
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);
  }
  
  /**
   * Initialize the controls
   * @private
   */
  _initControls() {
    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.8;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 500;
  }
  
  /**
   * Initialize lights
   * @private
   */
  _initLights() {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);
    
    // Directional light
    this.mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.mainLight.position.set(1, 1, 1);
    this.scene.add(this.mainLight);
    
    // Fill light
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    this.fillLight.position.set(-1, -0.5, -1);
    this.scene.add(this.fillLight);
    
    // Rim light
    this.rimLight = new THREE.HemisphereLight(0xffffff, 0x303030, 0.3);
    this.scene.add(this.rimLight);
  }
  
  /**
   * Initialize shaders
   * @private
   */
  _initShaders() {
    // Create shader manager
    this.shader = new ProteinShader({
      type: this.state.currentShader,
      renderer: this.renderer
    });
    
    // Set up context handling
    this.shader.onLost(() => {
      console.warn('Shader context lost');
    });
    
    this.shader.onRestored(() => {
      console.log('Shader context restored');
      if (this.protein) {
        this._updateProteinVisualization();
      }
    });
  }
  
  /**
   * Initialize event listeners
   * @private
   */
  _initEventListeners() {
    // Handle window resize
    window.addEventListener('resize', this._handleResize);
    
    // Handle visibility change
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
  }
  
  /**
   * Setup visibility tracking
   * @private
   */
  _setupVisibilityTracking() {
    this.isVisible = !document.hidden;
    
    // Use Intersection Observer when available
    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver((entries) => {
        this.isVisible = entries[0].isIntersecting;
      }, { threshold: 0.1 });
      
      // Start observing when container is available
      if (this.container) {
        this.visibilityObserver.observe(this.container);
      }
    }
  }
  
  /**
   * Start animation loop
   * @private
   */
  _startAnimationLoop() {
    let lastTime = 0;
    
    const animate = (time) => {
      if (!this.animationFrameId) {
        return; // Stop if animation was cancelled
      }
      
      this.animationFrameId = requestAnimationFrame(animate);
      
      // Skip if not visible or not initialized
      if (!this.isVisible || !this.state.isInitialized) {
        return;
      }
      
      // Calculate delta time for animations
      const delta = time - lastTime;
      lastTime = time;
      
      // Update controls
      if (this.controls && this.controls.update) {
        this.controls.update();
      }
      
      // Render scene
      if (this.renderer && this.scene && this.camera) {
        try {
          this.renderer.render(this.scene, this.camera);
        } catch (error) {
          console.error('Render error:', error);
        }
      }
    };
    
    this.animationFrameId = requestAnimationFrame(animate);
  }
  
  /**
   * Stop animation loop
   * @private
   */
  _stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Load a protein from URL
   * @param {string} url - URL to the PDB file
   * @returns {Promise<boolean>} Promise resolving to success status
   */
  async loadProtein(url) {
    if (this.state.isLoading) {
      console.warn('Already loading a protein, please wait');
      return false;
    }
    
    this.state.isLoading = true;
    this._hideError(); // Hide any previous errors
    this._emitEvent('loadStart', { url });
    
    try {
      // Remove existing protein
      this._clearProtein();
      
      // Create loader
      const loader = new PDBLoader();
      
      // Load PDB file
      const pdbData = await loader.load(url, (progress) => {
        this._emitEvent('loadProgress', { progress: progress * 100 });
      });
      
      // Create protein visualization
      await this._createProteinModel(pdbData);
      
      this.state.isLoading = false;
      this.state.isReady = true;
      
      this._emitEvent('loadComplete', { url });
      return true;
    } catch (error) {
      console.error('Error loading protein:', error);
      this.state.isLoading = false;
      this._emitEvent('loadError', { error });
      this._showError(`Failed to load protein: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Load a protein from a File object
   * @param {File} file - PDB file
   * @returns {Promise<boolean>} Promise resolving to success status
   */
  async loadProteinFromFile(file) {
    if (this.state.isLoading) {
      console.warn('Already loading a protein, please wait');
      return false;
    }
    
    this.state.isLoading = true;
    this._hideError(); // Hide any previous errors
    this._emitEvent('loadStart', { file });
    
    try {
      // Remove existing protein
      this._clearProtein();
      
      // Create loader
      const loader = new PDBLoader();
      
      // Load file
      const pdbData = await loader.loadFromFile(file, (progress) => {
        this._emitEvent('loadProgress', { progress: progress * 100 });
      });
      
      // Create protein visualization
      await this._createProteinModel(pdbData);
      
      this.state.isLoading = false;
      this.state.isReady = true;
      
      this._emitEvent('loadComplete', { file });
      return true;
    } catch (error) {
      console.error('Error loading protein from file:', error);
      this.state.isLoading = false;
      this._emitEvent('loadError', { error });
      this._showError(`Failed to load protein: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create a protein model from PDB data
   * @private
   * @param {Object} pdbData - Parsed PDB data
   */
  async _createProteinModel(pdbData) {
    if (!pdbData || !pdbData.atoms || pdbData.atoms.length === 0) {
      throw new Error('Invalid or empty PDB data');
    }
    
    try {
      // Create protein model
      this.protein = {
        atoms: pdbData.atoms,
        bonds: pdbData.bonds,
        residues: pdbData.residueList,
        chains: pdbData.chainList,
        boundingBox: pdbData.boundingBox,
        centerOfMass: pdbData.centerOfMass
      };
      
      // Create visualization
      await this._createVisualization();
      
      // Center camera on protein
      this._centerCamera();
    } catch (error) {
      console.error('Error creating protein model:', error);
      this._clearProtein();
      throw error;
    }
  }
  
  /**
   * Create visualization for current protein
   * @private
   */
  async _createVisualization() {
    if (!this.protein) return;
    
    // Clear existing visualization
    this._clearVisualization();
    
    // Function to create ball and stick visualization
    const createBallAndStick = async () => {
      // Group geometry by element for efficiency
      const atomsByElement = new Map();
      
      // Process atoms
      this.protein.atoms.forEach(atom => {
        const element = atom.element;
        if (!atomsByElement.has(element)) {
          atomsByElement.set(element, []);
        }
        atomsByElement.get(element).push(atom);
      });
      
      // Create atom geometries by element
      atomsByElement.forEach((atoms, element) => {
        // Skip if no atoms of this element
        if (atoms.length === 0) return;
        
        // Color for this element
        const color = new THREE.Color(atoms[0].color || '#ffffff');
        
        // Create geometry - lower segment count for better performance
        const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
        
        // Create material
        const material = this.shader.getMaterial({
          color: color,
          roughness: 0.4,
          metalness: 0.4
        });
        
        // Use instancing if available and beneficial
        if (atoms.length > 20 && typeof THREE.InstancedMesh !== 'undefined') {
          try {
            // Create instanced mesh for better performance
            const instancedMesh = new THREE.InstancedMesh(
              sphereGeometry,
              material,
              atoms.length
            );
            
            // Set positions and scales
            const matrix = new THREE.Matrix4();
            const centerOffset = new THREE.Vector3();
            centerOffset.copy(this.protein.centerOfMass);
            
            atoms.forEach((atom, i) => {
              const radius = atom.radius * 0.6; // Scale down for better visualization
              
              matrix.makeScale(radius, radius, radius);
              matrix.setPosition(
                atom.position.x - centerOffset.x,
                atom.position.y - centerOffset.y,
                atom.position.z - centerOffset.z
              );
              
              instancedMesh.setMatrixAt(i, matrix);
            });
            
            // Update matrices
            instancedMesh.instanceMatrix.needsUpdate = true;
            
            // Add to scene
            this.proteinGroup.add(instancedMesh);
            this.proteinMeshes.push(instancedMesh);
          } catch (instancingError) {
            console.warn('Instancing failed, falling back to individual meshes', instancingError);
            // Fall back to individual meshes
            this._createIndividualAtomMeshes(atoms, sphereGeometry, material, this.protein.centerOfMass);
          }
        } else {
          // Create individual meshes
          this._createIndividualAtomMeshes(atoms, sphereGeometry, material, this.protein.centerOfMass);
        }
      });
      
      // Create bond geometry
      const cylinderGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8, 1);
      // Rotate to align with Y axis
      cylinderGeometry.rotateX(Math.PI / 2);
      
      // Create bond material
      const bondMaterial = this.shader.getMaterial({
        color: 0x888888,
        roughness: 0.5,
        metalness: 0.3
      });
      
      // Create bonds
      this.protein.bonds.forEach(bond => {
        const atom1 = this.protein.atoms[bond.atomIndex1];
        const atom2 = this.protein.atoms[bond.atomIndex2];
        
        if (!atom1 || !atom2) return;
        
        // Get positions
        const pos1 = new THREE.Vector3(
          atom1.position.x - this.protein.centerOfMass.x,
          atom1.position.y - this.protein.centerOfMass.y,
          atom1.position.z - this.protein.centerOfMass.z
        );
        
        const pos2 = new THREE.Vector3(
          atom2.position.x - this.protein.centerOfMass.x,
          atom2.position.y - this.protein.centerOfMass.y,
          atom2.position.z - this.protein.centerOfMass.z
        );
        
        // Calculate bond length and center
        const bondVector = pos2.clone().sub(pos1);
        const bondLength = bondVector.length();
        const bondCenter = pos1.clone().add(pos2).multiplyScalar(0.5);
        
        // Create bond cylinder
        const bondMesh = new THREE.Mesh(cylinderGeometry, bondMaterial);
        bondMesh.position.copy(bondCenter);
        bondMesh.scale.set(1, bondLength, 1);
        
        // Orient bond
        bondMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          bondVector.clone().normalize()
        );
        
        // Add to scene
        this.proteinGroup.add(bondMesh);
        this.bondMeshes.push(bondMesh);
      });
    };
    
    // Create individual atom meshes for fallback
    this._createIndividualAtomMeshes = (atoms, geometry, material, centerOfMass) => {
      atoms.forEach(atom => {
        const mesh = new THREE.Mesh(geometry, material.clone());
        
        // Position and scale
        mesh.position.set(
          atom.position.x - centerOfMass.x,
          atom.position.y - centerOfMass.y,
          atom.position.z - centerOfMass.z
        );
        
        mesh.scale.multiplyScalar(atom.radius * 0.6);
        
        // Add to scene
        this.proteinGroup.add(mesh);
        this.proteinMeshes.push(mesh);
      });
    };
    
    // Function to create ribbon visualization
    const createRibbon = async () => {
      // For ribbon visualization, we'll create a simplified version
      // that just shows the backbone trace with a tube
      
      // Group by chain
      const chainMap = new Map();
      
      // Collect backbone atoms (CA) by chain
      this.protein.atoms.forEach(atom => {
        if (atom.name === 'CA') {
          if (!chainMap.has(atom.chainID)) {
            chainMap.set(atom.chainID, []);
          }
          chainMap.get(atom.chainID).push(atom);
        }
      });
      
      // Process each chain
      chainMap.forEach((atoms, chainID) => {
        // Sort atoms by residue sequence number
        atoms.sort((a, b) => a.resSeq - b.resSeq);
        
        // Need at least 2 atoms for a curve
        if (atoms.length < 2) return;
        
        // Extract positions
        const points = atoms.map(atom => new THREE.Vector3(
          atom.position.x - this.protein.centerOfMass.x,
          atom.position.y - this.protein.centerOfMass.y,
          atom.position.z - this.protein.centerOfMass.z
        ));
        
        // Create spline curve
        const curve = new THREE.CatmullRomCurve3(points);
        
        // Create tube geometry
        const tubeGeometry = new THREE.TubeGeometry(
          curve,
          Math.min(atoms.length * 4, 256), // segments
          0.3, // radius
          8, // radial segments
          false // closed
        );
        
        // Create material - color by chain
        const chainIndex = this.protein.chains.indexOf(chainID);
        const hue = (chainIndex / Math.max(1, this.protein.chains.length)) * 360;
        const chainColor = new THREE.Color().setHSL(hue / 360, 0.7, 0.5);
        
        const material = this.shader.getMaterial({
          color: chainColor,
          roughness: 0.3,
          metalness: 0.5
        });
        
        // Create mesh
        const tubeMesh = new THREE.Mesh(tubeGeometry, material);
        
        // Add to scene
        this.proteinGroup.add(tubeMesh);
        this.proteinMeshes.push(tubeMesh);
      });
    };
    
    // Function to create surface visualization
    const createSurface = async () => {
      // For surface, we'll fall back to ball and stick for now
      // as proper surface generation requires more complex algorithms
      await createBallAndStick();
    };
    
    // Initialize mesh arrays
    this.proteinMeshes = [];
    this.bondMeshes = [];
    
    // Create visualization based on style
    try {
      switch (this.state.currentStyle) {
        case 'ribbon':
          await createRibbon();
          break;
        case 'surface':
          await createSurface();
          break;
        case 'ball-stick':
        default:
          await createBallAndStick();
          break;
      }
      
      // Apply effect strength
      this._updateEffectStrength(this.state.effectStrength);
    } catch (error) {
      console.error('Error creating visualization:', error);
      // Fall back to simplest visualization
      this._createFallbackVisualization();
    }
  }
  
  /**
   * Create a simple fallback visualization
   * @private
   */
  _createFallbackVisualization() {
    // Clear any partial visualization
    this._clearVisualization();
    
    if (!this.protein || !this.protein.atoms || this.protein.atoms.length === 0) return;
    
    try {
      // Create a simple point cloud
      const positions = [];
      const colors = [];
      
      // Collect positions and colors
      this.protein.atoms.forEach(atom => {
        positions.push(
          atom.position.x - this.protein.centerOfMass.x,
          atom.position.y - this.protein.centerOfMass.y,
          atom.position.z - this.protein.centerOfMass.z
        );
        
        // Use element color
        const color = new THREE.Color(atom.color || '#ffffff');
        colors.push(color.r, color.g, color.b);
      });
      
      // Create geometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      // Create material
      const material = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true
      });
      
      // Create point cloud
      const points = new THREE.Points(geometry, material);
      this.proteinGroup.add(points);
      this.proteinMeshes.push(points);
    } catch (error) {
      console.error('Error creating fallback visualization:', error);
    }
  }
  
  /**
   * Clear protein data and visualization
   * @private
   */
  _clearProtein() {
    this.protein = null;
    this._clearVisualization();
  }
  
  /**
   * Clear current visualization
   * @private
   */
  _clearVisualization() {
    // Safe cleanup for proteinGroup
    if (this.proteinGroup) {
      while (this.proteinGroup.children.length > 0) {
        const child = this.proteinGroup.children[0];
        this.proteinGroup.remove(child);
        
        // Dispose of geometry and materials
        try {
          if (child.geometry) {
            child.geometry.dispose();
          }
          
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        } catch (error) {
          console.warn('Error disposing resources:', error);
        }
      }
    }
    
    this.proteinMeshes = [];
    this.bondMeshes = [];
  }
  
  /**
   * Update protein visualization
   * @private
   */
  _updateProteinVisualization() {
    if (!this.protein) return;
    
    try {
      // Clear existing visualization
      this._clearVisualization();
      
      // Recreate visualization
      this._createVisualization();
    } catch (error) {
      console.error('Error updating visualization:', error);
      this._createFallbackVisualization();
    }
  }
  
  /**
   * Center camera on protein
   * @private
   */
  _centerCamera() {
    if (!this.protein || !this.protein.boundingBox) return;
    
    try {
      const boundingBox = this.protein.boundingBox.clone();
      
      // Get center and size
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      
      // Center is already offset by protein center of mass
      center.sub(this.protein.centerOfMass);
      
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      // Calculate optimal distance
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const distance = (maxDim / 2) / Math.tan(fov / 2);
      
      // Position camera
      this.camera.position.copy(center);
      this.camera.position.z += distance * 1.2;
      
      // Set control target to center
      if (this.controls && this.controls.target) {
        this.controls.target.copy(center);
        this.controls.update();
      }
      
      // Look at center
      this.camera.lookAt(center);
    } catch (error) {
      console.warn('Error centering camera:', error);
    }
  }
  
  /**
   * Update the rendering size when container or window is resized
   * @private
   */
  _updateRendererSize() {
    if (!this.renderer || !this.canvas) return;
    
    try {
      const width = this.canvas.clientWidth || 1;
      const height = this.canvas.clientHeight || 1;
      
      // Update renderer size
      this.renderer.setSize(width, height, false);
      
      // Update camera aspect ratio
      if (this.camera) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
      }
    } catch (error) {
      console.warn('Error updating renderer size:', error);
    }
  }
  
  /**
   * Handle window resize
   * @private
   */
  _handleResize() {
    this._updateRendererSize();
  }
  
  /**
   * Handle visibility change
   * @private
   */
  _handleVisibilityChange() {
    this.isVisible = !document.hidden;
  }
  
  /**
   * Handle WebGL context loss
   * @private
   */
  _handleContextLost() {
    console.warn('WebGL context loss handled in protein viewer');
    
    // Mark renderer as unavailable
    this.rendererLost = true;
    
    // Emit event
    this._emitEvent('contextLost');
  }
  
  /**
   * Handle WebGL context restoration
   * @private
   */
  _handleContextRestored() {
    console.log('WebGL context restored in protein viewer');
    
    // Mark renderer as available again
    this.rendererLost = false;
    
    try {
      // Recreate visualization if needed
      if (this.protein) {
        this._updateProteinVisualization();
      }
      
      // Emit event
      this._emitEvent('contextRestored');
    } catch (error) {
      console.error('Error handling context restoration:', error);
    }
  }
  
  /**
   * Show an error in the container
   * @private
   * @param {string} message - Error message
   */
  _showError(message) {
    console.error(message);
    
    // Create error display if not exists
    if (!this.errorDisplay) {
      this.errorDisplay = document.createElement('div');
      this.errorDisplay.style.position = 'absolute';
      this.errorDisplay.style.top = '0';
      this.errorDisplay.style.left = '0';
      this.errorDisplay.style.width = '100%';
      this.errorDisplay.style.height = '100%';
      this.errorDisplay.style.display = 'flex';
      this.errorDisplay.style.alignItems = 'center';
      this.errorDisplay.style.justifyContent = 'center';
      this.errorDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      this.errorDisplay.style.color = 'white';
      this.errorDisplay.style.padding = '20px';
      this.errorDisplay.style.textAlign = 'center';
      this.errorDisplay.style.fontSize = '16px';
      this.errorDisplay.style.zIndex = '1000';
      
      if (this.container.style.position !== 'absolute' && 
          this.container.style.position !== 'relative') {
        this.container.style.position = 'relative';
      }
      
      this.container.appendChild(this.errorDisplay);
    }
    
    // Set error message
    this.errorDisplay.innerHTML = `<div><strong>Error:</strong><br>${message}</div>`;
    this.errorDisplay.style.display = 'flex';
    
    // Emit error event
    this._emitEvent('error', { message });
  }
  
  /**
   * Hide the error display
   * @private
   */
  _hideError() {
    if (this.errorDisplay) {
      this.errorDisplay.style.display = 'none';
    }
  }
  
  /**
   * Emit an event
   * @private
   * @param {string} name - Event name
   * @param {Object} detail - Event details
   */
  _emitEvent(name, detail = {}) {
    const event = new CustomEvent(`proteinviewer:${name}`, {
      bubbles: true,
      detail: detail
    });
    
    this.container.dispatchEvent(event);
  }
  
  /* Public API */
  
  /**
   * Set visualization style
   * @param {string} style - Style name ('ball-stick', 'ribbon', 'surface')
   */
  setStyle(style) {
    if (this.state.currentStyle === style) return;
    
    this.state.currentStyle = style;
    
    // Update visualization if protein is loaded
    if (this.protein) {
      this._updateProteinVisualization();
    }
    
    this._emitEvent('styleChanged', { style });
  }
  
  /**
   * Set shader effect
   * @param {string} effect - Effect name ('standard', 'toon', 'glow', 'outline')
   */
  setShader(effect) {
    if (this.state.currentShader === effect) return;
    
    this.state.currentShader = effect;
    
    // Update shader
    if (this.shader) {
      this.shader.setType(effect);
    }
    
    // Update visualization if protein is loaded
    if (this.protein) {
      this._updateProteinVisualization();
    }
    
    this._emitEvent('shaderChanged', { effect });
  }
  
  /**
   * Set effect strength
   * @param {number} strength - Effect strength (0.0 - 1.0)
   */
  setEffectStrength(strength) {
    const value = Math.max(0, Math.min(1, strength));
    this.state.effectStrength = value;
    this._updateEffectStrength(value);
    this._emitEvent('effectStrengthChanged', { strength: value });
  }
  
  /**
   * Update effect strength on all materials
   * @private
   * @param {number} strength - Effect strength
   */
  _updateEffectStrength(strength) {
    if (!this.shader) return;
    
    try {
      // Apply to atom meshes
      if (this.proteinMeshes) {
        this.proteinMeshes.forEach(mesh => {
          if (mesh.material) {
            this.shader.updateEffectStrength(mesh.material, strength);
          }
        });
      }
      
      // Apply to bond meshes
      if (this.bondMeshes) {
        this.bondMeshes.forEach(mesh => {
          if (mesh.material) {
            this.shader.updateEffectStrength(mesh.material, strength);
          }
        });
      }
    } catch (error) {
      console.warn('Error updating effect strength:', error);
    }
  }
  
  /**
   * Set background color
   * @param {string} color - Color in hex format
   */
  setBackgroundColor(color) {
    this.config.backgroundColor = color;
    
    if (this.scene) {
      this.scene.background = new THREE.Color(color);
    }
    
    if (this.renderer) {
      this.renderer.setClearColor(new THREE.Color(color), 1.0);
    }
    
    this._emitEvent('backgroundColorChanged', { color });
  }
  
  /**
   * Take a screenshot
   * @param {Object} options - Screenshot options
   * @param {number} [options.width] - Width of screenshot
   * @param {number} [options.height] - Height of screenshot
   * @param {number} [options.scale=2] - Scale factor
   * @returns {string|null} Data URL of screenshot or null if failed
   */
  takeScreenshot(options = {}) {
    if (!this.renderer || !this.scene || !this.camera || this.rendererLost) {
      return null;
    }
    
    try {
      // Save current size
      const currentSize = {
        width: this.renderer.domElement.width,
        height: this.renderer.domElement.height
      };
      
      // Calculate output size
      let width, height;
      
      if (options.width && options.height) {
        width = options.width;
        height = options.height;
      } else if (options.scale) {
        width = currentSize.width * options.scale;
        height = currentSize.height * options.scale;
      } else {
        width = currentSize.width * 2;
        height = currentSize.height * 2;
      }
      
      // Resize renderer
      this.renderer.setSize(width, height, false);
      
      // Update camera aspect
      const originalAspect = this.camera.aspect;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      
      // Render scene
      this.renderer.render(this.scene, this.camera);
      
      // Get screenshot
      const dataURL = this.renderer.domElement.toDataURL('image/png');
      
      // Restore original size
      this.renderer.setSize(currentSize.width, currentSize.height, false);
      
      // Restore camera aspect
      this.camera.aspect = originalAspect;
      this.camera.updateProjectionMatrix();
      
      // Render again at original size
      this.renderer.render(this.scene, this.camera);
      
      return dataURL;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      return null;
    }
  }
  
  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  on(event, callback) {
    if (typeof callback !== 'function') return;
    
    this.container.addEventListener(`proteinviewer:${event}`, callback);
  }
  
  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  off(event, callback) {
    this.container.removeEventListener(`proteinviewer:${event}`, callback);
  }
  
  /**
   * Dispose of viewer resources
   */
  dispose() {
    // Stop animation
    this._stopAnimationLoop();
    this.isVisible = false;
    
    // Remove event listeners
    window.removeEventListener('resize', this._handleResize);
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    
    // Stop intersection observer
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
      this.visibilityObserver = null;
    }
    
    // Clear protein
    this._clearProtein();
    
    // Dispose of controls
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    
    // Dispose of renderer
    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch (error) {
        console.warn('Error disposing renderer:', error);
      }
      this.renderer = null;
    }
    
    // Remove canvas if we created it
    if (this.canvas && this.canvas !== this.container && this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
      this.canvas = null;
    }
    
    // Remove error display
    if (this.errorDisplay && this.errorDisplay.parentNode === this.container) {
      this.container.removeChild(this.errorDisplay);
      this.errorDisplay = null;
    }
    
    // Reset state
    this.state.isInitialized = false;
    this.state.isReady = false;
    
    // Emit disposed event
    this._emitEvent('disposed');
  }
}
