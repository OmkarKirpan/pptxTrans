# Scripts Directory

This directory contains various utility scripts for managing services, running tests, and performing environment checks.

## Directory Structure

```
scripts/
├── services/           # Service startup scripts
│   ├── audit/          # Audit service scripts (start.sh, start.bat)
│   ├── pptx/           # PPTX processor service scripts (start.sh, start.bat)
│   └── share/          # Share service scripts (start.sh, start.bat)
├── tests/              # Integration and test scripts
│   ├── test-pptx-integration.js  # PPTX processor integration tests
│   └── test-audit-service.js     # Audit service tests
└── utils/              # Utility scripts
    └── check-audit-env.js        # Environment validation script
```

## Usage

### Services

The `services/` directory contains startup scripts for various services:
- `audit/start.sh` / `audit/start.bat`: Starts the Audit service
- `pptx/start.sh` / `pptx/start.bat`: Starts the PPTX processor service
- `share/start.sh` / `share/start.bat`: Starts the Share service

**All service scripts now check for an existing `.env` file before creating one.** If the file exists, it will not be overwritten, preserving your custom configuration.

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

## Running Scripts

### Service Scripts
```bash
# For Unix-like systems
./services/audit/start.sh
./services/pptx/start.sh
./services/share/start.sh

# For Windows
./services/audit/start.bat
./services/pptx/start.bat
./services/share/start.bat
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
``` 