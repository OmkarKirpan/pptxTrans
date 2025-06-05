const path = require('path');
const fs = require('fs');

/**
 * Resolves paths relative to the project root
 * 
 * @param {...string} segments - Path segments to join
 * @returns {string} - Absolute path from project root
 */
function resolveFromRoot(...segments) {
  // Find project root by looking for package.json
  let currentDir = process.cwd();
  
  // If we're already at the root, just resolve from here
  if (fs.existsSync(path.join(currentDir, 'package.json'))) {
    return path.resolve(currentDir, ...segments);
  }
  
  // Try to find the root by looking for package.json in parent directories
  let maxDepth = 5; // Prevent infinite loop
  let foundRoot = false;
  
  while (maxDepth > 0 && !foundRoot) {
    // Go one directory up
    currentDir = path.dirname(currentDir);
    
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      foundRoot = true;
      break;
    }
    
    maxDepth--;
  }
  
  if (!foundRoot) {
    console.error('Could not find project root (no package.json found in parent directories)');
    // Fallback to current working directory
    return path.resolve(process.cwd(), ...segments);
  }
  
  return path.resolve(currentDir, ...segments);
}

module.exports = {
  resolveFromRoot
}; 