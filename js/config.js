/**
 * config.js - Configuration constants for Artistic Protein Visualizer
 * Central place for application settings and defaults
 */

export const CONFIG = {
  // Application info
  APP_NAME: 'Artistic Protein Visualizer',
  VERSION: '1.0.0',
  
  // Default protein to load on startup (set to null to skip)
  DEFAULT_PROTEIN_URL: 'data/examples/1crn.pdb',
  
  // Renderer settings
  RENDERER: {
    ANTIALIAS: true,
    ALPHA: true,
    PIXEL_RATIO: window.devicePixelRatio || 1,
    MAX_PIXEL_RATIO: 2, // Limit for performance on high-DPI displays
    SHADOW_MAP_ENABLED: true,
    SHADOW_MAP_TYPE: 'PCFSoftShadowMap', // PCFShadowMap, PCFSoftShadowMap, VSMShadowMap
    OUTPUT_ENCODING: 'sRGBEncoding' // LinearEncoding, sRGBEncoding, GammaEncoding
  },
  
  // Scene settings
  SCENE: {
    BACKGROUND_COLOR: '#1a1a2e',
    FOG_ENABLED: false,
    FOG_COLOR: '#1a1a2e',
    FOG_NEAR: 10,
    FOG_FAR: 100,
    AMBIENT_LIGHT_INTENSITY: 0.4,
    DIRECTIONAL_LIGHT_INTENSITY: 0.8
  },
  
  // Camera settings
  CAMERA: {
    FOV: 45,
    NEAR: 0.1,
    FAR: 10000,
    POSITION: [0, 0, 50]
  },
  
  // Controls settings
  CONTROLS: {
    ENABLE_DAMPING: true,
    DAMPING_FACTOR: 0.1,
    ROTATE_SPEED: 1.0,
    ZOOM_SPEED: 1.2,
    PAN_SPEED: 0.8,
    MIN_DISTANCE: 1,
    MAX_DISTANCE: 1000,
    MAX_POLAR_ANGLE: Math.PI // Limit vertical rotation
  },
  
  // Visualization defaults
  VISUALIZATION: {
    DEFAULT_STYLE: 'ball-stick', // ball-stick, ribbon, surface
    DEFAULT_COLOR_SCHEME: 'element', // element, chain, residue, rainbow
    DEFAULT_SHADER: 'standard', // standard, toon, glow, outline
    DEFAULT_EFFECT_STRENGTH: 50,
    
    // Ball and stick settings
    BALL_STICK: {
      ATOM_SCALE: 0.4,
      BOND_SCALE: 0.2,
      SEGMENT_COUNT: 16, // Level of detail for spheres and cylinders
      HYDROGEN_SCALE: 0.2,
      SHOW_HYDROGENS: false, // Whether to display hydrogen atoms
      INSTANCING_ENABLED: true // Use instanced rendering for performance
    },
    
    // Ribbon settings
    RIBBON: {
      THICKNESS: 0.4,
      TENSION: 0.5,
      SUBDIVISION: 8,
      CURVE_SEGMENTS: 32,
      HELIX_WIDTH: 1.3,
      SHEET_WIDTH: 2.0,
      COIL_WIDTH: 0.3
    },
    
    // Surface settings
    SURFACE: {
      PROBE_RADIUS: 1.4, // Standard solvent radius (in Angstroms)
      ISO_VALUE: 0.5,
      RESOLUTION: 1.0, // Resolution of the volumetric data (lower is more detailed but slower)
      SMOOTHING: 1, // Number of smoothing iterations
      WIREFRAME: false
    },
    
    // Element colors (CPK coloring)
    ELEMENT_COLORS: {
      H: '#FFFFFF', // White
      C: '#909090', // Grey
      N: '#3050F8', // Blue
      O: '#FF0D0D', // Red
      S: '#FFFF30', // Yellow
      P: '#FF8000', // Orange
      F: '#90E050', // Light Green
      CL: '#1FF01F', // Green
      BR: '#A62929', // Brown
      I: '#940094', // Purple
      HE: '#D9FFFF',
      NE: '#B3E3F5',
      AR: '#80D1E3',
      XE: '#940094',
      KR: '#5CB8D1',
      CU: '#8C3F99',
      ZN: '#7D80B0',
      FE: '#E06633',
      MG: '#8AFF00',
      CA: '#3DFF00',
      DEFAULT: '#FFFF00' // Default color for unknown elements
    }
  },
  
  // Export settings
  EXPORT: {
    DEFAULT_FORMAT: 'png', // png, jpg
    DEFAULT_SCALE: 2, // Resolution multiplier for exports
    DEFAULT_QUALITY: 0.9, // For jpg format (0.0 - 1.0)
    DEFAULT_FILENAME: 'protein-visualization',
    WATERMARK_ENABLED: false,
    WATERMARK_TEXT: 'Created with Artistic Protein Visualizer',
    WATERMARK_POSITION: 'bottom-right', // top-left, top-right, bottom-left, bottom-right
    WATERMARK_FONT: '14px Arial',
    WATERMARK_COLOR: 'rgba(255, 255, 255, 0.5)'
  },
  
  // Performance settings
  PERFORMANCE: {
    ATOM_LIMIT_MOBILE: 10000, // Atom count above which to use simplified rendering on mobile
    ATOM_LIMIT_LOD: 20000, // Atom count above which to use automatic LOD
    USE_WORKER_THREADS: true, // Use web workers for CPU-intensive operations
    INSTANCING_THRESHOLD: 5000, // Minimum number of instances needed to benefit from instancing
    THROTTLE_RENDERING_ON_ROTATE: true, // Lower resolution while rotating for performance
    THROTTLE_FACTOR: 0.5 // Scale factor during rotation (0.0 - 1.0)
  },
  
  // WebGL capabilities detection
  CAPABILITIES: {
    // Will be populated at runtime based on WebGL detection
    MAX_TEXTURE_SIZE: 4096,
    MAX_RENDERBUFFER_SIZE: 4096,
    INSTANCED_ARRAYS: true,
    FLOAT_TEXTURES: true,
    ANISOTROPY: false,
    MAX_ANISOTROPY: 1
  }
};
