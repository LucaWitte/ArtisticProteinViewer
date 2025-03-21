/**
 * Implementation script for the Artistic Protein Visualizer
 * Add this script to your HTML page to render the protein
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  // 1. Import our modules
  import('./ProteinViewer.js')    
    .then(module => {
      const ProteinViewer = module.ProteinViewer;
      
      // 2. Initialize the viewer
      const viewer = new ProteinViewer({
        container: 'protein-viewport', // ID of your canvas element
        backgroundColor: '#1a1a2e',
        defaultUrl: 'data/examples/1crn.pdb', // Default protein to load
        initialStyle: 'ball-stick',
        initialShader: 'standard'
      });
      
      // 3. Set up UI event handlers
      setupUIControls(viewer);
      
      // 4. Handle viewer events
      handleViewerEvents(viewer);
    })
});

/**
 * Set up UI controls to interact with the viewer
 * @param {ProteinViewer} viewer - The protein viewer instance
 */
function setupUIControls(viewer) {
  // Style buttons
  document.querySelectorAll('.style-btn').forEach(button => {
    button.addEventListener('click', () => {
      const style = button.getAttribute('data-style');
      if (style) {
        viewer.setStyle(style);
        
        // Update active button
        document.querySelectorAll('.style-btn').forEach(btn => {
          btn.classList.toggle('active', btn === button);
        });
      }
    });
  });
  
  // Shader effect select
  const shaderEffect = document.getElementById('shader-effect');
  if (shaderEffect) {
    shaderEffect.addEventListener('change', () => {
      viewer.setShader(shaderEffect.value);
    });
  }
  
  // Effect strength slider
  const effectStrength = document.getElementById('effect-strength');
  if (effectStrength) {
    effectStrength.addEventListener('input', () => {
      const strength = parseInt(effectStrength.value) / 100;
      viewer.setEffectStrength(strength);
    });
  }
  
  // Background color input
  const backgroundColor = document.getElementById('background-color');
  if (backgroundColor) {
    backgroundColor.addEventListener('input', () => {
      viewer.setBackgroundColor(backgroundColor.value);
    });
  }
  
  // File upload
  const fileUploadBtn = document.getElementById('file-upload-btn');
  const fileInput = document.getElementById('pdb-file-input');
  
  if (fileUploadBtn && fileInput) {
    fileUploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        showLoadingMessage('Loading protein...');
        viewer.loadProteinFromFile(file)
          .then(success => {
            if (success) {
              hideLoadingMessage();
            }
          })
          .catch(error => {
            showErrorMessage('Error loading protein: ' + error.message);
          });
      }
    });
  }
  
  // Export button
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dataURL = viewer.takeScreenshot();
      if (dataURL) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'protein-visualization.png';
        link.click();
      } else {
        showErrorMessage('Failed to create screenshot');
      }
    });
  }
}

/**
 * Handle events from the protein viewer
 * @param {ProteinViewer} viewer - The protein viewer instance
 */
function handleViewerEvents(viewer) {
  // Handle loading events
  viewer.on('loadStart', () => {
    showLoadingMessage('Loading protein...');
  });
  
  viewer.on('loadProgress', (event) => {
    updateLoadingProgress(event.detail.progress);
  });
  
  viewer.on('loadComplete', () => {
    hideLoadingMessage();
  });
  
  viewer.on('loadError', (event) => {
    showErrorMessage('Error loading protein: ' + event.detail.error.message);
  });
  
  // Handle context loss/restore
  viewer.on('contextLost', () => {
    showWarningMessage('WebGL context was lost. Attempting to restore...');
  });
  
  viewer.on('contextRestored', () => {
    hideWarningMessage();
  });
}

/**
 * Show loading message
 * @param {string} message - Message to display
 */
function showLoadingMessage(message) {
  const loadingScreen = document.getElementById('loading-screen');
  const loadingStatus = document.getElementById('loading-status');
  
  if (loadingScreen && loadingStatus) {
    loadingStatus.textContent = message;
    loadingScreen.style.display = 'flex';
  }
}

/**
 * Update loading progress
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingProgress(progress) {
  const progressBar = document.getElementById('loading-progress-bar');
  
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
}

/**
 * Hide loading message
 */
function hideLoadingMessage() {
  const loadingScreen = document.getElementById('loading-screen');
  
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showErrorMessage(message) {
  console.error(message);
  
  // Hide loading screen
  hideLoadingMessage();
  
  // Show error in loading screen
  const loadingScreen = document.getElementById('loading-screen');
  const loadingStatus = document.getElementById('loading-status');
  
  if (loadingScreen && loadingStatus) {
    loadingScreen.classList.add('error-message');
    loadingStatus.textContent = message;
    loadingScreen.style.display = 'flex';
    
    // Hide after 5 seconds
    setTimeout(() => {
      loadingScreen.style.display = 'none';
      loadingScreen.classList.remove('error-message');
    }, 5000);
  }
}

/**
 * Show warning message
 * @param {string} message - Warning message
 */
function showWarningMessage(message) {
  console.warn(message);
  
  // Create or update warning banner
  let warningBanner = document.getElementById('warning-banner');
  
  if (!warningBanner) {
    warningBanner = document.createElement('div');
    warningBanner.id = 'warning-banner';
    warningBanner.style.position = 'absolute';
    warningBanner.style.top = '0';
    warningBanner.style.left = '0';
    warningBanner.style.width = '100%';
    warningBanner.style.backgroundColor = '#ffc107';
    warningBanner.style.color = 'black';
    warningBanner.style.padding = '10px';
    warningBanner.style.textAlign = 'center';
    warningBanner.style.zIndex = '1000';
    
    document.body.appendChild(warningBanner);
  }
  
  warningBanner.textContent = message;
  warningBanner.style.display = 'block';
}

/**
 * Hide warning message
 */
function hideWarningMessage() {
  const warningBanner = document.getElementById('warning-banner');
  
  if (warningBanner) {
    warningBanner.style.display = 'none';
  }
}
