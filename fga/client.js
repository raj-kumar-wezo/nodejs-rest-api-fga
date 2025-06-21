const { OpenFgaClient, CredentialsMethod } = require('@openfga/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// OpenFGA client instance
let fgaClient = null;

// Create OpenFGA client with proper error handling
const createFgaClient = () => {
  try {
    // Check if OpenFGA credentials are configured
    const storeId = process.env.OPENFGA_STORE_ID;
    const authModelId = process.env.OPENFGA_AUTHORIZATION_MODEL_ID;
    const clientId = process.env.OPENFGA_CLIENT_ID;
    const clientSecret = process.env.OPENFGA_CLIENT_SECRET;
    const apiUrl = process.env.OPENFGA_API_URL;

    // Validate required credentials - check if they exist and are not empty
    if (!storeId || storeId.trim() === '' || 
        !clientId || clientId.trim() === '' || 
        !clientSecret || clientSecret.trim() === '' ||
        !apiUrl || apiUrl.trim() === '') {
      console.log(' OpenFGA credentials not configured, using fallback authorization');
      return null;
    }

    // Create client configuration with correct format
    const clientConfig = {
      apiUrl: apiUrl,
      storeId: storeId,
      credentials: {
        method: CredentialsMethod.ClientCredentials,
        config: {
          apiTokenIssuer: "auth.fga.dev",
          apiAudience: apiUrl + '/',
          clientId: clientId,
          clientSecret: clientSecret,
        },
      },
    };

    // Only add authorizationModelId if it exists and is not empty
    if (authModelId && authModelId.trim() !== '') {
      clientConfig.authorizationModelId = authModelId;
    }

    console.log('Creating OpenFGA client...');
    return new OpenFgaClient(clientConfig);
  } catch (error) {
    console.log(' Failed to create OpenFGA client:', error.message);
    return null;
  }
};

// Load authorization model from file
const loadAuthorizationModel = async () => {
  if (!fgaClient) {
    console.log(' OpenFGA client not available, skipping model loading');
    return null;
  }

  try {
    const modelPath = path.join(__dirname, 'model.fga');
    const modelContent = fs.readFileSync(modelPath, 'utf8');
    
    console.log('Loading OpenFGA authorization model...');
    const { authorization_model } = await fgaClient.writeAuthorizationModel({
      schema_version: "1.1",
      type_definitions: parseFgaModel(modelContent)
    });
    console.log(`Authorization model loaded: ${authorization_model.id}`);
    
    return authorization_model.id;
  } catch (error) {
    console.error('Failed to load authorization model:', error.message);
    return null;
  }
};

// Parse FGA DSL format to JSON format
const parseFgaModel = (dslContent) => {
  // Simple parser for the basic model structure
  const lines = dslContent.split('\n').map(line => line.trim()).filter(line => line);
  const typeDefinitions = [];
  let currentType = null;
  
  for (const line of lines) {
    if (line.startsWith('type ')) {
      if (currentType) {
        typeDefinitions.push(currentType);
      }
      currentType = {
        type: line.replace('type ', '').trim(),
        relations: {}
      };
    } else if (line.startsWith('define ') && currentType) {
      const relationMatch = line.match(/define (\w+): \[([^\]]+)\]/);
      if (relationMatch) {
        const [, relationName, relationTypes] = relationMatch;
        currentType.relations[relationName] = {
          union: {
            child: relationTypes.split(',').map(type => ({
              this: {}
            }))
          }
        };
      }
    }
  }
  
  if (currentType) {
    typeDefinitions.push(currentType);
  }
  
  return typeDefinitions;
};

// Initialize OpenFGA with sample relationships
const initializeFGA = async () => {
  if (!fgaClient) {
    console.log('OpenFGA client not available, skipping initialization');
    return;
  }

  try {
    // Create initial relationships
    const relationships = [
      {
        user: 'user:admin',
        relation: 'can_read_all',
        object: 'users_collection:all'
      },
      {
        user: 'user:admin',
        relation: 'can_create',
        object: 'users_collection:all'
      },
      {
        user: 'user:1',
        relation: 'owner',
        object: 'user:1'
      },
      {
        user: 'user:1',
        relation: 'can_read',
        object: 'user:1'
      },
      {
        user: 'user:1',
        relation: 'can_write',
        object: 'user:1'
      },
      {
        user: 'user:1',
        relation: 'can_delete',
        object: 'user:1'
      }
    ];

    // Use the safe writing utility
    const result = await writeTuplesSafely(relationships);
    console.log(`OpenFGA initialization completed: ${result.success} created, ${result.skipped} already existed, ${result.failed} failed`);
    
    if (result.success > 0) {
      console.log('OpenFGA initialized with sample relationships');
    } else if (result.skipped > 0) {
      console.log('OpenFGA relationships already exist, initialization skipped');
    }
  } catch (error) {
    console.error('Failed to initialize OpenFGA:', error.message);
  }
};

// Test OpenFGA connection
const testConnection = async () => {
  if (!fgaClient) {
    console.log('OpenFGA not available, using fallback authorization');
    return false;
  }

  try {
    await fgaClient.readAuthorizationModels();
    console.log('OpenFGA connection successful');
    return true;
  } catch (error) {
    console.error('OpenFGA connection failed:', error.message);
    return false;
  }
};

// Check if a tuple exists
const checkTupleExists = async (user, relation, object) => {
  if (!fgaClient) return false;
  
  try {
    const { allowed } = await fgaClient.check({
      user,
      relation,
      object
    });
    return allowed;
  } catch (error) {
    console.error('Failed to check tuple existence:', error.message);
    return false;
  }
};

// Write tuples safely (skip if they already exist)
const writeTuplesSafely = async (tuples) => {
  if (!fgaClient) {
    console.log('OpenFGA client not available, skipping tuple writes');
    return { success: 0, skipped: 0, failed: 0 };
  }

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const tuple of tuples) {
    try {
      await fgaClient.write({
        writes: [tuple]
      });
      successCount++;
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        skippedCount++;
      } else {
        console.error(`Failed to write tuple ${JSON.stringify(tuple)}:`, error.message);
        failedCount++;
      }
    }
  }

  return { success: successCount, skipped: skippedCount, failed: failedCount };
};

// Get or create client instance
const getFgaClient = () => {
  if (!fgaClient) {
    fgaClient = createFgaClient();
  }
  return fgaClient;
};

// Initialize client on module load - but don't log errors during initialization
const initializeClient = () => {
  try {
    fgaClient = createFgaClient();
  } catch (error) {
    // Silently fail during initialization
    fgaClient = null;
  }
};

// Initialize client
initializeClient();

module.exports = {
  getFgaClient,
  fgaClient: () => getFgaClient(),
  loadAuthorizationModel,
  initializeFGA,
  testConnection,
  checkTupleExists,
  writeTuplesSafely
}; 