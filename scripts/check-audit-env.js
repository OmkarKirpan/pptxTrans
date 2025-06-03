/**
 * Check Audit Environment
 * 
 * This script checks if the environment is properly set up for the audit service.
 * Run with: node scripts/check-audit-env.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Check for environment variables
function checkEnvVars() {
  console.log('Checking environment variables...');
  
  const dotEnvPath = path.join(process.cwd(), '.env');
  const dotEnvLocalPath = path.join(process.cwd(), '.env.local');
  
  const hasEnv = fs.existsSync(dotEnvPath);
  const hasEnvLocal = fs.existsSync(dotEnvLocalPath);
  
  if (!hasEnv && !hasEnvLocal) {
    console.error('❌ No .env or .env.local file found!');
    console.error('Please create a .env.local file with NEXT_PUBLIC_AUDIT_SERVICE_URL=http://localhost:4006');
    return false;
  }
  
  // Try to read the env files
  let envContent = '';
  if (hasEnv) {
    envContent += fs.readFileSync(dotEnvPath, 'utf8');
  }
  if (hasEnvLocal) {
    envContent += '\n' + fs.readFileSync(dotEnvLocalPath, 'utf8');
  }
  
  if (!envContent.includes('NEXT_PUBLIC_AUDIT_SERVICE_URL')) {
    console.error('❌ NEXT_PUBLIC_AUDIT_SERVICE_URL not found in env files!');
    console.error('Please add NEXT_PUBLIC_AUDIT_SERVICE_URL=http://localhost:4006 to your .env.local file');
    return false;
  }
  
  console.log('✅ Environment variables look good!');
  return true;
}

// Check for Supabase configuration in audit-service/.env file
function checkSupabaseConfig() {
  console.log('Checking Supabase configuration...');

  const auditServiceEnvPath = path.join(process.cwd(), 'audit-service', '.env');
  
  if (!fs.existsSync(auditServiceEnvPath)) {
    console.warn('⚠️ No .env file found in the audit-service directory!');
    console.warn('The audit service requires Supabase configuration in audit-service/.env file.');
    console.warn('Make sure this file exists with the following variables:');
    console.warn('  SUPABASE_URL=...');
    console.warn('  SUPABASE_KEY=...');
    console.warn('  SUPABASE_SERVICE_KEY=...');
    return false;
  }
  
  // We won't read the content for security reasons
  console.log('✅ Found audit-service/.env file');
  console.log('  Note: Not checking the file content for security reasons.');
  console.log('  Make sure it contains the required Supabase configuration variables.');
  return true;
}

// Check for the audit service directory
function checkAuditServiceDir() {
  console.log('Checking audit service directory...');
  
  const auditServicePath = path.join(process.cwd(), 'audit-service');
  if (!fs.existsSync(auditServicePath)) {
    console.error('❌ Audit service directory not found!');
    console.error('Expected audit-service directory in the project root');
    return false;
  }
  
  // Check for the main Go file
  const mainGoPath = path.join(auditServicePath, 'cmd', 'server', 'main.go');
  if (!fs.existsSync(mainGoPath)) {
    console.error('❌ Audit service main.go not found!');
    console.error(`Expected main.go at ${mainGoPath}`);
    return false;
  }
  
  console.log('✅ Audit service directory structure looks good!');
  return true;
}

// Check if Go is installed
function checkGoInstallation() {
  console.log('Checking Go installation...');
  
  exec('go version', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Go is not installed or not in PATH!');
      console.error('Please install Go from https://golang.org/dl/');
      return;
    }
    
    console.log(`✅ Go is installed: ${stdout.trim()}`);
  });
}

// Check if the port is available
function checkPort() {
  console.log('Checking if port 4006 is available...');
  
  const netCmd = process.platform === 'win32' 
    ? `netstat -ano | findstr :4006` 
    : `lsof -i :4006`;
  
  exec(netCmd, (error, stdout, stderr) => {
    if (!error && stdout.trim()) {
      console.error('❌ Port 4006 is already in use!');
      console.error('Please stop any service using port 4006 before starting the audit service');
      return;
    }
    
    console.log('✅ Port 4006 is available!');
  });
}

// Run all checks
function runAllChecks() {
  console.log('Running environment checks for audit service integration...\n');
  
  const envOk = checkEnvVars();
  const dirOk = checkAuditServiceDir();
  const supabaseOk = checkSupabaseConfig();
  checkGoInstallation();
  checkPort();
  
  console.log('\nSummary:');
  if (envOk && dirOk) {
    console.log('✅ Basic setup looks good!');
    
    if (!supabaseOk) {
      console.log('⚠️ Warning: Make sure the audit-service/.env file exists with proper Supabase configuration.');
    }
    
    console.log('\nYou can try starting the audit service:');
    if (process.platform === 'win32') {
      console.log('   .\\scripts\\start-audit-service.bat');
    } else {
      console.log('   chmod +x scripts/start-audit-service.sh');
      console.log('   ./scripts/start-audit-service.sh');
    }
  } else {
    console.log('❌ There are some issues with your setup. Please fix them before continuing.');
  }
}

runAllChecks(); 