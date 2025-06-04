/**
 * Simple test script to verify connectivity with the Audit Service
 * Run with: node scripts/test-audit-service.js
 */

const AUDIT_SERVICE_URL = process.env.NEXT_PUBLIC_AUDIT_SERVICE_URL || 'http://localhost:4006';

async function testAuditService() {
  console.log(`Testing connection to Audit Service at: ${AUDIT_SERVICE_URL}`);
  
  try {
    // Test the health endpoint
    const healthResponse = await fetch(`${AUDIT_SERVICE_URL}/health`);
    
    if (healthResponse.ok) {
      console.log('✅ Successfully connected to Audit Service health endpoint');
      console.log(`Status: ${healthResponse.status}`);
      const data = await healthResponse.json();
      console.log('Response:', data);
    } else {
      console.error('❌ Failed to connect to Audit Service health endpoint');
      console.error(`Status: ${healthResponse.status}`);
      console.error('Response:', await healthResponse.text());
    }
    
    // Test API version info
    const apiResponse = await fetch(`${AUDIT_SERVICE_URL}/api/v1/info`);
    
    if (apiResponse.ok) {
      console.log('\n✅ Successfully connected to Audit Service API');
      console.log(`Status: ${apiResponse.status}`);
      const data = await apiResponse.json();
      console.log('API Info:', data);
    } else {
      console.error('\n❌ Failed to connect to Audit Service API');
      console.error(`Status: ${apiResponse.status}`);
      console.error('Response:', await apiResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Error connecting to Audit Service:', error.message);
    console.error('Make sure the Audit Service is running on the specified URL');
  }
}

testAuditService(); 