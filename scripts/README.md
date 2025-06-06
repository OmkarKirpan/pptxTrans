# Scripts Directory

This directory contains various utility scripts for managing services, running tests, and performing environment checks.

## Directory Structure

```
scripts/
├── docker-manager.js        # 🐳 Enhanced Docker management script (Node.js)
├── docker-manager.bat       # 🪟 Docker management script (Windows)
├── docker-manager.sh        # 🐧 Docker management script (Linux/macOS)
├── troubleshoot.js          # 🔧 Comprehensive troubleshooting tool
├── services/                # Service startup scripts
│   ├── audit/               # Audit service scripts (start.sh, start.bat)
│   ├── pptx/                # PPTX processor service scripts (start.sh, start.bat)
│   └── share/               # ✅ Updated Share service scripts (start.sh, start.bat)
├── tests/                   # Integration and test scripts
│   ├── test-pptx-integration.js  # PPTX processor integration tests
│   └── test-audit-service.js     # Audit service tests
└── utils/                   # Utility scripts
    ├── check-audit-env.js   # Environment validation script
    ├── resolve-path.js      # Path resolution utility
    └── setup-env.js         # ✅ Enhanced environment setup utility
```

## 🆕 Recent Updates & Fixes

### ✅ **Fixed Issues:**
1. **Share Service Logger**: Replaced pino transport with Bun-compatible logger
2. **Missing Environment Variables**: Added `SHARE_TOKEN_SECRET` support
3. **Audit Service Configuration**: Enhanced environment variable loading
4. **PPTX Processor Build**: Fixed Dockerfile apt-get command
5. **Docker Compose**: Removed obsolete version field

### 🚀 **Enhanced Features:**
- **Troubleshooting Tool**: New comprehensive diagnostic script
- **Environment Validation**: Automatic validation and missing variable detection
- **Health Checks**: Service health monitoring with status indicators
- **Better Error Handling**: Improved error messages and solutions
- **Emoji Icons**: Clear visual feedback for all operations

## Usage

### 🐳 Enhanced Docker Manager

The Docker manager script provides comprehensive commands for managing Docker operations:

**Unix/Linux/macOS (Node.js):**
```bash
# Start all services with validation
node docker-manager.js start

# Stop all services
node docker-manager.js stop

# Check service health
node docker-manager.js health

# Troubleshoot issues
node docker-manager.js troubleshoot

# Other commands: restart, rebuild, logs, ps, shell, env, clean, help
```

**Windows:**
```cmd
# Start all services
docker-manager.bat start

# Stop all services
docker-manager.bat stop

# Other commands: restart, rebuild, logs, ps, shell, env, help
```

### 🔧 Troubleshooting Tool

New comprehensive troubleshooting script to diagnose common issues:

```bash
# Run full system check
node scripts/troubleshoot.js

# Or use through docker manager
node scripts/docker-manager.js troubleshoot
```

**What it checks:**
- ✅ Docker installation and daemon status
- ✅ Environment variables validation
- ✅ Port availability and conflicts
- ✅ Container status and health
- ✅ Recent logs and error analysis
- ✅ Common solutions and fixes

### 🛠 Services

The `services/` directory contains startup scripts for various services:

**Unix/Linux/macOS:**
- `audit/start.sh`: Starts the Audit service
- `pptx/start.sh`: Starts the PPTX processor service
- `share/start.sh`: ✅ **Updated** - Starts the Share service with enhanced validation

**Windows:**
- `audit/start.bat`: Starts the Audit service
- `pptx/start.bat`: Starts the PPTX processor service  
- `share/start.bat`: Starts the Share service

**✅ Share Service Improvements:**
- Automatic `SHARE_TOKEN_SECRET` detection and setup
- Enhanced environment validation
- Better error messages with emojis
- Build verification and dependency checks

### 🧪 Tests

The `tests/` directory contains integration test scripts:
- `test-pptx-integration.js`: Tests the PPTX processor integration
- `test-audit-service.js`: Tests the audit service functionality

### 🔧 Utils

The `utils/` directory contains utility scripts:
- `check-audit-env.js`: Validates the environment configuration for the audit service
- `resolve-path.js`: Utility for resolving paths from the project root
- `setup-env.js`: ✅ **Enhanced** - Sets up environment variables with validation

**✅ Setup-Env Improvements:**
- Automatic missing variable detection
- `SHARE_TOKEN_SECRET` support
- Non-destructive updates (preserves existing values)
- Better validation and feedback

## Running Scripts

### 🐳 Docker Manager
```bash
# For Unix/Linux/macOS - Enhanced with validation
node docker-manager.js start

# Check health status
node docker-manager.js health

# Troubleshoot issues
node docker-manager.js troubleshoot

# For Windows
docker-manager.bat start
```

### 🔧 Troubleshooting
```bash
# Comprehensive system check
node scripts/troubleshoot.js

# Quick troubleshoot through docker manager
node docker-manager.js debug
```

### 🛠 Service Scripts
```bash
# For Unix/Linux/macOS - Enhanced share service
./services/share/start.sh   # ✅ Now includes SHARE_TOKEN_SECRET setup

# For Windows
.\services\share\start.bat
```

### 🧪 Test Scripts
```bash
# Run PPTX integration tests
node tests/test-pptx-integration.js

# Run audit service tests
node tests/test-audit-service.js
```

### 🔧 Utility Scripts
```bash
# Enhanced environment setup with validation
node utils/setup-env.js

# Check audit service environment
node utils/check-audit-env.js
```

## 🆘 Troubleshooting Quick Reference

### Common Issues & Solutions:

1. **🔥 Build Failures**
   ```bash
   node scripts/docker-manager.js rebuild
   ```

2. **⚠️ Port Conflicts**
   ```bash
   # Check what's using the ports
   sudo lsof -i :3000
   sudo lsof -i :3001
   sudo lsof -i :4006
   sudo lsof -i :8000
   ```

3. **⚙️ Environment Issues**
   ```bash
   node scripts/docker-manager.js env
   # Then update .env with your Supabase credentials
   ```

4. **🐳 Docker Issues**
   ```bash
   # Linux/macOS
   sudo systemctl start docker
   
   # Or start Docker Desktop
   ```

5. **🔍 Diagnostic Check**
   ```bash
   node scripts/troubleshoot.js
   ```

## 🎯 Key Features

- **🔄 Automatic Validation**: Scripts now validate environment and dependencies
- **🩺 Health Monitoring**: Real-time service health checks
- **🛠 Enhanced Debugging**: Comprehensive troubleshooting with clear solutions
- **📝 Better Logging**: Improved error messages and visual feedback
- **🔧 Auto-repair**: Scripts can automatically fix common configuration issues
- **💚 Bun Compatibility**: All services now work correctly with Bun runtime
- **🔐 Security**: Proper handling of environment variables and secrets

## 🚀 Next Steps

1. **Environment Setup**: Run `node scripts/docker-manager.js env` to create .env file
2. **Update Credentials**: Add your actual Supabase credentials to .env
3. **Start Services**: Run `node scripts/docker-manager.js start` 
4. **Verify Health**: Run `node scripts/docker-manager.js health`
5. **Troubleshoot**: If issues occur, run `node scripts/troubleshoot.js`

All scripts now include enhanced error handling, validation, and user-friendly feedback to ensure a smooth development experience! 🎉 