# Scripts Directory

This directory contains various utility scripts for managing services, running tests, and performing environment checks.

## Directory Structure

```
scripts/
├── docker-manager.js        # Docker management script (Node.js)
├── docker-manager.bat       # Docker management script (Windows)
├── services/                # Service startup scripts
│   ├── audit/               # Audit service scripts (start.sh, start.bat)
│   ├── pptx/                # PPTX processor service scripts (start.sh, start.bat)
│   └── share/               # Share service scripts (start.sh, start.bat)
├── tests/                   # Integration and test scripts
│   ├── test-pptx-integration.js  # PPTX processor integration tests
│   └── test-audit-service.js     # Audit service tests
└── utils/                   # Utility scripts
    ├── check-audit-env.js   # Environment validation script
    ├── resolve-path.js      # Path resolution utility
    └── setup-env.js         # Environment setup utility
```

## Usage

### Docker Manager

The Docker manager script provides commands for managing Docker operations:

**Unix/Linux/macOS (Node.js):**
```bash
# Start all services
node docker-manager.js start

# Stop all services
node docker-manager.js stop

# Other commands: restart, rebuild, logs, ps, shell, env, help
```

**Windows:**
```cmd
# Start all services
docker-manager.bat start

# Stop all services
docker-manager.bat stop

# Other commands: restart, rebuild, logs, ps, shell, env, help
```

### Services

The `services/` directory contains startup scripts for various services:

**Unix/Linux/macOS:**
- `audit/start.sh`: Starts the Audit service
- `pptx/start.sh`: Starts the PPTX processor service
- `share/start.sh`: Starts the Share service

**Windows:**
- `audit/start.bat`: Starts the Audit service
- `pptx/start.bat`: Starts the PPTX processor service
- `share/start.bat`: Starts the Share service

**All service scripts now use path resolution to locate the services correctly regardless of where the script is run from.**

**All service scripts check for an existing `.env` file before creating one.** If the file exists, it will not be overwritten, preserving your custom configuration.

**PPTX processor service scripts use [uv](https://github.com/astral-sh/uv) for Python environment and package management.**
- The script will check for `uv` and prompt you to install it if missing.
- It will create a `.venv` virtual environment if needed, install dependencies with `uv pip install`, and run the service with `uv python -m app.main`.

### Tests

The `tests/` directory contains integration test scripts:
- `test-pptx-integration.js`: Tests the PPTX processor integration
- `test-audit-service.js`: Tests the audit service functionality

### Utils

The `utils/` directory contains utility scripts:
- `check-audit-env.js`: Validates the environment configuration for the audit service
- `resolve-path.js`: Utility for resolving paths from the project root
- `setup-env.js`: Sets up environment variables in a `.env` file

## Running Scripts

### Docker Manager
```bash
# For Unix/Linux/macOS
node docker-manager.js start

# For Windows
docker-manager.bat start
```

### Service Scripts
```bash
# For Unix/Linux/macOS
./services/audit/start.sh
./services/pptx/start.sh
./services/share/start.sh

# For Windows
.\services\audit\start.bat
.\services\pptx\start.bat
.\services\share\start.bat
```

### Test Scripts
```bash
# Run PPTX integration tests
node tests/test-pptx-integration.js

# Run audit service tests
node tests/test-audit-service.js
```

### Utility Scripts
```bash
# Check audit service environment
node utils/check-audit-env.js

# Set up environment variables
node utils/setup-env.js
``` 