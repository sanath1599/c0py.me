const fs = require('fs');
const path = require('path');

console.log('🚀 ShareDrop Monorepo Setup Script');
console.log('==================================\n');

// Check if .env files exist
const rootEnvPath = path.join(__dirname, '.env');
const webEnvPath = path.join(__dirname, 'apps', 'web', '.env');
const apiEnvPath = path.join(__dirname, 'apps', 'api', '.env');

// Create root .env if it doesn't exist
if (!fs.existsSync(rootEnvPath)) {
  const rootEnvContent = `PORT=5000
MONGODB_URI=mongodb://localhost:27017/sharedrop
CLIENT_URL=http://localhost:3000
NODE_ENV=development`;
  
  fs.writeFileSync(rootEnvPath, rootEnvContent);
  console.log('✅ Created .env file in root directory');
} else {
  console.log('✅ Root .env file already exists');
}

// Create web app .env if it doesn't exist
if (!fs.existsSync(webEnvPath)) {
  const webEnvContent = `REACT_APP_SERVER_URL=http://localhost:5000
REACT_APP_WEBSOCKET_URL=ws://localhost:5000`;
  
  fs.writeFileSync(webEnvPath, webEnvContent);
  console.log('✅ Created .env file in apps/web directory');
} else {
  console.log('✅ Web app .env file already exists');
}

// Create API app .env if it doesn't exist
if (!fs.existsSync(apiEnvPath)) {
  const apiEnvContent = `PORT=5000
MONGODB_URI=mongodb://localhost:27017/sharedrop
CLIENT_URL=http://localhost:3000
NODE_ENV=development`;
  
  fs.writeFileSync(apiEnvPath, apiEnvContent);
  console.log('✅ Created .env file in apps/api directory');
} else {
  console.log('✅ API app .env file already exists');
}

console.log('\n📋 Next Steps:');
console.log('1. Make sure MongoDB is running on your system');
console.log('2. Run "pnpm dev" to start both server and client');
console.log('3. Open http://localhost:3000 in your browser');
console.log('\n🔧 Available Commands:');
console.log('- pnpm dev          # Start all applications in development mode');
console.log('- pnpm build        # Build all applications');
console.log('- pnpm lint         # Lint all applications');
console.log('- pnpm test         # Run tests across all applications');
console.log('- pnpm clean        # Clean all build artifacts');
console.log('\n🎉 Monorepo setup complete!'); 