/**
 * PDBLoader.js - Utility for loading and parsing Protein Data Bank (PDB) files
 * Handles fetching PDB files from URLs or uploaded files and parsing the content
 */

import { PDBParser } from '../utils/PDBParser.js';

export class PDBLoader {
  /**
   * Create a new PDB loader
   */
  constructor() {
    this.parser = new PDBParser();
  }
  
  /**
   * Load a PDB file from a URL
   * @param {string} url - URL to the PDB file
   * @param {Function} [onProgress] - Callback for loading progress
   * @returns {Promise<Object>} Promise resolving to parsed PDB data
   */
  async load(url, onProgress = null) {
    try {
      // Fetch the PDB file
      const response = await this._fetchWithProgress(url, onProgress);
      
      if (!response.ok) {
        throw new Error(`Failed to load PDB file: ${response.statusText}`);
      }
      
      // Read the text content
      const pdbText = await response.text();
      
      // Parse the PDB content
      return this.parser.parse(pdbText);
      
    } catch (error) {
      console.error('Error loading PDB file:', error);
      throw error;
    }
  }
  
  /**
   * Load a PDB file from an uploaded File object
   * @param {File} file - File object from input element
   * @param {Function} [onProgress] - Callback for loading progress
   * @returns {Promise<Object>} Promise resolving to parsed PDB data
   */
  async loadFromFile(file, onProgress = null) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // Setup progress handler if provided
      if (onProgress) {
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = event.loaded / event.total;
            onProgress(progress);
          }
        };
      }
      
      // Handle load completion
      reader.onload = async (event) => {
        try {
          const pdbText = event.target.result;
          const pdbData = this.parser.parse(pdbText);
          resolve(pdbData);
        } catch (error) {
          reject(error);
        }
      };
      
      // Handle errors
      reader.onerror = (error) => {
        reject(new Error('Error reading PDB file: ' + error));
      };
      
      // Start reading the file as text
      reader.readAsText(file);
    });
  }
  
  /**
   * Fetch with progress tracking
   * @private
   * @param {string} url - URL to fetch
   * @param {Function} [onProgress] - Progress callback
   * @returns {Promise<Response>} Fetch response
   */
  async _fetchWithProgress(url, onProgress) {
    // If no progress callback, just use regular fetch
    if (!onProgress) {
      return fetch(url);
    }
    
    // Use fetch with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      
      // Track download progress
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = event.loaded / event.total;
          onProgress(progress);
        }
      };
      
      // Handle completion
      xhr.onload = () => {
        if (xhr.status === 200) {
          // Convert XHR response to fetch Response
          const response = new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText
          });
          resolve(response);
        } else {
          reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
        }
      };
      
      // Handle errors
      xhr.onerror = () => {
        reject(new Error('Network error occurred while loading PDB file'));
      };
      
      // Start the request
      xhr.send();
    });
  }
  
  /**
   * Check if a URL points to a valid PDB file
   * @param {string} url - URL to check
   * @returns {Promise<boolean>} Promise resolving to true if URL is a valid PDB file
   */
  async validateUrl(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        return false;
      }
      
      // Check content type if available
      const contentType = response.headers.get('content-type');
      
      // Valid content types for PDB files
      const validTypes = ['chemical/x-pdb', 'text/plain', 'application/octet-stream'];
      
      if (contentType && !validTypes.some(type => contentType.includes(type))) {
        // If content type is provided but not valid
        return false;
      }
      
      // Check file extension if URL has one
      const hasValidExtension = url.toLowerCase().endsWith('.pdb');
      
      return hasValidExtension;
      
    } catch (error) {
      console.error('Error validating PDB URL:', error);
      return false;
    }
  }
}
