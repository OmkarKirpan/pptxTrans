# Scripts Directory

This directory contains various utility scripts for managing services, running tests, and performing environment checks.

## Directory Structure

```
scripts/
├── services/           # Service startup scripts
│   ├── start-pptx-processor.*    # PPTX processor service scripts
│   └── start-audit-service.*     # Audit service scripts
├── tests/             # Integration and test scripts
│   ├── test-pptx-integration.js  # PPTX processor integration tests
│   └── test-audit-service.js     # Audit service tests
└── utils/             # Utility scripts
    └── check-audit-env.js        # Environment validation script
```

## Usage

### Services

The `services/` directory contains startup scripts for various services:
- `start-pptx-processor.sh/bat`: Starts the PPTX processor service
- `start-audit-service.sh/bat`: Starts the audit service

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
./services/start-pptx-processor.sh
./services/start-audit-service.sh

# For Windows
.\services\start-pptx-processor.bat
.\services\start-audit-service.bat
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