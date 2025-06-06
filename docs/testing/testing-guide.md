# Testing Guide

Comprehensive testing strategies and practices for the PowerPoint Translator App.

## Testing Philosophy

Our testing approach follows the testing pyramid:
- **Unit Tests**: Fast, isolated tests for individual functions/components
- **Integration Tests**: Test service interactions and API endpoints
- **End-to-End Tests**: Full user workflow testing

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── frontend/           # React components, hooks, utilities
│   ├── services/           # Service logic tests
│   └── shared/             # Shared utility tests
├── integration/            # Integration tests
│   ├── api/               # API endpoint tests
│   ├── database/          # Database operation tests
│   └── services/          # Service-to-service tests
├── e2e/                   # End-to-end tests
│   ├── user-flows/        # Complete user journeys
│   └── scenarios/         # Specific test scenarios
└── fixtures/              # Test data and mocks
    ├── pptx-files/        # Sample PPTX files
    ├── mock-data/         # Mock API responses
    └── test-sessions/     # Test session data
```

## Frontend Testing

### Unit Testing with Jest and React Testing Library

#### Setup

```bash
# Install testing dependencies
bun add -d @testing-library/react @testing-library/jest-dom @testing-library/user-event
bun add -d jest jest-environment-jsdom
```

#### Component Testing

```typescript
// components/__tests__/upload-wizard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadWizard } from '../upload-wizard';

describe('UploadWizard', () => {
  it('should upload file and create session', async () => {
    const user = userEvent.setup();
    const mockOnComplete = jest.fn();
    
    render(<UploadWizard onComplete={mockOnComplete} />);
    
    // Test file upload
    const fileInput = screen.getByLabelText(/upload file/i);
    const file = new File(['test'], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    
    await user.upload(fileInput, file);
    
    // Test form submission
    const submitButton = screen.getByRole('button', { name: /create session/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: expect.any(String),
        fileName: 'test.pptx'
      }));
    });
  });
});
```

#### Hook Testing

```typescript
// hooks/__tests__/use-audit-log.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAuditLog } from '../use-audit-log';

describe('useAuditLog', () => {
  it('should create audit events', async () => {
    const { result } = renderHook(() => useAuditLog('test-session'));
    
    await act(async () => {
      await result.current.createAuditEvent('edit', {
        slideId: 'slide-1',
        change: 'text update'
      });
    });
    
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toMatchObject({
      type: 'edit',
      details: expect.objectContaining({
        slideId: 'slide-1'
      })
    });
  });
});
```

### Integration Testing

#### API Route Testing

```typescript
// app/api/__tests__/process-pptx.test.ts
import { POST } from '../process-pptx/route';
import { NextRequest } from 'next/server';

describe('/api/process-pptx', () => {
  it('should process PPTX file', async () => {
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.pptx'));
    formData.append('sessionId', 'test-session-123');
    
    const request = new NextRequest('http://localhost:3000/api/process-pptx', {
      method: 'POST',
      body: formData
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      jobId: expect.any(String),
      sessionId: 'test-session-123',
      status: 'queued'
    });
  });
});
```

## Service Testing

### PPTX Processor Testing

#### Unit Tests

```python
# services/pptx-processor/tests/unit/test_processor.py
import pytest
from app.services.pptx_processor import PptxProcessor
from app.models.presentation import Presentation

class TestPptxProcessor:
    def test_extract_slides(self):
        processor = PptxProcessor()
        
        # Use test PPTX file
        with open('tests/fixtures/sample.pptx', 'rb') as f:
            result = processor.extract_slides(f)
        
        assert isinstance(result, Presentation)
        assert len(result.slides) > 0
        assert result.slides[0].slide_number == 1
    
    def test_generate_svg(self):
        processor = PptxProcessor()
        
        # Test SVG generation
        svg_content = processor.generate_svg('tests/fixtures/sample.pptx', slide_number=1)
        
        assert svg_content.startswith('<svg')
        assert 'width=' in svg_content
        assert 'height=' in svg_content
```

#### Integration Tests

```python
# services/pptx-processor/tests/integration/test_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestPptxProcessorAPI:
    def test_process_endpoint(self):
        with open('tests/fixtures/sample.pptx', 'rb') as f:
            response = client.post(
                '/v1/process',
                files={'file': ('sample.pptx', f, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')},
                data={'sessionId': 'test-session-123'}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert 'jobId' in data
        assert data['sessionId'] == 'test-session-123'
    
    def test_status_endpoint(self):
        # First create a job
        with open('tests/fixtures/sample.pptx', 'rb') as f:
            process_response = client.post(
                '/v1/process',
                files={'file': ('sample.pptx', f, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')},
                data={'sessionId': 'test-session-123'}
            )
        
        job_id = process_response.json()['jobId']
        
        # Check status
        status_response = client.get(f'/v1/status/{job_id}')
        assert status_response.status_code == 200
        
        status_data = status_response.json()
        assert status_data['jobId'] == job_id
        assert 'status' in status_data
```

### Audit Service Testing

#### Unit Tests

```go
// services/audit-service/tests/handlers_test.go
package tests

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    
    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
    
    "your-project/internal/handlers"
    "your-project/internal/domain"
)

func TestCreateEvent(t *testing.T) {
    gin.SetMode(gin.TestMode)
    
    // Setup test router
    router := gin.New()
    handler := handlers.NewEventHandler(mockEventService{})
    router.POST("/api/v1/events", handler.CreateEvent)
    
    // Test data
    event := domain.AuditEvent{
        SessionID: "test-session",
        Type:      "edit",
        Details: map[string]interface{}{
            "slideId": "slide-1",
            "change":  "text update",
        },
    }
    
    jsonData, _ := json.Marshal(event)
    
    // Make request
    req, _ := http.NewRequest("POST", "/api/v1/events", bytes.NewBuffer(jsonData))
    req.Header.Set("Content-Type", "application/json")
    
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    // Assertions
    assert.Equal(t, http.StatusCreated, w.Code)
    
    var response map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &response)
    assert.Equal(t, "test-session", response["sessionId"])
}
```

#### Integration Tests

```go
// services/audit-service/tests/integration_test.go
package tests

import (
    "testing"
    "time"
    
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/suite"
    
    "your-project/internal/repository"
    "your-project/internal/service"
)

type IntegrationTestSuite struct {
    suite.Suite
    eventService *service.EventService
    cleanup      func()
}

func (suite *IntegrationTestSuite) SetupSuite() {
    // Setup test database
    repo, cleanup := setupTestDB()
    suite.eventService = service.NewEventService(repo)
    suite.cleanup = cleanup
}

func (suite *IntegrationTestSuite) TearDownSuite() {
    suite.cleanup()
}

func (suite *IntegrationTestSuite) TestEventLifecycle() {
    // Create event
    event := &domain.AuditEvent{
        SessionID: "test-session",
        Type:      "edit",
        UserID:    "user-123",
        Details:   map[string]interface{}{"test": "data"},
    }
    
    createdEvent, err := suite.eventService.CreateEvent(event)
    assert.NoError(suite.T(), err)
    assert.NotEmpty(suite.T(), createdEvent.ID)
    
    // Retrieve events
    events, err := suite.eventService.GetEventsBySession("test-session", 1, 10)
    assert.NoError(suite.T(), err)
    assert.Len(suite.T(), events, 1)
    assert.Equal(suite.T(), createdEvent.ID, events[0].ID)
}

func TestIntegrationSuite(t *testing.T) {
    suite.Run(t, new(IntegrationTestSuite))
}
```

## End-to-End Testing

### Playwright Setup

```bash
# Install Playwright
bun add -d @playwright/test
bunx playwright install
```

#### E2E Test Example

```typescript
// tests/e2e/upload-and-translate.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Upload and Translation Flow', () => {
  test('should upload PPTX and complete translation', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');
    
    // Login
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-login"]');
    
    // Upload file
    await page.click('[data-testid="new-session-button"]');
    
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles('tests/fixtures/sample.pptx');
    
    await page.fill('[data-testid="session-name"]', 'Test Session');
    await page.selectOption('[data-testid="source-language"]', 'en');
    await page.selectOption('[data-testid="target-language"]', 'es');
    
    await page.click('[data-testid="create-session"]');
    
    // Wait for processing
    await expect(page.locator('[data-testid="processing-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor-view"]')).toBeVisible({ timeout: 30000 });
    
    // Verify slides loaded
    const slides = page.locator('[data-testid="slide-thumbnail"]');
    await expect(slides).toHaveCount.greaterThan(0);
    
    // Test translation
    await page.click('[data-testid="slide-thumbnail"]:first-child');
    await page.click('[data-testid="text-element"]:first-child');
    
    const translationInput = page.locator('[data-testid="translation-input"]');
    await translationInput.fill('Texto traducido');
    await page.click('[data-testid="save-translation"]');
    
    // Verify translation saved
    await expect(page.locator('[data-testid="translation-status"]')).toContainText('Saved');
  });
});
```

## Test Data Management

### Fixtures

```typescript
// tests/fixtures/test-data.ts
export const mockSession = {
  id: 'test-session-123',
  name: 'Test Session',
  sourceLanguage: 'en',
  targetLanguage: 'es',
  status: 'ready',
  slideCount: 3
};

export const mockSlides = [
  {
    id: 'slide-1',
    sessionId: 'test-session-123',
    slideNumber: 1,
    svgUrl: '/test-slides/slide-1.svg'
  },
  // ... more slides
];

export const mockTextElements = [
  {
    id: 'element-1',
    slideId: 'slide-1',
    originalText: 'Hello World',
    translatedText: 'Hola Mundo',
    position: { x: 100, y: 200, width: 300, height: 50 }
  },
  // ... more elements
];
```

### Database Seeding

```typescript
// tests/helpers/seed-database.ts
import { createClient } from '@supabase/supabase-js';

export async function seedTestDatabase() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Clean existing test data
  await supabase.from('text_elements').delete().like('slide_id', 'test-%');
  await supabase.from('slides').delete().like('session_id', 'test-%');
  await supabase.from('sessions').delete().like('id', 'test-%');
  
  // Insert test data
  await supabase.from('sessions').insert(mockSession);
  await supabase.from('slides').insert(mockSlides);
  await supabase.from('text_elements').insert(mockTextElements);
}
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'bun dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Running Tests

### Development

```bash
# Run all tests
bun test

# Run specific test suites
bun test:unit
bun test:integration
bun test:e2e

# Run with coverage
bun test:coverage

# Watch mode
bun test:watch
```

For detailed testing examples and configurations, see:
- [Test Session Usage](./test-sessions.md) - Using test sessions for development
- [API Testing](./api-testing.md) - Testing service APIs
- [Integration Testing](./integration.md) - End-to-end testing

## Test Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Mock Strategy
- Mock external dependencies
- Use test doubles for complex integrations
- Keep mocks simple and focused

### 3. Data Management
- Use factories for test data generation
- Clean up test data after each test
- Use isolated test databases

### 4. Performance
- Run unit tests frequently
- Run integration tests on commits
- Run E2E tests on releases

### 5. Maintenance
- Update tests with code changes
- Remove obsolete tests
- Keep test dependencies updated

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install dependencies
        run: bun install
        
      - name: Run unit tests
        run: bun test:unit
        
      - name: Run integration tests
        run: bun test:integration
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          
      - name: Run E2E tests
        run: bunx playwright test
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

This comprehensive testing guide ensures robust quality assurance across all components of the PowerPoint Translator App. 