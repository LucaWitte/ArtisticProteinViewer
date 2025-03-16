/**
 * ExportUtils.js - Utilities for exporting visualizations as images
 * Handles image capture, watermarking, and downloading
 */

import { CONFIG } from '../config.js';

export class ExportUtils {
  /**
   * Create a new export utilities instance
   * @param {Object} options - Export configuration
   * @param {Object} options.renderer - Three.js renderer
   * @param {Object} options.scene - Three.js scene
   * @param {Object} options.camera - Three.js camera
   */
  constructor(options) {
    this.renderer = options.renderer;
    this.scene = options.scene;
    this.camera = options.camera;
    
    // Configuration defaults
    this.config = CONFIG.EXPORT;
    this.format = this.config.DEFAULT_FORMAT;
    this.quality = this.config.DEFAULT_QUALITY;
    this.scale = this.config.DEFAULT_SCALE;
    this.filename = this.config.DEFAULT_FILENAME;
    this.watermark = this.config.WATERMARK_ENABLED;
    this.watermarkText = this.config.WATERMARK_TEXT;
    this.watermarkPosition = this.config.WATERMARK_POSITION;
    this.watermarkFont = this.config.WATERMARK_FONT;
    this.watermarkColor = this.config.WATERMARK_COLOR;
  }
  
  /**
   * Capture and export an image of the current view
   * @param {Object} [options] - Export options
   * @param {string} [options.format='png'] - Output format ('png' or 'jpg')
   * @param {number} [options.quality=0.9] - JPEG quality (0.0-1.0)
   * @param {number} [options.scale=2] - Resolution scale factor
   * @param {string} [options.filename='protein-visualization'] - Output filename
   * @param {boolean} [options.watermark=false] - Whether to add a watermark
   */
  exportImage(options = {}) {
    // Apply options with defaults
    const format = options.format || this.format;
    const quality = options.quality || this.quality;
    const scale = options.scale || this.scale;
    const filename = options.filename || this.filename;
    const watermark = options.watermark !== undefined ? options.watermark : this.watermark;
    
    try {
      // Capture image from renderer at the specified scale
      const imageDataURL = this._captureImage(scale);
      
      // Add watermark if enabled
      const finalImageURL = watermark
        ? this._addWatermark(imageDataURL)
        : imageDataURL;
      
      // Download the image
      this._downloadImage(finalImageURL, filename, format);
      
      return true;
    } catch (error) {
      console.error('Error exporting image:', error);
      return false;
    }
  }
  
  /**
   * Capture an image from the renderer
   * @private
   * @param {number} scale - Resolution scale factor
   * @returns {string} Data URL of the image
   */
  _captureImage(scale) {
    const origSize = {
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height
    };
    
    // Calculate export size
    const exportWidth = Math.floor(origSize.width * scale);
    const exportHeight = Math.floor(origSize.height * scale);
    
    // Resize renderer temporarily
    this.renderer.setSize(exportWidth, exportHeight, false);
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
    
    // Get the image as a data URL
    let imageDataURL;
    
    if (this.format === 'jpg' || this.format === 'jpeg') {
      imageDataURL = this.renderer.domElement.toDataURL('image/jpeg', this.quality);
    } else {
      imageDataURL = this.renderer.domElement.toDataURL('image/png');
    }
    
    // Restore original size
    this.renderer.setSize(origSize.width, origSize.height, false);
    
    // Re-render at original size
    this.renderer.render(this.scene, this.camera);
    
    return imageDataURL;
  }
  
  /**
   * Add watermark to image
   * @private
   * @param {string} imageDataURL - Image data URL
   * @returns {string} Data URL of the image with watermark
   */
  _addWatermark(imageDataURL) {
    return new Promise((resolve, reject) => {
      // Create image element
      const img = new Image();
      
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Get context and draw image
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Add watermark
        ctx.font = this.watermarkFont;
        ctx.fillStyle = this.watermarkColor;
        
        // Measure text
        const textWidth = ctx.measureText(this.watermarkText).width;
        const textHeight = parseInt(this.watermarkFont, 10) || 14;
        
        // Calculate position
        let x, y;
        const padding = 10;
        
        switch (this.watermarkPosition) {
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
        
        // Draw watermark
        ctx.fillText(this.watermarkText, x, y);
        
        // Convert to data URL
        const format = this.format === 'jpg' || this.format === 'jpeg' 
          ? 'image/jpeg' 
          : 'image/png';
        
        const quality = this.format === 'jpg' || this.format === 'jpeg'
          ? this.quality
          : 1.0;
        
        resolve(canvas.toDataURL(format, quality));
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for watermarking'));
      };
      
      img.src = imageDataURL;
    });
  }
  
  /**
   * Download image as a file
   * @private
   * @param {string} dataURL - Image data URL
   * @param {string} filename - Output filename
   * @param {string} format - Output format
   */
  _downloadImage(dataURL, filename, format) {
    // Create download link
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `${filename}.${format}`;
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * Set export options
   * @param {Object} options - Export options
   */
  setOptions(options) {
    if (options.format) this.format = options.format;
    if (options.quality) this.quality = options.quality;
    if (options.scale) this.scale = options.scale;
    if (options.filename) this.filename = options.filename;
    if (options.watermark !== undefined) this.watermark = options.watermark;
    if (options.watermarkText) this.watermarkText = options.watermarkText;
    if (options.watermarkPosition) this.watermarkPosition = options.watermarkPosition;
    if (options.watermarkFont) this.watermarkFont = options.watermarkFont;
    if (options.watermarkColor) this.watermarkColor = options.watermarkColor;
  }
}
