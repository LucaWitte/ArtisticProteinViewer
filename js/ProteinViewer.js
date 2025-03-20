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
    
    // Set configuration with more conservative defaults
    this.config = {
      backgroundColor: options.backgroundColor || '#1a1a2e',
      defaultUrl: options.defaultUrl || null,
      initialStyle: options.initialStyle || 'ball-stick',
      initialShader: options.initialShader || 'standard',
      maxAtoms: options.maxAtoms || 5000, // Limit total atoms for performance
      progressiveLoading: true, // Always use progressive loading
      safeMode: true, // Use safer rendering settings
    };
    
    // Initialize state
    this.state = {
      isInitialized: false,
      isLoading: false,
      isReady: false,
      currentStyle: this.config.initialStyle,
      currentShader: this.config.initialShader,
      effectStrength: 0.5,
      retryCount: 0,
      maxRetries: 3,
      hasContextLoss: false,
      pendingLoad: null,
      lastProteinUrl: null,
    };
    
    // Storage for rendering objects
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.protein = null;
    
    // Error display element
    this.errorDisplay = null;
    
    // Recovery timer
    this.recoveryTimer = null;
    this.frameLimiter = null;
    
    // Visualization objects
    this.activeVisualization = null;
    
    // Bind methods to ensure correct this context
    this._handleResize = this._handleResize.bind(this);
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    this._handleContextLost = this._handleContextLost.bind(this);
    this._handleContextRestored = this._handleContextRestored.bind(this);
    this._animate = this._animate.bind(this);
    
    // Monitor visible status
    this.setupVisibilityTracking();
    
    // Initialize the viewer
    this._init();
  }
  
  /**
   * Initialize the viewer with error handling and safe fallbacks
   * @private
   */
  async _init() {
    try {
      console.log("Initializing ProteinViewer...");
      
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
      
      // Wait a frame before initializing to ensure DOM is ready
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Initialize viewer components with conservative settings
      await this._initRenderer();
      
      // Wait another frame to ensure renderer is ready
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Initialize other components only if renderer was created successfully
      if (this.renderer) {
        this._initScene();
        this._initCamera();
        this._initControls();
        this._initLights();
        
        // Wait another frame before loading shader
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Initialize shader with default type
        this._initShaders();
        
        // Set up event listeners
        this._initEventListeners();
        
        // Start animation loop
        this._startAnimationLoop();
        
        // Set initialized flag
        this.state.isInitialized = true;
        
        // Emit initialized event
        this._emitEvent('initialized');
        
        console.log("ProteinViewer initialized successfully");
        
        // Load default model if specified (with a delay to ensure full initialization)
        if (this.config.defaultUrl) {
          setTimeout(() => {
            this.loadProtein(this.config.defaultUrl);
          }, 500);
        }
      } else {
        this._showError('Failed to initialize WebGL renderer');
      }
    } catch (error) {
      console.error('Error initializing protein viewer:', error);
      this._showError('Failed to initialize viewer: ' + error.message);
    }
  }
  
  /**
   * Initialize the WebGL renderer with robust error handling
   * @private
   */
  async _initRenderer() {
    try {
      console.log("Initializing WebGL renderer...");
      
      // Use RendererFactory for robust renderer creation with more conservative settings
      this.renderer = RendererFactory.createRenderer({
        container: this.canvas,
        antialias: false, // Disable antialiasing for better performance
        alpha: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), // Lower pixel ratio
        onContextLost: this._handleContextLost,
        onContextRestored: this._handleContextRestored
      });
      
      // Set initial size
      this._updateRendererSize();
      
      // Set background color
      this.renderer.setClearColor(new THREE.Color(this.config.backgroundColor), 1.0);
      
      // Force an initial render to validate the context
      this.rendererActive = true;
      
      console.log("WebGL renderer initialized successfully");
      return true;
    } catch (error) {
      console.error('Error initializing renderer:', error);
      this._showError('Failed to initialize WebGL renderer. Your device may not support WebGL or have limited graphics capabilities.');
      this.rendererActive = false;
      return false;
    }
  }
  
  /**
   * Initialize the scene with simple settings
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
    // Create orbit controls with conservative settings
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.rotateSpeed = 0.7; // Lower speed for more stability
    this.controls.zoomSpeed = 1.0;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 500;
    
    // Disable right mouse button panning to avoid accidental navigation
    this.controls.enablePan = false;
  }
  
  /**
   * Initialize lights with conservative settings
   * @private
   */
  _initLights() {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Brighter ambient for less reliance on directional
    this.scene.add(this.ambientLight);
    
    // Directional light
    this.mainLight = new THREE.DirectionalLight(0xffffff, 0.5); // Less intense directional
    this.mainLight.position.set(1, 1, 1);
    this.scene.add(this.mainLight);
    
    // Fill light
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    this.fillLight.position.set(-1, -0.5, -1);
    this.scene.add(this.fillLight);
    
    // Disable all shadows for better performance
    this.mainLight.castShadow = false;
    this.fillLight.castShadow = false;
  }
  
  /**
   * Initialize shaders
   * @private
   */
  _initShaders() {
    // Create shader manager with more conservative settings
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
   */
  setupVisibilityTracking() {
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
   * Start animation loop with frame limiting for stability
   * @private
   */
  _startAnimationLoop() {
    // Clear any existing animation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Use a frame rate limiter for better stability
    let lastFrameTime = 0;
    const minFrameInterval = 1000 / 30; // Limit to 30 FPS for stability
    
    // Start a new animation loop with frame limiting
    const animateWithLimiter = (time) => {
      this.animationFrameId = requestAnimationFrame(animateWithLimiter);
      
      // Skip if not visible or not initialized or renderer inactive
      if (!this.isVisible || !this.state.isInitialized || !this.rendererActive) {
        return;
      }
      
      // Apply frame limiting
      const delta = time - lastFrameTime;
      if (delta < minFrameInterval) {
        return; // Skip this frame
      }
      
      // Update last frame time
      lastFrameTime = time;
      
      // Actual animation frame
      this._animate(time);
    };
    
    // Start the animation loop
    this.animationFrameId = requestAnimationFrame(animateWithLimiter);
  }
  
  /**
   * Animation frame callback
   * @private
   * @param {number} time - Current timestamp
   */
  _animate(time) {
    // Skip if necessary conditions aren't met
    if (!this.isVisible || !this.state.isInitialized || !this.rendererActive) {
      return;
    }
    
    // Update controls
    if (this.controls) {
      this.controls.update();
    }
    
    // Render scene
    if (this.renderer && this.scene && this.camera) {
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (error) {
        console.error('Render error:', error);
        // Don't stop the loop on error, just skip this frame
      }
    }
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
    // Store this request in case we need to retry after context restoration
    this.state.pendingLoad = url;
    this.state.lastProteinUrl = url;
    
    if (this.state.isLoading) {
      console.warn('Already loading a protein, please wait');
      return false;
    }
    
    // Check if renderer is active
    if (!this.rendererActive) {
      console.warn('Cannot load protein: renderer is inactive');
      this._showError('Cannot load protein: WebGL renderer is inactive. Please refresh the page.');
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
      
      // Apply atom limit for safety
      if (pdbData.atoms && pdbData.atoms.length > this.config.maxAtoms) {
        console.warn(`Protein has ${pdbData.atoms.length} atoms, exceeding the limit of ${this.config.maxAtoms}. Some atoms will not be displayed.`);
      }
      
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
    // Clear any pending URL load
    this.state.pendingLoad = null;
    
    if (this.state.isLoading) {
      console.warn('Already loading a protein, please wait');
      return false;
    }
    
    // Check if renderer is active
    if (!this.rendererActive) {
      console.warn('Cannot load protein: renderer is inactive');
      this._showError('Cannot load protein: WebGL renderer is inactive. Please refresh the page.');
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
      
      // Apply atom limit for safety
      if (pdbData.atoms && pdbData.atoms.length > this.config.maxAtoms) {
        console.warn(`Protein has ${pdbData.atoms.length} atoms, exceeding the limit of ${this.config.maxAtoms}. Some atoms will not be displayed.`);
      }
      
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
    
    // Create a visualization based on current style
    try {
      await this._updateVisualization();
    } catch (error) {
      console.error('Error creating visualization:', error);
      // Create a minimal fallback visualization
      this._createFallbackVisualization();
    }
  }
  
  /**
   * Update the visualization based on active style
   * @private
   * @returns {Promise<void>}
   */
  async _updateVisualization() {
    if (!this.protein) return;
    
    try {
      // Remove previous visualization if exists
      this._clearVisualization();
      
      // Import visualization dynamically only when needed
      let VisualizationClass;
      
      switch (this.state.currentStyle) {
        case 'ball-stick':
          const BallStickModule = await import('./visualization/BallAndStick.js');
          VisualizationClass = BallStickModule.BallAndStick;
          break;
          
        case 'ribbon':
          const RibbonModule = await import('./visualization/Ribbon.js');
          VisualizationClass = RibbonModule.Ribbon;
          break;
          
        case 'surface':
          const SurfaceModule = await import('./visualization/Surface.js');
          VisualizationClass = SurfaceModule.Surface;
          break;
          
        default:
          console.warn(`Unknown visualization style: ${this.state.currentStyle}, falling back to ball-stick`);
          const FallbackModule = await import('./visualization/BallAndStick.js');
          VisualizationClass = FallbackModule.BallAndStick;
      }
      
      // Create the visualization
      const visualization = new VisualizationClass({
        proteinModel: {
          atoms: this.protein.atoms,
          bonds: this.protein.bonds,
          residues: this.protein.residues,
          chains: this.protein.chains,
          centerOfMass: this.protein.centerOfMass,
          boundingBox: this.protein.boundingBox,
          getAtomColor: this._getAtomColor.bind(this)
        },
        colorScheme: 'element',
        shader: this.shader
      });
      
      // Create and add to scene
      await visualization.create();
      this.proteinGroup.add(visualization.object);
      this.activeVisualization = visualization;
      
      // Apply current effect strength
      visualization.updateEffectStrength(this.state.effectStrength);
    } catch (error) {
      console.error('Error updating visualization:', error);
      this._createFallbackVisualization();
    }
  }
  
  /**
   * Create fallback visualization when standard methods fail
   * @private
   */
  _createFallbackVisualization() {
    if (!this.protein) return;
    
    console.log('Creating fallback visualization');
    
    try {
      // Create a simple point cloud visualization
      const atoms = this.protein.atoms;
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      
      // Determine stride for large proteins (show a subset)
      const MAX_DISPLAY_ATOMS = 1000;
      const stride = Math.max(1, Math.ceil(atoms.length / MAX_DISPLAY_ATOMS));
      
      // Process atoms
      for (let i = 0; i < atoms.length; i += stride) {
        const atom = atoms[i];
        
        positions.push(
          atom.position.x - this.protein.centerOfMass.x,
          atom.position.y - this.protein.centerOfMass.y,
          atom.position.z - this.protein.centerOfMass.z
        );
        
        // Get color
        const color = this._getAtomColor(atom, 'element');
        colors.push(color.r, color.g, color.b);
      }
      
      // Set attributes
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      // Create material and points
      const material = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true
      });
      
      const points = new THREE.Points(geometry, material);
      points.name = 'FallbackPoints';
      
      // Add to container
      this.proteinGroup.add(points);
      
      // Store for cleanup
      this.fallbackVisualization = points;
    } catch (error) {
      console.error('Error creating fallback visualization:', error);
      
      // Create absolute minimum visualization - just a cube
      try {
        const geometry = new THREE.BoxGeometry(10, 10, 10);
        const material = new THREE.MeshBasicMaterial({ color: 0x3498db, wireframe: true });
        const cube = new THREE.Mesh(geometry, material);
        this.proteinGroup.add(cube);
        this.fallbackVisualization = cube;
      } catch (e) {
        console.error('Failed to create even minimal fallback visualization:', e);
      }
    }
  }
  
  /**
   * Get color for atom based on scheme
   * @private
   * @param {Object} atom - Atom object
   * @param {string} scheme - Color scheme name
   * @returns {THREE.Color} Color
   */
  _getAtomColor(atom, scheme) {
    // Get element-based color
    const elementColors = {
      'H': '#FFFFFF', // White
      'C': '#909090', // Grey
      'N': '#3050F8', // Blue
      'O': '#FF0D0D', // Red
      'S': '#FFFF30', // Yellow
      'P': '#FF8000', // Orange
      'F': '#90E050', // Light Green
      'CL': '#1FF01F', // Green
      'BR': '#A62929', // Brown
      'I': '#940094', // Purple
      'FE': '#E06633', // Orange-brown
      'CA': '#3DFF00', // Bright green
      'MG': '#8AFF00'  // Yellow-green
    };
    
    const colorHex = elementColors[atom.element] || '#FFFF00';
    return new THREE.Color(colorHex);
  }
  
  /**
   * Center camera on protein
   * @private
   */
  _centerCamera() {
    if (!this.protein) return;
    
    const boundingBox = this.protein.boundingBox;
    
    if (boundingBox) {
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
    // Remove active visualization if any
    if (this.activeVisualization) {
      if (this.activeVisualization.dispose) {
        this.activeVisualization.dispose();
      }
      
      if (this.activeVisualization.object) {
        this.proteinGroup.remove(this.activeVisualization.object);
      }
      
      this.activeVisualization = null;
    }
    
    // Remove fallback visualization if any
    if (this.fallbackVisualization) {
      if (this.fallbackVisualization.geometry) {
        this.fallbackVisualization.geometry.dispose();
      }
      
      if (this.fallbackVisualization.material) {
        this.fallbackVisualization.material.dispose();
      }
      
      this.proteinGroup.remove(this.fallbackVisualization);
      this.fallbackVisualization = null;
    }
    
    // Clear all remaining children from protein group
    while (this.proteinGroup.children.length > 0) {
      const child = this.proteinGroup.children[0];
      this.proteinGroup.remove(child);
      
      // Dispose of resources
      if (child.geometry) {
        child.geometry.dispose();
      }
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    
    // Force garbage collection
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        // Ignore - not all browsers support this
      }
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
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    
    // Throttle resize events
    this.resizeTimer = setTimeout(() => {
      this._updateRendererSize();
    }, 100);
  }
  
  /**
   * Handle visibility change
   * @private
   */
  _handleVisibilityChange() {
    this.isVisible = !document.hidden;
    
    if (this.isVisible) {
      // Restart animation loop when becoming visible
      if (!this.animationFrameId) {
        this._startAnimationLoop();
      }
    } else {
      // Optionally pause when not visible to save resources
      // this._stopAnimationLoop();
    }
  }
  
  /**
   * Handle WebGL context loss
   * @private
   */
  _handleContextLost() {
    console.warn('WebGL context loss detected in main viewer');
    
    // Mark renderer as unavailable
    this.rendererActive = false;
    this.state.hasContextLoss = true;
    
    // Stop any previous recovery attempt
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    
    // Emit event
    this._emitEvent('contextLost');
    
    // Schedule recovery attempt
    this.recoveryTimer = setTimeout(() => {
      // Try to recover after a short delay
      this._attemptContextRecovery();
    }, 1000);
    
    // Show error message
    this._showError('WebGL rendering context was lost. Attempting to recover...');
  }
  
  /**
   * Attempt to recover from a lost context
   * @private
   */
  _attemptContextRecovery() {
    if (this.rendererActive) return; // Already restored
    
    if (this.state.retryCount < this.state.maxRetries) {
      this.state.retryCount++;
      console.log(`Attempting context recovery (attempt ${this.state.retryCount} of ${this.state.maxRetries})...`);
      
      try {
        // Try manual recovery if possible
        if (this.renderer && RendererFactory.tryRecoverContext(this.renderer)) {
          console.log('Manually triggered context recovery');
        }
      } catch (error) {
        console.warn('Error during manual context recovery:', error);
      }
      
      // Schedule another attempt if still not restored
      this.recoveryTimer = setTimeout(() => {
        this._attemptContextRecovery();
      }, 2000);
    } else {
      console.warn('Context recovery failed after max retries');
      this._showError('WebGL rendering error. Please try reloading the page.');
    }
  }
  
  /**
   * Handle WebGL context restoration
   * @private
   */
  _handleContextRestored() {
    console.log('WebGL context restored in main viewer');
    
    // Reset retry count
    this.state.retryCount = 0;
    this.state.hasContextLoss = false;
    
    // Mark renderer as available again
    this.rendererActive = true;
    
    // Clear any recovery timers
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    
    try {
      // Ensure renderer is properly sized
      this._updateRendererSize();
      
      // Re-initialize shaders
      this._initShaders();
      
      // If we have a pending load, retry it
      if (this.state.pendingLoad) {
        const urlToLoad = this.state.pendingLoad;
        this.state.pendingLoad = null; // Clear pending load
        
        setTimeout(() => {
          this.loadProtein(urlToLoad);
        }, 500);
      }
      // Otherwise recreate existing visualization if needed
      else if (this.protein) {
        this._updateVisualization();
      }
      
      // Ensure animation loop is running
      if (!this.animationFrameId) {
        this._startAnimationLoop();
      }
      
      // Hide error message
      this._hideError();
      
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
    this.errorDisplay.innerHTML = `
      <div>
        <strong>Error:</strong><br>${message}
        ${this.state.lastProteinUrl ? 
          `<br><br><button id="retry-protein-load" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>` : 
          ''}
      </div>
    `;
    this.errorDisplay.style.display = 'flex';
    
    // Add retry button click handler
    const retryButton = document.getElementById('retry-protein-load');
    if (retryButton && this.state.lastProteinUrl) {
      retryButton.addEventListener('click', () => {
        this._hideError();
        this.loadProtein(this.state.lastProteinUrl);
      });
    }
    
    // Emit error event
    this._emitEvent('error', { message });
  }
  
  /**
   * Hide the error display
   * @private
   */
  _hideError() {
    if (th
