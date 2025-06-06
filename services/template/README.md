# Service Template

This is a template for creating new services in the PowerPoint Translator application.

## Directory Structure

```
service-name/
├── src/                # Source code
│   ├── api/           # API endpoints
│   ├── config/        # Configuration
│   ├── models/        # Data models
│   ├── services/      # Business logic
│   └── utils/         # Utilities
├── tests/             # Test files
├── .env.example       # Example environment variables
├── package.json       # Dependencies and scripts
└── README.md          # This file
```

## Getting Started

1. Copy this template:
   ```bash
   cp -r template service-name
   ```

2. Update the service name and description in `package.json`

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start development:
   ```bash
   npm run dev
   ```

## Development

- Follow the established patterns in other services
- Use TypeScript for type safety
- Write tests for new features
- Document API endpoints
- Update the main services README

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Deployment

1. Build the service:
   ```bash
   npm run build
   ```

2. Start the service:
   ```bash
   npm start
   ```

## Documentation

- Keep this README up to date
- Document API endpoints
- Add integration guides
- Update the main services README 