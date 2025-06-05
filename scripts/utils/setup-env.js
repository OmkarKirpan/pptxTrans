const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { resolveFromRoot } = require('./resolve-path');

// Define the path to the .env file in project root
const ENV_FILE_PATH = resolveFromRoot('.env');

// Default environment variables
const DEFAULT_ENV = {
  // Supabase Settings
  'SUPABASE_URL': 'https://your-project-id.supabase.co',
  'SUPABASE_ANON_KEY': 'your-supabase-anon-key',
  'SUPABASE_SERVICE_ROLE_KEY': 'your-supabase-service-key',
  'SUPABASE_JWT_SECRET': 'your-supabase-jwt-secret',
  
  // Audit Service Settings
  'JWT_SECRET': 'local-development-secret-key',
  
  // Docker Settings
  'COMPOSE_PROJECT_NAME': 'pptxtransed',
};

/**
 * Creates or updates the .env file
 */
async function setupEnv() {
  console.log('Setting up environment variables...');
  
  let existingEnv = {};
  
  // Check if .env file already exists
  if (fs.existsSync(ENV_FILE_PATH)) {
    console.log('Found existing .env file. Merging with defaults...');
    
    // Read existing .env file
    const envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    
    // Parse existing variables
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        existingEnv[key] = value;
      }
    });
  }
  
  // Merge defaults with existing values
  const mergedEnv = { ...DEFAULT_ENV, ...existingEnv };
  
  // Create the .env file content
  const envContent = Object.entries(mergedEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  // Write to .env file
  fs.writeFileSync(ENV_FILE_PATH, envContent);
  
  console.log('.env file created/updated successfully.');
  console.log('Please update the values in .env with your actual configuration before running the services.');
}

// If this script is run directly
if (require.main === module) {
  setupEnv().catch(err => {
    console.error('Error setting up environment:', err);
    process.exit(1);
  });
}

module.exports = {
  setupEnv,
  ENV_FILE_PATH,
}; 