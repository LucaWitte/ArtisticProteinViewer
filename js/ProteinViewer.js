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
      effectStrength: 0.5,
      retryCount: 0,
      maxRetries: 3
    };
    
    // Storage for rendering objects
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.protein = null;
    
    // Recovery timer
    this.recoveryTimer = null;
    
    // Bind methods to ensure correct this context
    this._handleResize = this._handleResize.bind(this);
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    this._handleContextLost = this._handleContextLost.bind(this);
    this._handleContextRestored = this._handleContextRestored.bind(this);
    this._animate = this._animate.bind(this);
    
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
      
      // Wait a frame before initializing to ensure DOM is ready
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Initialize viewer components
      await this._initRenderer();
      
      // Wait another frame to ensure renderer is ready
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      this._initScene();
      this._initCamera();
      this._initControls();
      this._initLights();
      
      // Wait another frame before loading shader
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      this._initShaders();
      this._initEventListeners();
      
      // Start animation loop
      this._startAnimationLoop();
      
      // Set initialized flag
      this.state.isInitialized = true;
      
      // Emit initialized event
      this._emitEvent('initialized');
      
      // Load default model if specified (after a short delay)
      if (this.config.defaultUrl) {
        setTimeout(() => {
          this.loadProtein(this.config.defaultUrl);
        }, 300);
      }
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
      // Use RendererFactory for robust renderer creation
      this.renderer = RendererFactory.createRenderer({
        container: this.canvas,
        antialias: true,
        alpha: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        onContextLost: this._handleContextLost,
        onContextRestored: this._handleContextRestored
      });
      
      // Set initial size
      this._updateRendererSize();
      
      // Set background color
      this.renderer.setClearColor(new THREE.Color(this.config.backgroundColor), 1.0);
      
      // Force an initial render to validate the context
      this.rendererActive = true;
    } catch (error) {
      console.error('Error initializing renderer:', error);
      throw new Error('Failed to initialize WebGL renderer');
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
    // Clear any existing animation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Start a new animation loop
    this.animationFrameId = requestAnimationFrame(this._animate);
  }
  
  /**
   * Animation frame callback
   * @private
   * @param {number} time - Current timestamp
   */
  _animate(time) {
    // Set up next frame
    this.animationFrameId = requestAnimationFrame(this._animate);
    
    // Skip if not visible or not initialized or renderer inactive
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
    
    // Create a simple ball and stick visualization
    // Using a simple approach to avoid context loss
    try {
      this._createBallAndStickVisualization();
    } catch (error) {
      console.error('Error creating visualization:', error);
      // Create a minimal fallback visualization
      this._createFallbackVisualization();
    }
  }
  
  /**
   * Create ball and stick visualization
   * @private
   */
  _createBallAndStickVisualization() {
    // Import visualization dynamically only when needed
    import('./visualization/BallAndStick.js')
      .then(module => {
        const BallAndStick = module.BallAndStick;
        
        // Create the visualization
        const visualization = new BallAndStick({
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
        visualization.create()
          .then(() => {
            this.proteinGroup.add(visualization.object);
            this.activeVisualization = visualization;
          })
          .catch(error => {
            console.error('Error creating ball and stick visualization:', error);
            this._createFallbackVisualization();
          });
      })
      .catch(error => {
        console.error('Error importing visualization module:', error);
        this._createFallbackVisualization();
      });
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
      const MAX_DISPLAY_ATOMS = 2000;
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
      
      // Recreate visualization if needed
      if (this.protein) {
        this._updateProteinVisualization();
      }
      
      // Ensure animation loop is running
      if (!this.animationFrameId) {
        this._startAnimationLoop();
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
    
    if (this.activeVisualization && this.activeVisualization.updateEffectStrength) {
      this.activeVisualization.updateEffectStrength(value);
    }
    
    this._emitEvent('effectStrengthChanged', { strength: value });
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
    if (!this.renderer || !this.scene || !this.camera || this.rendererActive === false) {
      console.warn('Cannot take screenshot - renderer not ready');
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
      
      // Limit size to reasonable values to avoid context loss
      const MAX_DIMENSION = 4096;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
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
    // Stop animation and recovery attempts
    this._stopAnimationLoop();
    
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    
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
