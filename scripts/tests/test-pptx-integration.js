#!/usr/bin/env node

/**
 * Test script for PPTX processor integration
 * 
 * This script tests:
 * 1. PPTX Processor service availability
 * 2. Supabase storage upload
 * 3. PPTX processing flow
 * 
 * Usage:
 *   node scripts/test-pptx-integration.js
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const FormData = require('form-data');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const PPTX_PROCESSOR_URL = process.env.NEXT_PUBLIC_PPTX_PROCESSOR_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_FILE_PATH = path.join(__dirname, '../test-data/sample.pptx');
const TEST_USER_ID = 'test-user-123';

// Create Supabase client
let supabase;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Test the PPTX processor health
 */
async function testPptxProcessorHealth() {
  console.log(`${colors.blue}Testing PPTX Processor service availability...${colors.reset}`);
  
  try {
    const response = await fetch(`${PPTX_PROCESSOR_URL}/api/health`);
    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✓ PPTX Processor service is running:${colors.reset}`, data.status);
      return true;
    } else {
      console.log(`${colors.red}✗ PPTX Processor service health check failed:${colors.reset}`, response.statusText);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ PPTX Processor service is not available:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * Test file upload to Supabase storage
 */
async function testSupabaseUpload() {
  console.log(`${colors.blue}Testing Supabase storage upload...${colors.reset}`);
  
  if (!supabase) {
    console.log(`${colors.red}✗ Supabase client not available. Check your environment variables.${colors.reset}`);
    return null;
  }
  
  if (!fs.existsSync(TEST_FILE_PATH)) {
    console.log(`${colors.red}✗ Test file not found:${colors.reset}`, TEST_FILE_PATH);
    console.log(`${colors.yellow}  Create a test file at ${TEST_FILE_PATH} to continue${colors.reset}`);
    
    // Create test-data directory if it doesn't exist
    const testDataDir = path.join(__dirname, '../test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir);
      console.log(`${colors.yellow}  Created test-data directory${colors.reset}`);
    }
    return null;
  }
  
  try {
    const fileContent = fs.readFileSync(TEST_FILE_PATH);
    const fileName = path.basename(TEST_FILE_PATH);
    const timestamp = new Date().getTime();
    const uniqueFilename = `${timestamp}_${fileName}`;
    const filePath = `uploads/${TEST_USER_ID}/${uniqueFilename}`;
    
    // Check if the bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const pptxBucketExists = buckets.some(bucket => bucket.name === 'pptx-files');
    
    if (!pptxBucketExists) {
      console.log(`${colors.yellow}! 'pptx-files' bucket doesn't exist. Attempting to create it...${colors.reset}`);
      
      const { error: bucketError } = await supabase.storage.createBucket('pptx-files', {
        public: true
      });
      
      if (bucketError) {
        console.log(`${colors.red}✗ Failed to create bucket:${colors.reset}`, bucketError.message);
        return null;
      } else {
        console.log(`${colors.green}✓ Created 'pptx-files' bucket${colors.reset}`);
      }
    }
    
    // Upload file
    const { data, error } = await supabase.storage
      .from('pptx-files')
      .upload(filePath, fileContent, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.log(`${colors.red}✗ File upload failed:${colors.reset}`, error.message);
      return null;
    }
    
    // Get public URL
    const publicUrl = supabase.storage
      .from('pptx-files')
      .getPublicUrl(filePath);
    
    console.log(`${colors.green}✓ File uploaded successfully:${colors.reset}`, filePath);
    console.log(`${colors.green}  Public URL:${colors.reset}`, publicUrl.data.publicUrl);
    
    return {
      path: filePath,
      publicUrl: publicUrl.data.publicUrl
    };
  } catch (error) {
    console.log(`${colors.red}✗ File upload failed:${colors.reset}`, error.message);
    return null;
  }
}

/**
 * Test PPTX processing
 */
async function testPptxProcessing(filePath) {
  console.log(`${colors.blue}Testing PPTX processing...${colors.reset}`);
  
  if (!filePath) {
    console.log(`${colors.red}✗ No file path provided for processing${colors.reset}`);
    return null;
  }
  
  try {
    // Create test session in Supabase
    const sessionPayload = {
      name: 'Test Session',
      user_id: TEST_USER_ID,
      source_language: 'en',
      target_language: 'fr',
      status: 'draft',
      progress: 0,
      slide_count: 0,
      original_file_path: filePath
    };
    
    const { data: session, error: sessionError } = await supabase
      .from('translation_sessions')
      .insert(sessionPayload)
      .select()
      .single();
    
    if (sessionError) {
      console.log(`${colors.red}✗ Failed to create test session:${colors.reset}`, sessionError.message);
      return null;
    }
    
    console.log(`${colors.green}✓ Created test session:${colors.reset}`, session.id);
    
    // Read the test file
    const fileContent = fs.readFileSync(TEST_FILE_PATH);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileContent, path.basename(TEST_FILE_PATH));
    formData.append('session_id', session.id);
    formData.append('source_language', 'en');
    formData.append('target_language', 'fr');
    formData.append('generate_thumbnails', 'true');
    
    // Call PPTX processor API
    const response = await fetch(`${PPTX_PROCESSOR_URL}/api/process`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.log(`${colors.red}✗ PPTX processing failed:${colors.reset}`, errorData.detail || response.statusText);
      return null;
    }
    
    const processingData = await response.json();
    console.log(`${colors.green}✓ PPTX processing started:${colors.reset}`, {
      job_id: processingData.job_id,
      status: processingData.status
    });
    
    // Check processing status a few times
    console.log(`${colors.blue}Checking processing status...${colors.reset}`);
    let status = processingData.status;
    let attempts = 0;
    
    while (status !== 'completed' && status !== 'failed' && attempts < 5) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const statusResponse = await fetch(`${PPTX_PROCESSOR_URL}/api/status/${processingData.job_id}`);
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        status = statusData.status;
        console.log(`${colors.cyan}  Status check ${attempts}:${colors.reset}`, {
          status: statusData.status,
          progress: statusData.progress,
          stage: statusData.current_stage
        });
      } else {
        console.log(`${colors.yellow}! Failed to check status:${colors.reset}`, response.statusText);
      }
    }
    
    if (status === 'completed') {
      console.log(`${colors.green}✓ PPTX processing completed successfully!${colors.reset}`);
      
      // Try to get results
      try {
        const resultsResponse = await fetch(`${PPTX_PROCESSOR_URL}/api/results/${session.id}`);
        
        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          console.log(`${colors.green}✓ Retrieved processing results:${colors.reset}`, {
            slide_count: resultsData.slide_count,
            first_slide: resultsData.slides[0]?.svg_url || 'No slides'
          });
        } else {
          console.log(`${colors.yellow}! Failed to retrieve results:${colors.reset}`, resultsResponse.statusText);
        }
      } catch (error) {
        console.log(`${colors.yellow}! Failed to retrieve results:${colors.reset}`, error.message);
      }
    } else if (status === 'failed') {
      console.log(`${colors.red}✗ PPTX processing failed${colors.reset}`);
    } else {
      console.log(`${colors.yellow}! PPTX processing still in progress after ${attempts} checks${colors.reset}`);
    }
    
    return {
      sessionId: session.id,
      jobId: processingData.job_id,
      status
    };
  } catch (error) {
    console.log(`${colors.red}✗ Error during PPTX processing:${colors.reset}`, error.message);
    return null;
  }
}

/**
 * Main execution function
 */
async function runTests() {
  console.log(`${colors.magenta}=== PPTX Integration Test ====${colors.reset}`);
  
  // Environment check
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log(`${colors.red}✗ Supabase environment variables not set.${colors.reset}`);
    console.log(`${colors.yellow}  Make sure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local${colors.reset}`);
    return;
  }
  
  if (!PPTX_PROCESSOR_URL) {
    console.log(`${colors.red}✗ PPTX processor URL not set.${colors.reset}`);
    console.log(`${colors.yellow}  Make sure you have NEXT_PUBLIC_PPTX_PROCESSOR_URL in .env.local${colors.reset}`);
    return;
  }
  
  // Test PPTX processor availability
  const processorAvailable = await testPptxProcessorHealth();
  if (!processorAvailable) {
    console.log(`${colors.yellow}! Skipping further tests due to unavailable PPTX processor service${colors.reset}`);
    return;
  }
  
  // Test Supabase storage upload
  const uploadResult = await testSupabaseUpload();
  if (!uploadResult) {
    console.log(`${colors.yellow}! Skipping PPTX processing test due to upload failure${colors.reset}`);
    return;
  }
  
  // Test PPTX processing
  await testPptxProcessing(uploadResult.path);
  
  console.log(`${colors.magenta}=== Test Completed ====${colors.reset}`);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
}); 