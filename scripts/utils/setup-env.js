const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { resolveFromRoot } = require('./resolve-path');

// Define the path to the .env file in project root
const ENV_FILE_PATH = resolveFromRoot('.env');
const ENV_EXAMPLE_PATH = resolveFromRoot('docker-compose.env.example');

// Default environment variables (fallback if template not found)
const DEFAULT_ENV = {
  // Supabase Settings
  'SUPABASE_URL': "https://yjnbyvttjqhitkwthmbx.supabase.co",
  'SUPABASE_ANON_KEY': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqbmJ5dnR0anFoaXRrd3RobWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDg0NjUsImV4cCI6MjA2NDM4NDQ2NX0.OCO05CaVvoSEbKFg808w_fPlkxB_r1t5AQoV-I_HsnM",
  'SUPABASE_SERVICE_ROLE_KEY': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqbmJ5dnR0anFoaXRrd3RobWJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODgwODQ2NSwiZXhwIjoyMDY0Mzg0NDY1fQ.G4Q3-WU0R5rhu9WiJvImknuAvs4dVUiaStB_NytWML4",
  'SUPABASE_JWT_SECRET': "YlvZhabayzAu9o1zx05fY0NlhPlh7SSWk4rb7KczCqHf5eeq/OS8dA2x13CbPK9rF4eDew13iUpUJ5bjAO6Z+Q==",
  
  // Security Settings
  'JWT_SECRET': 'local-development-secret-key',
  
  // Environment
  'NODE_ENV': 'development',
};

/**
 * Creates or updates the .env file using the docker-compose.env.example template
 */
async function setupEnv() {
  console.log('Setting up environment variables...');
  
  // Check if .env file already exists
  if (fs.existsSync(ENV_FILE_PATH)) {
    console.log('Found existing .env file. Skipping setup to preserve your configuration.');
    console.log('If you want to recreate it, delete the .env file and run this script again.');
    return;
  }
  
  let templateContent = '';
  
  // Try to use the docker-compose.env.example template first
  if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    console.log('Using docker-compose.env.example template...');
    templateContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  } else {
    console.log('Template not found, using default values...');
    // Fallback to default values
    templateContent = Object.entries(DEFAULT_ENV)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  }
  
  // Write to .env file
  fs.writeFileSync(ENV_FILE_PATH, templateContent);
  
  console.log('.env file created successfully from template.');
  console.log('');
  console.log('🚨 IMPORTANT: Please update the values in .env with your actual Supabase credentials:');
  console.log('   1. SUPABASE_URL - Your Supabase project URL');
  console.log('   2. SUPABASE_ANON_KEY - Your Supabase anonymous key');
  console.log('   3. SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key');
  console.log('   4. SUPABASE_JWT_SECRET - Your Supabase JWT secret');
  console.log('');
  console.log('📖 See docs/setup/environment-setup.md for detailed setup instructions.');
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