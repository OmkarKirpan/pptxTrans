#!/usr/bin/env node

const { spawn } = require('child_process');
const { setupEnv } = require('./utils/setup-env');
const { resolveFromRoot } = require('./utils/resolve-path');
const fs = require('fs');
const path = require('path');

// Define colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Run a command and pipe output to console
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @param {Object} options - Spawn options
 * @returns {Promise<number>} - Exit code
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`${colors.blue}> ${command} ${args.join(' ')}${colors.reset}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Read root .env file and extract common variables
 */
function getRootEnvVariables() {
  const rootEnvPath = resolveFromRoot('.env');
  if (!fs.existsSync(rootEnvPath)) {
    return {};
  }

  const envContent = fs.readFileSync(rootEnvPath, 'utf8');
  const envVars = {};
  
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=');
      envVars[key] = value;
    }
  }
  
  return envVars;
}

/**
 * Update service .env file with common variables from root
 */
function updateServiceEnvWithRootVars(envPath, rootVars) {
  if (!fs.existsSync(envPath)) {
    return false;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  let updated = false;

  // Common variables that should be synchronized from root
  const commonVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET',
    'JWT_SECRET'
  ];

  for (const varName of commonVars) {
    if (rootVars[varName]) {
      const regex = new RegExp(`^${varName}=.*$`, 'm');
      const newLine = `${varName}=${rootVars[varName]}`;
      
      if (regex.test(envContent)) {
        // Replace existing line
        envContent = envContent.replace(regex, newLine);
        updated = true;
      } else {
        // Add missing variable
        envContent += `\n${newLine}`;
        updated = true;
      }
    }
  }

  if (updated) {
    fs.writeFileSync(envPath, envContent);
  }

  return updated;
}

/**
 * Setup .env files for all services
 */
async function setupServiceEnvFiles() {
  const servicesDir = resolveFromRoot('services');
  const services = [
    'audit-service',
    'pptx-processor', 
    'share-service',
    'translation-session-service'
  ];

  console.log(`${colors.cyan}🔧 Setting up service environment files...${colors.reset}`);

  // Get common variables from root .env
  const rootVars = getRootEnvVariables();
  const hasRootVars = Object.keys(rootVars).length > 0;

  for (const service of services) {
    const serviceDir = path.join(servicesDir, service);
    const envExamplePath = path.join(serviceDir, 'env.example');
    const envPath = path.join(serviceDir, '.env');

    if (!fs.existsSync(serviceDir)) {
      console.log(`${colors.yellow}⚠️  Service directory not found: ${service}${colors.reset}`);
      continue;
    }

    if (!fs.existsSync(envExamplePath)) {
      console.log(`${colors.yellow}⚠️  No env.example found for ${service}${colors.reset}`);
      continue;
    }

    let created = false;
    let synchronized = false;

    // Create .env from env.example if it doesn't exist
    if (!fs.existsSync(envPath)) {
      try {
        const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
        fs.writeFileSync(envPath, envExampleContent);
        created = true;
        console.log(`${colors.green}✅ ${service}: Created .env from env.example${colors.reset}`);
      } catch (error) {
        console.log(`${colors.red}❌ ${service}: Failed to create .env file - ${error.message}${colors.reset}`);
        continue;
      }
    }

    // Synchronize common variables from root .env
    if (hasRootVars) {
      try {
        synchronized = updateServiceEnvWithRootVars(envPath, rootVars);
        if (synchronized && !created) {
          console.log(`${colors.green}✅ ${service}: Synchronized common variables from root .env${colors.reset}`);
        }
      } catch (error) {
        console.log(`${colors.yellow}⚠️  ${service}: Failed to synchronize variables - ${error.message}${colors.reset}`);
      }
    }

    if (!created && !synchronized) {
      console.log(`${colors.green}✅ ${service}: .env file up to date${colors.reset}`);
    }
  }

  console.log(`${colors.cyan}💡 Service .env files have been created/updated with common variables${colors.reset}`);
  console.log(`${colors.cyan}   Remember to review and update service-specific configuration values as needed${colors.reset}`);
}

/**
 * Check if Docker and Docker Compose are available
 */
async function checkDockerDependencies() {
  try {
    await runCommand('docker', ['--version'], { stdio: 'pipe' });
    await runCommand('docker-compose', ['--version'], { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`${colors.red}Error: Docker or Docker Compose is not available.${colors.reset}`);
    console.error(`${colors.red}Please install Docker and Docker Compose to continue.${colors.reset}`);
    return false;
  }
}

/**
 * Validate environment file
 */
function validateEnvironment() {
  const envPath = resolveFromRoot('.env');
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.yellow}⚠️  No .env file found. Creating one now...${colors.reset}`);
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET',
    'JWT_SECRET'
  ];
  
  const missingVars = requiredVars.filter(varName => 
    !envContent.includes(`${varName}=`) || 
    envContent.includes(`${varName}=your-`) ||
    envContent.includes(`${varName}=https://your-project-id.supabase.co`)
  );
  
  if (missingVars.length > 0) {
    console.log(`${colors.yellow}⚠️  Please update these environment variables in .env:${colors.reset}`);
    missingVars.forEach(varName => {
      console.log(`${colors.yellow}   - ${varName}${colors.reset}`);
    });
    console.log(`${colors.yellow}   See docs/setup/environment-setup.md for guidance.${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.green}✅ Environment variables validated${colors.reset}`);
  return true;
}

/**
 * Show service health status
 */
async function showServiceHealth() {
  const services = [
    { name: 'Frontend', url: 'http://localhost:3000', container: 'pptxtransed-frontend' },
    { name: 'Audit Service', url: 'http://localhost:4006/health', container: 'pptxtransed-audit-service' },
    { name: 'PPTX Processor', url: 'http://localhost:8000/v1/health', container: 'pptxtransed-pptx-processor' },
    { name: 'Share Service', url: 'http://localhost:3001/health', container: 'pptxtransed-share-service' }
  ];
  
  console.log(`${colors.cyan}Service Health Check:${colors.reset}`);
  
  for (const service of services) {
    try {
      // Check if container is running
      const result = await runCommand('docker', ['ps', '--filter', `name=${service.container}`, '--format', '{{.Names}}'], { stdio: 'pipe' });
      if (result === 0) {
        console.log(`${colors.green}✅ ${service.name} - Running${colors.reset}`);
        console.log(`${colors.blue}   URL: ${service.url}${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ ${service.name} - Not running${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ ${service.name} - Error checking status${colors.reset}`);
    }
  }
}

/**
 * Troubleshoot common issues
 */
async function troubleshoot() {
  console.log(`${colors.cyan}🔧 Troubleshooting Docker Services${colors.reset}\n`);
  
  // Check Docker
  console.log(`${colors.blue}Checking Docker installation...${colors.reset}`);
  const dockerOk = await checkDockerDependencies();
  if (!dockerOk) return;
  
  // Check environment
  console.log(`${colors.blue}Checking environment variables...${colors.reset}`);
  const envOk = validateEnvironment();
  if (!envOk) {
    console.log(`${colors.yellow}Run 'node scripts/docker-manager.js env' to set up environment.${colors.reset}\n`);
  }
  
  // Show container status
  console.log(`${colors.blue}Checking container status...${colors.reset}`);
  try {
    await runCommand('docker-compose', ['ps']);
  } catch (error) {
    console.log(`${colors.red}Error checking container status${colors.reset}`);
  }
  
  // Show recent logs
  console.log(`${colors.blue}\nShowing recent logs...${colors.reset}`);
  try {
    await runCommand('docker-compose', ['logs', '--tail=10']);
  } catch (error) {
    console.log(`${colors.red}Error retrieving logs${colors.reset}`);
  }
  
  console.log(`${colors.cyan}\n💡 Common Issues and Solutions:${colors.reset}`);
  console.log(`${colors.yellow}1. Build failures: Try 'rebuild' command${colors.reset}`);
  console.log(`${colors.yellow}2. Port conflicts: Stop other services on ports 3000, 3001, 4006, 8000${colors.reset}`);
  console.log(`${colors.yellow}3. Environment issues: Update .env file with valid Supabase credentials${colors.reset}`);
  console.log(`${colors.yellow}4. Permission issues: Ensure Docker daemon is running${colors.reset}`);
}

/**
 * Main function to handle Docker operations
 */
async function main() {
  const command = process.argv[2] || 'help';
  
  try {
    // Ensure we're in the project root
    process.chdir(resolveFromRoot());
    
    switch (command) {
      case 'start':
        console.log(`${colors.green}🚀 Starting all services with Docker Compose...${colors.reset}`);
        
        // Check dependencies
        const dockerOk = await checkDockerDependencies();
        if (!dockerOk) process.exit(1);
        
        // Setup environment
        await setupEnv();
        
        // Validate environment
        const envOk = validateEnvironment();
        if (!envOk) {
          console.log(`${colors.yellow}⚠️  Environment validation failed. Services may not start properly.${colors.reset}`);
          console.log(`${colors.yellow}   Continue anyway? (y/N)${colors.reset}`);
          // For now, continue without user input in automated scenarios
        }
        
        // Start services
        await runCommand('docker-compose', ['up', '-d']);
        
        console.log(`${colors.green}✅ Services started successfully!${colors.reset}\n`);
        await showServiceHealth();
        break;

      case 'start-env':
        console.log(`${colors.green}🚀 Starting all services with .env files method...${colors.reset}`);
        
        // Check dependencies
        const dockerOkEnv = await checkDockerDependencies();
        if (!dockerOkEnv) process.exit(1);
        
        // Setup environment and service env files
        await setupEnv();
        await setupServiceEnvFiles();
        
        // Validate environment
        const envOkEnv = validateEnvironment();
        if (!envOkEnv) {
          console.log(`${colors.yellow}⚠️  Environment validation failed. Services may not start properly.${colors.reset}`);
        }
        
        // Start services with .env files
        await runCommand('docker-compose', ['-f', 'docker-compose.yml', '-f', 'docker-compose.env.yml', 'up', '-d']);
        
        console.log(`${colors.green}✅ Services started successfully with .env files!${colors.reset}\n`);
        await showServiceHealth();
        break;
        
      case 'stop':
        console.log(`${colors.yellow}🛑 Stopping all services...${colors.reset}`);
        await runCommand('docker-compose', ['down']);
        console.log(`${colors.green}✅ Services stopped successfully!${colors.reset}`);
        break;
        
      case 'restart':
        console.log(`${colors.yellow}🔄 Restarting all services...${colors.reset}`);
        await runCommand('docker-compose', ['restart']);
        console.log(`${colors.green}✅ Services restarted successfully!${colors.reset}`);
        await showServiceHealth();
        break;
        
      case 'rebuild':
        console.log(`${colors.yellow}🔨 Rebuilding all services...${colors.reset}`);
        await setupEnv();
        await runCommand('docker-compose', ['build', '--no-cache']);
        console.log(`${colors.green}✅ Services rebuilt successfully!${colors.reset}`);
        break;
        
      case 'logs':
        const service = process.argv[3] || '';
        console.log(`${colors.yellow}📋 Showing logs for ${service || 'all services'}...${colors.reset}`);
        await runCommand('docker-compose', ['logs', '-f', service]);
        break;
        
      case 'ps':
        console.log(`${colors.yellow}📊 Listing running services...${colors.reset}`);
        await runCommand('docker-compose', ['ps']);
        await showServiceHealth();
        break;
        
      case 'shell':
        const shellService = process.argv[3];
        if (!shellService) {
          console.error(`${colors.red}Please specify a service name: frontend, audit-service, pptx-processor, or share-service${colors.reset}`);
          process.exit(1);
        }
        console.log(`${colors.yellow}🐚 Opening shell in ${shellService}...${colors.reset}`);
        await runCommand('docker-compose', ['exec', shellService, 'sh']);
        break;
        
      case 'env':
        console.log(`${colors.yellow}⚙️  Setting up environment variables...${colors.reset}`);
        await setupEnv();
        validateEnvironment();
        await setupServiceEnvFiles();
        console.log(`${colors.green}✅ Environment setup complete!${colors.reset}`);
        break;
        
      case 'health':
        await showServiceHealth();
        break;
        
      case 'troubleshoot':
      case 'debug':
        await troubleshoot();
        break;
        
      case 'clean':
        console.log(`${colors.yellow}🧹 Cleaning up Docker resources...${colors.reset}`);
        await runCommand('docker-compose', ['down', '--volumes', '--remove-orphans']);
        await runCommand('docker', ['system', 'prune', '-f']);
        console.log(`${colors.green}✅ Cleanup complete!${colors.reset}`);
        break;
        
      case 'help':
      default:
        console.log(`
${colors.cyan}🐳 Docker Manager for PPTXTransed${colors.reset}

Usage: node scripts/docker-manager.js [command]

Commands:
  ${colors.green}start${colors.reset}           Start all services with Docker Compose
  ${colors.green}start-env${colors.reset}       Start all services using individual .env files
  ${colors.green}stop${colors.reset}            Stop all services
  ${colors.green}restart${colors.reset}         Restart all services
  ${colors.green}rebuild${colors.reset}         Rebuild all services (no cache)
  ${colors.green}logs [service]${colors.reset}  Show logs for all services (or specify a service)
  ${colors.green}ps${colors.reset}              List running services with health status
  ${colors.green}shell <service>${colors.reset} Open a shell in a specific service container
  ${colors.green}env${colors.reset}             Set up environment variables for root and all services
  ${colors.green}health${colors.reset}          Check service health status
  ${colors.green}troubleshoot${colors.reset}    Run troubleshooting checks
  ${colors.green}clean${colors.reset}           Clean up Docker resources
  ${colors.green}help${colors.reset}            Show this help message

${colors.cyan}Examples:${colors.reset}
  node scripts/docker-manager.js start
  node scripts/docker-manager.js logs share-service
  node scripts/docker-manager.js shell pptx-processor

${colors.cyan}Troubleshooting:${colors.reset}
  If services fail to start, run: node scripts/docker-manager.js troubleshoot
        `);
        break;
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    console.error(`${colors.yellow}💡 Try running 'node scripts/docker-manager.js troubleshoot' for help${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}💥 Unhandled error: ${err.message}${colors.reset}`);
  process.exit(1);
}); 