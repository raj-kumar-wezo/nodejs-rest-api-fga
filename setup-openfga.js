const axios = require('axios');
const fs = require('fs');
const path = require('path');

// OpenFGA Cloud configuration
const OPENFGA_URL = 'https://api.fga.example'; // This will be replaced with actual cloud URL

// Helper function to make OpenFGA API requests
async function makeOpenFGARequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${OPENFGA_URL}${endpoint}`,     
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

// Setup OpenFGA for the application
async function setupOpenFGA() {
  console.log('Setting up OpenFGA for Node.js REST API...\n');
  console.log('Since OpenFGA server is not running locally, we will:');
  console.log('1. Create a mock setup for development');
  console.log('2. Provide instructions for OpenFGA Cloud setup\n');

  // For development purposes, create mock credentials
  const mockStoreId = 'mock-store-' + Date.now();
  const mockModelId = 'mock-model-' + Date.now();
  const mockClientId = 'mock-client-id';
  const mockClientSecret = 'mock-client-secret';

  console.log('Using development/mock credentials:');
  console.log(`   Store ID: ${mockStoreId}`);
  console.log(`   Model ID: ${mockModelId}`);
  console.log(`   Client ID: ${mockClientId}`);
  console.log(`   Client Secret: ${mockClientSecret}\n`);

  // Step 4: Update .env file
  console.log('4. Updating .env file...');
  const envPath = path.join(__dirname, '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else {
    // Create from example
    const examplePath = path.join(__dirname, 'env.example');
    envContent = fs.readFileSync(examplePath, 'utf8');
  }

  // Update OpenFGA configuration with mock values for development
  const updatedEnvContent = envContent
    .replace(/OPENFGA_API_URL=.*/g, `OPENFGA_API_URL=http://localhost:8080`)
    .replace(/OPENFGA_STORE_ID=.*/g, `OPENFGA_STORE_ID=${mockStoreId}`)
    .replace(/OPENFGA_AUTHORIZATION_MODEL_ID=.*/g, `OPENFGA_AUTHORIZATION_MODEL_ID=${mockModelId}`)
    .replace(/OPENFGA_CLIENT_ID=.*/g, `OPENFGA_CLIENT_ID=${mockClientId}`)
    .replace(/OPENFGA_CLIENT_SECRET=.*/g, `OPENFGA_CLIENT_SECRET=${mockClientSecret}`);

  fs.writeFileSync(envPath, updatedEnvContent);
  console.log('.env file updated successfully\n');

  console.log('Development setup completed!');
  console.log('\nNext Steps:');
  console.log('1. Your API will run with fallback authorization (no OpenFGA)');
  console.log('2. To use real OpenFGA, you have these options:');
  console.log('\n   Option A: OpenFGA Cloud (Recommended for assessment)');
  console.log('   - Go to https://fga.dev');
  console.log('   - Create a free account');
  console.log('   - Create a store and get your credentials');
  console.log('   - Update your .env file with real credentials');
  console.log('\n   Option B: Local OpenFGA with Docker');
  console.log('   - Install Docker Desktop');
  console.log('   - Run: docker run -p 8080:8080 openfga/openfga run');
  console.log('   - Then run this setup script again');
    console.log('\nYou can now start your Node.js application with:');
  console.log('   npm start');
  console.log('\nYour API will work with fallback authorization rules!');
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupOpenFGA().catch(console.error);
}

module.exports = { setupOpenFGA }; 