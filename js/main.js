/**
 * main.js - Entry point for Artistic Protein Visualizer
 * Initializes the application, sets up Three.js renderer, and manages application state.
 */

import { WebGLDetector } from './utils/WebGLDetector.js';
import { Renderer } from './app/Renderer.js';
import { Scene } from './app/Scene.js';
import { Camera } from './app/Camera.js';
import { Controls } from './app/Controls.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { ThemeToggle } from './ui/ThemeToggle.js';
import { UIManager } from './ui/UIManager.js';
import { PDBLoader } from './loaders/PDBLoader.js';
import { ProteinModel } from './visualization/ProteinModel.js';
import { BallAndStick } from './visualization/BallAndStick.js';
import { Ribbon } from './visualization/Ribbon.js';
import { Surface } from './visualization/Surface.js';
import { ShaderManager } from './shaders/ShaderManager.js';
import { ExportUtils } from './utils/ExportUtils.js';
import { CONFIG } from './config.js';

/**
 * Main application class
 */
class ProteinVisualizer {
  /**
   * Initialize the application
   */
  constructor() {
    // Initialize component states
    this.isInitialized = false;
    this.activeVisualization = null;
    this.activeStyle = 'ball-stick';
    this.activeShader = 'standard';
    this.loadedProtein = null;
    
    // Initialize loading screen
    this.loadingScreen = new LoadingScreen({
      element: document.getElementById('loading-screen'),
      progressBar: document.getElementById('loading-progress-bar'),
      statusElement: document.getElementById('loading-status')
    });
    
    // Set up event bindings
    this._bindEvents();
    
    // Check WebGL support
    this._checkWebGLSupport();
  }
  
  /**
   * Initialize the application
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Update loading screen
      this.loadingScreen.updateStatus('Initializing renderer...');
      this.loadingScreen.updateProgress(10);
      
      // Initialize Three.js components
      this._initThreeJS();
      
      // Initialize UI components
      this.loadingScreen.updateStatus('Setting up user interface...');
      this.loadingScreen.updateProgress(30);
      this._initUI();
      
      // Load shaders
      this.loadingScreen.updateStatus('Loading shaders...');
      this.loadingScreen.updateProgress(50);
      await this._loadShaders();
      
      // Load default protein if specified
      if (CONFIG.DEFAULT_PROTEIN_URL) {
        this.loadingScreen.updateStatus('Loading default protein structure...');
        this.loadingScreen.updateProgress(70);
        await this._loadDefaultProtein();
      }
      
      // Finalize initialization
      this.loadingScreen.updateStatus('Ready!');
      this.loadingScreen.updateProgress(100);
      
      // Hide loading screen after a short delay
      setTimeout(() => {
        this.loadingScreen.hide();
        this.isInitialized = true;
        
        // Start render loop
        this._animate();
      }, 500);
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.loadingScreen.showError('Failed to initialize application: ' + error.message);
    }
  }
  
  /**
   * Check if WebGL is supported and show error if not
   * @private
   */
  _checkWebGLSupport() {
    const webglSupport = WebGLDetector.isWebGLAvailable();
    
    if (!webglSupport) {
      document.getElementById('webgl-error').style.display = 'flex';
      this.loadingScreen.hide();
      throw new Error('WebGL not supported');
    }
  }
  
  /**
   * Initialize Three.js components
   * @private
   */
  _initThreeJS() {
    // Get the viewport element
    const container = document.getElementById('protein-viewport');
    
    // Initialize renderer
    this.renderer = new Renderer({
      container: container,
      antialias: CONFIG.RENDERER.ANTIALIAS,
      alpha: CONFIG.RENDERER.ALPHA,
      pixelRatio: CONFIG.RENDERER.PIXEL_RATIO
    });
    
    // Initialize scene
    this.scene = new Scene({
      backgroundColor: CONFIG.SCENE.BACKGROUND_COLOR,
      ambientLightIntensity: CONFIG.SCENE.AMBIENT_LIGHT_INTENSITY,
      directionalLightIntensity: CONFIG.SCENE.DIRECTIONAL_LIGHT_INTENSITY
    });
    
    // Initialize camera
    this.camera = new Camera({
      fov: CONFIG.CAMERA.FOV,
      near: CONFIG.CAMERA.NEAR,
      far: CONFIG.CAMERA.FAR,
      position: CONFIG.CAMERA.POSITION
    });
    
    // Initialize controls
    this.controls = new Controls({
      camera: this.camera.instance,
      domElement: this.renderer.domElement,
      enableDamping: CONFIG.CONTROLS.ENABLE_DAMPING,
      dampingFactor: CONFIG.CONTROLS.DAMPING_FACTOR,
      rotateSpeed: CONFIG.CONTROLS.ROTATE_SPEED,
      zoomSpeed: CONFIG.CONTROLS.ZOOM_SPEED,
      panSpeed: CONFIG.CONTROLS.PAN_SPEED,
      minDistance: CONFIG.CONTROLS.MIN_DISTANCE,
      maxDistance: CONFIG.CONTROLS.MAX_DISTANCE
    });
    
    // Handle window resize
    window.addEventListener('resize', this._handleResize.bind(this));
  }
  
  /**
   * Initialize UI components
   * @private
   */
  _initUI() {
    // Initialize theme toggle
    this.themeToggle = new ThemeToggle({
      element: document.getElementById('theme-toggle')
    });
    
    // Initialize UI manager
    this.uiManager = new UIManager({
      styleButtons: document.querySelectorAll('.style-btn'),
      colorSchemeSelect: document.getElementById('color-scheme'),
      backgroundColorInput: document.getElementById('background-color'),
      shaderEffectSelect: document.getElementById('shader-effect'),
      effectStrengthSlider: document.getElementById('effect-strength'),
      exportButton: document.getElementById('export-btn'),
      fileUploadButton: document.getElementById('file-upload-btn'),
      fileInput: document.getElementById('pdb-file-input'),
      onStyleChange: this._handleStyleChange.bind(this),
      onColorSchemeChange: this._handleColorSchemeChange.bind(this),
      onBackgroundColorChange: this._handleBackgroundColorChange.bind(this),
      onShaderEffectChange: this._handleShaderEffectChange.bind(this),
      onEffectStrengthChange: this._handleEffectStrengthChange.bind(this),
      onExport: this._handleExport.bind(this),
      onFileUpload: this._handleFileUpload.bind(this)
    });
    
    // Set initial background color
    document.getElementById('background-color').value = CONFIG.SCENE.BACKGROUND_COLOR;
  }
  
  /**
   * Load shader programs
   * @private
   * @returns {Promise<void>}
   */
  async _loadShaders() {
    this.shaderManager = new ShaderManager();
    await this.shaderManager.loadShaders();
  }
  
  /**
   * Load default protein if specified in config
   * @private
   * @returns {Promise<void>}
   */
  async _loadDefaultProtein() {
    if (!CONFIG.DEFAULT_PROTEIN_URL) return;
    
    try {
      const pdbLoader = new PDBLoader();
      const pdbData = await pdbLoader.load(CONFIG.DEFAULT_PROTEIN_URL);
      
      await this._createProteinModel(pdbData);
    } catch (error) {
      console.error('Error loading default protein:', error);
      this.loadingScreen.updateStatus('Failed to load default protein.');
    }
  }
  
  /**
   * Create a protein model from PDB data
   * @private
   * @param {Object} pdbData - Parsed PDB data
   * @returns {Promise<void>}
   */
  async _createProteinModel(pdbData) {
    // Clear previous protein if any
    if (this.loadedProtein) {
      this.scene.remove(this.loadedProtein.object);
      this.loadedProtein.dispose();
      this.loadedProtein = null;
    }
    
    // Create new protein model
    this.loadedProtein = new ProteinModel({
      pdbData: pdbData,
      scene: this.scene
    });
    
    // Create visualization based on active style
    await this._updateVisualization();
    
    // Center camera on protein
    this._centerCameraOnProtein();
  }
  
  /**
   * Update the visualization based on active style
   * @private
   * @returns {Promise<void>}
   */
  async _updateVisualization() {
    if (!this.loadedProtein) return;
    
    // Remove previous visualization if exists
    if (this.activeVisualization) {
      this.loadedProtein.removeVisualization();
      this.activeVisualization = null;
    }
    
    // Create new visualization based on style
    switch (this.activeStyle) {
      case 'ball-stick':
        this.activeVisualization = new BallAndStick({
          proteinModel: this.loadedProtein,
          colorScheme: this.uiManager.getColorScheme(),
          shader: this.shaderManager.getShader(this.activeShader)
        });
        break;
        
      case 'ribbon':
        this.activeVisualization = new Ribbon({
          proteinModel: this.loadedProtein,
          colorScheme: this.uiManager.getColorScheme(),
          shader: this.shaderManager.getShader(this.activeShader)
        });
        break;
        
      case 'surface':
        this.activeVisualization = new Surface({
          proteinModel: this.loadedProtein,
          colorScheme: this.uiManager.getColorScheme(),
          shader: this.shaderManager.getShader(this.activeShader)
        });
        break;
        
      default:
        console.warn(`Unknown visualization style: ${this.activeStyle}`);
        return;
    }
    
    // Apply the visualization
    await this.activeVisualization.create();
    
    // Apply effect strength
    this._handleEffectStrengthChange(this.uiManager.getEffectStrength());
  }
  
  /**
   * Center camera on protein
   * @private
   */
  _centerCameraOnProtein() {
    if (!this.loadedProtein) return;
    
    const boundingBox = this.loadedProtein.getBoundingBox();
    
    if (boundingBox) {
      this.controls.resetPosition(boundingBox);
    }
  }
  
  /**
   * Animation loop
   * @private
   */
  _animate() {
    if (!this.isInitialized) return;
    
    requestAnimationFrame(this._animate.bind(this));
    
    // Update controls
    this.controls.update();
    
    // Render scene
    this.renderer.render(this.scene.instance, this.camera.instance);
  }
  
  /**
   * Handle window resize
   * @private
   */
  _handleResize() {
    if (!this.isInitialized) return;
    
    this.camera.updateAspect(window.innerWidth, window.innerHeight);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  /**
   * Bind events
   * @private
   */
  _bindEvents() {
    // File upload handling
    const fileInput = document.getElementById('pdb-file-input');
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        this._handleFileUpload(file);
      }
    });
    
    const fileUploadBtn = document.getElementById('file-upload-btn');
    fileUploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }
  
  /**
   * Handle style change
   * @private
   * @param {string} style - Visualization style
   */
  _handleStyleChange(style) {
    this.activeStyle = style;
    this._updateVisualization();
  }
  
  /**
   * Handle color scheme change
   * @private
   * @param {string} scheme - Color scheme
   */
  _handleColorSchemeChange(scheme) {
    if (this.activeVisualization) {
      this.activeVisualization.updateColorScheme(scheme);
    }
  }
  
  /**
   * Handle background color change
   * @private
   * @param {string} color - Background color in hex format
   */
  _handleBackgroundColorChange(color) {
    this.scene.setBackgroundColor(color);
  }
  
  /**
   * Handle shader effect change
   * @private
   * @param {string} effect - Shader effect
   */
  _handleShaderEffectChange(effect) {
    this.activeShader = effect;
    
    if (this.activeVisualization) {
      this.activeVisualization.updateShader(
        this.shaderManager.getShader(effect)
      );
    }
  }
  
  /**
   * Handle effect strength change
   * @private
   * @param {number} strength - Effect strength (0-100)
   */
  _handleEffectStrengthChange(strength) {
    if (this.activeVisualization) {
      this.activeVisualization.updateEffectStrength(strength / 100);
    }
  }
  
  /**
   * Handle export button click
   * @private
   */
  _handleExport() {
    if (!this.isInitialized) return;
    
    const exportUtils = new ExportUtils({
      renderer: this.renderer,
      scene: this.scene.instance,
      camera: this.camera.instance
    });
    
    exportUtils.exportImage();
  }
  
  /**
   * Handle file upload
   * @private
   * @param {File} file - Uploaded PDB file
   */
  async _handleFileUpload(file) {
    if (!file) return;
    
    // Check file extension
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (fileExtension !== 'pdb') {
      alert('Please upload a valid PDB file (.pdb)');
      return;
    }
    
    try {
      // Show loading screen
      this.loadingScreen.show();
      this.loadingScreen.updateStatus(`Loading ${file.name}...`);
      this.loadingScreen.updateProgress(0);
      
      // Read and parse file
      const pdbLoader = new PDBLoader();
      const pdbData = await pdbLoader.loadFromFile(file, (progress) => {
        this.loadingScreen.updateProgress(progress * 100);
      });
      
      // Create protein model
      this.loadingScreen.updateStatus('Processing protein structure...');
      this.loadingScreen.updateProgress(80);
      await this._createProteinModel(pdbData);
      
      // Hide loading screen
      this.loadingScreen.updateStatus('Ready!');
      this.loadingScreen.updateProgress(100);
      
      setTimeout(() => {
        this.loadingScreen.hide();
      }, 500);
      
    } catch (error) {
      console.error('Error loading protein file:', error);
      this.loadingScreen.showError('Failed to load protein: ' + error.message);
    }
  }
}

// Create and initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new ProteinVisualizer();
  app.init().catch(error => {
    console.error('Application initialization failed:', error);
  });
});
