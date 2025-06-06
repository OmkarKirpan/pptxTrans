#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const { resolveFromRoot } = require('./utils/resolve-path');
const { validateEnv } = require('./utils/setup-env');

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
 * Run a command and capture output
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      ...options,
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Check if a command is available
 */
async function checkCommand(command, displayName) {
  try {
    const result = await runCommand(command, ['--version']);
    if (result.code === 0) {
      console.log(`${colors.green}✅ ${displayName} is available${colors.reset}`);
      return true;
    }
  } catch (error) {
    // Command not found
  }
  console.log(`${colors.red}❌ ${displayName} is not available${colors.reset}`);
  return false;
}

/**
 * Check Docker installation and status
 */
async function checkDocker() {
  console.log(`${colors.cyan}🐳 Checking Docker...${colors.reset}`);
  
  const dockerAvailable = await checkCommand('docker', 'Docker');
  const composeAvailable = await checkCommand('docker-compose', 'Docker Compose');
  
  if (!dockerAvailable || !composeAvailable) {
    console.log(`${colors.yellow}💡 Install Docker Desktop: https://www.docker.com/products/docker-desktop${colors.reset}`);
    return false;
  }
  
  // Check if Docker daemon is running
  try {
    const result = await runCommand('docker', ['info']);
    if (result.code === 0) {
      console.log(`${colors.green}✅ Docker daemon is running${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Docker daemon is not running${colors.reset}`);
      console.log(`${colors.yellow}💡 Start Docker Desktop or run: sudo systemctl start docker${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Cannot connect to Docker daemon${colors.reset}`);
    return false;
  }
  
  return true;
}

/**
 * Check environment variables
 */
async function checkEnvironment() {
  console.log(`${colors.cyan}⚙️  Checking Environment Variables...${colors.reset}`);
  
  const envPath = resolveFromRoot('.env');
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.red}❌ No .env file found${colors.reset}`);
    console.log(`${colors.yellow}💡 Run: node scripts/docker-manager.js env${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.green}✅ .env file exists${colors.reset}`);
  
  // Use the validateEnv function from setup-env.js
  const isValid = validateEnv();
  
  if (!isValid) {
    console.log(`${colors.yellow}💡 Update your .env file with proper Supabase credentials${colors.reset}`);
  }
  
  return isValid;
}

/**
 * Check port availability
 */
async function checkPorts() {
  console.log(`${colors.cyan}🔌 Checking Port Availability...${colors.reset}`);
  
  const ports = [
    { port: 3000, service: 'Frontend' },
    { port: 3001, service: 'Share Service' },
    { port: 4006, service: 'Audit Service' },
    { port: 8000, service: 'PPTX Processor' }
  ];
  
  for (const { port, service } of ports) {
    try {
      // Use netstat or lsof to check if port is in use
      const result = await runCommand('netstat', ['-an']);
      if (result.stdout.includes(`:${port}`)) {
        console.log(`${colors.yellow}⚠️  Port ${port} (${service}) appears to be in use${colors.reset}`);
      } else {
        console.log(`${colors.green}✅ Port ${port} (${service}) is available${colors.reset}`);
      }
    } catch (error) {
      // Fallback: try to connect to the port
      try {
        const result = await runCommand('curl', ['-f', `http://localhost:${port}`, '--max-time', '2']);
        if (result.code === 0) {
          console.log(`${colors.green}✅ Service responding on port ${port} (${service})${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️  Port ${port} (${service}) not responding${colors.reset}`);
        }
      } catch {
        console.log(`${colors.green}✅ Port ${port} (${service}) appears available${colors.reset}`);
      }
    }
  }
}

/**
 * Check container status
 */
async function checkContainers() {
  console.log(`${colors.cyan}📦 Checking Container Status...${colors.reset}`);
  
  try {
    const result = await runCommand('docker-compose', ['ps']);
    if (result.code === 0) {
      console.log(`${colors.blue}Container Status:${colors.reset}`);
      console.log(result.stdout);
    } else {
      console.log(`${colors.red}❌ Error checking container status${colors.reset}`);
      if (result.stderr) {
        console.log(result.stderr);
      }
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error running docker-compose ps${colors.reset}`);
  }
  
  // Check individual containers
  const containers = [
    'pptxtransed-frontend',
    'pptxtransed-audit-service', 
    'pptxtransed-pptx-processor',
    'pptxtransed-share-service'
  ];
  
  for (const container of containers) {
    try {
      const result = await runCommand('docker', ['ps', '--filter', `name=${container}`, '--format', '{{.Status}}']);
      if (result.stdout.trim()) {
        console.log(`${colors.green}✅ ${container}: ${result.stdout.trim()}${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ ${container}: Not running${colors.reset}`);
        
        // Check if container exists but is stopped
        const existsResult = await runCommand('docker', ['ps', '-a', '--filter', `name=${container}`, '--format', '{{.Status}}']);
        if (existsResult.stdout.trim()) {
          console.log(`${colors.yellow}   Status: ${existsResult.stdout.trim()}${colors.reset}`);
        }
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error checking ${container}${colors.reset}`);
    }
  }
}

/**
 * Show recent logs
 */
async function showRecentLogs() {
  console.log(`${colors.cyan}📋 Recent Container Logs...${colors.reset}`);
  
  try {
    const result = await runCommand('docker-compose', ['logs', '--tail=5']);
    if (result.code === 0) {
      console.log(result.stdout);
    } else {
      console.log(`${colors.red}❌ Error retrieving logs${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error running docker-compose logs${colors.reset}`);
  }
}

/**
 * Provide common solutions
 */
function showCommonSolutions() {
  console.log(`${colors.cyan}💡 Common Issues and Solutions:${colors.reset}\n`);
  
  console.log(`${colors.yellow}1. Build Failures:${colors.reset}`);
  console.log(`   ${colors.blue}Solution: Run 'node scripts/docker-manager.js rebuild'${colors.reset}\n`);
  
  console.log(`${colors.yellow}2. Port Conflicts:${colors.reset}`);
  console.log(`   ${colors.blue}Solution: Stop other services using ports 3000, 3001, 4006, 8000${colors.reset}`);
  console.log(`   ${colors.blue}Commands: sudo lsof -i :3000 && sudo kill -9 <PID>${colors.reset}\n`);
  
  console.log(`${colors.yellow}3. Environment Issues:${colors.reset}`);
  console.log(`   ${colors.blue}Solution: Update .env file with valid Supabase credentials${colors.reset}`);
  console.log(`   ${colors.blue}Command: node scripts/docker-manager.js env${colors.reset}\n`);
  
  console.log(`${colors.yellow}4. Docker Permission Issues:${colors.reset}`);
  console.log(`   ${colors.blue}Solution: Ensure Docker daemon is running and user has permissions${colors.reset}`);
  console.log(`   ${colors.blue}Linux: sudo usermod -aG docker $USER (then logout/login)${colors.reset}\n`);
  
  console.log(`${colors.yellow}5. Share Service Logger Error:${colors.reset}`);
  console.log(`   ${colors.green}✅ Fixed: Updated to use Bun-compatible logger${colors.reset}\n`);
  
  console.log(`${colors.yellow}6. Audit Service Configuration Error:${colors.reset}`);
  console.log(`   ${colors.green}✅ Fixed: Enhanced environment variable loading${colors.reset}\n`);
  
  console.log(`${colors.yellow}7. PPTX Processor Build Error:${colors.reset}`);
  console.log(`   ${colors.green}✅ Fixed: Corrected apt-get command in Dockerfile${colors.reset}\n`);
}

/**
 * Main troubleshooting function
 */
async function main() {
  console.log(`${colors.cyan}🔧 PPTXTransed Troubleshooting Tool${colors.reset}\n`);
  
  try {
    // Ensure we're in the project root
    process.chdir(resolveFromRoot());
    
    const dockerOk = await checkDocker();
    console.log('');
    
    const envOk = await checkEnvironment();
    console.log('');
    
    await checkPorts();
    console.log('');
    
    if (dockerOk) {
      await checkContainers();
      console.log('');
      
      await showRecentLogs();
      console.log('');
    }
    
    showCommonSolutions();
    
    console.log(`${colors.cyan}🚀 Quick Commands:${colors.reset}`);
    console.log(`${colors.blue}Start services: node scripts/docker-manager.js start${colors.reset}`);
    console.log(`${colors.blue}Rebuild services: node scripts/docker-manager.js rebuild${colors.reset}`);
    console.log(`${colors.blue}View logs: node scripts/docker-manager.js logs${colors.reset}`);
    console.log(`${colors.blue}Check health: node scripts/docker-manager.js health${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Error during troubleshooting: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
} 