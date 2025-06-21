const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import database and OpenFGA modules
const { testConnection, initializeDatabase } = require('./db');
const { testConnection: testFGA, loadAuthorizationModel, initializeFGA } = require('./fga/client');

// Import routes
const usersRoutes = require('./routes/users');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/users', usersRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Node.js RESTful API with MySQL and OpenFGA',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      users: {
        getAll: 'GET /api/users',
        getById: 'GET /api/users/:id',
        create: 'POST /api/users',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id'
      }
    },
    authorization: {
      note: 'Use X-User-ID header to specify the requesting user',
      examples: {
        admin: 'X-User-ID: admin',
        user1: 'X-User-ID: 1',
        user2: 'X-User-ID: 2'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'Something went wrong on the server'
  });
});

// Initialize application
const initializeApp = async () => {
  try {
    console.log('Initializing Node.js RESTful API...\n');

    // Test database connection
    const dbAvailable = await testConnection();
    
    // Initialize database tables only if connection is available
    if (dbAvailable) {
      await initializeDatabase();
    } else {
      console.log('Database not available, using in-memory storage');
    }
    
    // Test OpenFGA connection
    const fgaAvailable = await testFGA();
    
    if (fgaAvailable) {
      console.log('OpenFGA authorization is enabled and connected.');
      // NOTE: Model and relationships should be managed via dashboard or a dedicated script.
      // The lines below are commented out to prevent re-uploading on every server start.
      // await loadAuthorizationModel();
      await initializeFGA();
    } else {
      console.log('OpenFGA not configured, using fallback authorization rules');
      console.log('   - Admin user has full access');
      console.log('   - Users can access their own records');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`\nServer is running on port ${PORT}`);
      console.log(`📡 API Base URL: http://localhost:${PORT}`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/`);
      console.log('\nReady to handle requests!');
      
      if (!fgaAvailable) {
        console.log('\nTo enable OpenFGA authorization:');
        console.log('   3. Run: npm run setup');
      }
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the application
initializeApp(); 