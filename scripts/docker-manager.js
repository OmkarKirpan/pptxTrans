#!/usr/bin/env node

const { spawn } = require('child_process');
const { setupEnv } = require('./utils/setup-env');
const { resolveFromRoot } = require('./utils/resolve-path');

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
 * Main function to handle Docker operations
 */
async function main() {
  const command = process.argv[2] || 'help';
  
  try {
    // Ensure we're in the project root
    process.chdir(resolveFromRoot());
    
    switch (command) {
      case 'start':
        console.log(`${colors.green}Starting all services with Docker Compose...${colors.reset}`);
        await setupEnv();
        await runCommand('docker-compose', ['up', '-d']);
        console.log(`${colors.green}Services started successfully!${colors.reset}`);
        console.log(`${colors.yellow}Frontend: http://localhost:3000${colors.reset}`);
        console.log(`${colors.yellow}Audit Service: http://localhost:4006${colors.reset}`);
        console.log(`${colors.yellow}PPTX Processor: http://localhost:8000${colors.reset}`);
        console.log(`${colors.yellow}Share Service: http://localhost:3001${colors.reset}`);
        break;
        
      case 'stop':
        console.log(`${colors.yellow}Stopping all services...${colors.reset}`);
        await runCommand('docker-compose', ['down']);
        console.log(`${colors.green}Services stopped successfully!${colors.reset}`);
        break;
        
      case 'restart':
        console.log(`${colors.yellow}Restarting all services...${colors.reset}`);
        await runCommand('docker-compose', ['restart']);
        console.log(`${colors.green}Services restarted successfully!${colors.reset}`);
        break;
        
      case 'rebuild':
        console.log(`${colors.yellow}Rebuilding all services...${colors.reset}`);
        await setupEnv();
        await runCommand('docker-compose', ['build']);
        console.log(`${colors.green}Services rebuilt successfully!${colors.reset}`);
        break;
        
      case 'logs':
        const service = process.argv[3] || '';
        console.log(`${colors.yellow}Showing logs for ${service || 'all services'}...${colors.reset}`);
        await runCommand('docker-compose', ['logs', '-f', service]);
        break;
        
      case 'ps':
        console.log(`${colors.yellow}Listing running services...${colors.reset}`);
        await runCommand('docker-compose', ['ps']);
        break;
        
      case 'shell':
        const shellService = process.argv[3];
        if (!shellService) {
          console.error(`${colors.red}Please specify a service name: frontend, audit-service, pptx-processor, or share-service${colors.reset}`);
          process.exit(1);
        }
        console.log(`${colors.yellow}Opening shell in ${shellService}...${colors.reset}`);
        await runCommand('docker-compose', ['exec', shellService, 'sh']);
        break;
        
      case 'env':
        console.log(`${colors.yellow}Setting up environment variables...${colors.reset}`);
        await setupEnv();
        console.log(`${colors.green}Environment variables set up successfully!${colors.reset}`);
        break;
        
      case 'help':
      default:
        console.log(`
${colors.cyan}Docker Manager for PPTXTransed${colors.reset}

Usage: node scripts/docker-manager.js [command]

Commands:
  ${colors.green}start${colors.reset}     Start all services with Docker Compose
  ${colors.green}stop${colors.reset}      Stop all services
  ${colors.green}restart${colors.reset}   Restart all services
  ${colors.green}rebuild${colors.reset}   Rebuild all services
  ${colors.green}logs${colors.reset}      Show logs for all services (or specify a service)
  ${colors.green}ps${colors.reset}        List running services
  ${colors.green}shell${colors.reset}     Open a shell in a specific service container
  ${colors.green}env${colors.reset}       Set up environment variables
  ${colors.green}help${colors.reset}      Show this help message
        `);
        break;
    }
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Unhandled error: ${err.message}${colors.reset}`);
  process.exit(1);
}); 