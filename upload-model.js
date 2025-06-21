const { OpenFgaClient, CredentialsMethod } = require('@openfga/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function uploadModel() {
  try {
    // Get credentials from environment
    const apiUrl = process.env.OPENFGA_API_URL;
    const storeId = process.env.OPENFGA_STORE_ID;
    const clientId = process.env.OPENFGA_CLIENT_ID;
    const clientSecret = process.env.OPENFGA_CLIENT_SECRET;

    if (!apiUrl || !storeId || !clientId || !clientSecret) {
      console.error('Missing OpenFGA credentials in .env file');
      return;
    }

    // Create client
    const fgaClient = new OpenFgaClient({
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
    });

    // Read and parse the model
    const modelPath = path.join(__dirname, 'fga', 'model.fga');
    const modelContent = fs.readFileSync(modelPath, 'utf8');
    
    console.log('Uploading OpenFGA model...');
    console.log('Model content:');
    console.log(modelContent);
    
    // Parse FGA DSL to JSON format
    const parseFgaModel = (dslContent) => {
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

    const model = {
      schema_version: "1.1",
      type_definitions: parseFgaModel(modelContent)
    };
    
    // Upload the model
    const { authorization_model } = await fgaClient.writeAuthorizationModel(model);
    
    console.log(`✅ Model uploaded successfully!`);
    console.log(`Model ID: ${authorization_model.id}`);
    
    // Update .env file with the new model ID
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    const updatedEnvContent = envContent.replace(
      /OPENFGA_AUTHORIZATION_MODEL_ID=.*/g,
      `OPENFGA_AUTHORIZATION_MODEL_ID=${authorization_model.id}`
    );
    
    fs.writeFileSync(envPath, updatedEnvContent);
    console.log('✅ Updated .env file with new model ID');
    
    // Initialize with sample relationships
    console.log('Creating sample relationships...');
    const relationships = [
      {
        user: 'user:admin',
        relation: 'admin',
        object: 'users_collection:all'
      },
      {
        user: 'user:admin',
        relation: 'can_read_all',
        object: 'users_collection:all'
      },
      {
        user: 'user:admin',
        relation: 'can_create',
        object: 'users_collection:all'
      }
    ];

    await fgaClient.write({
      writes: {
        tuple_keys: relationships
      }
    });

    console.log('✅ Sample relationships created');
    console.log('\n🎯 Your OpenFGA is now ready! Restart your server:');
    console.log('   npm start');

  } catch (error) {
    console.error('❌ Failed to upload model:', error.message);
  }
}

uploadModel(); 