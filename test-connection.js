const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing ShareDrop Connection...\n');
  
  try {
    // Test MongoDB connection
    console.log('📊 Testing MongoDB connection...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sharedrop', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connection successful');
    
    // Test server health endpoint
    console.log('\n🌐 Testing server health endpoint...');
    const response = await fetch('http://localhost:5000/api/health');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Server is running:', data);
    } else {
      console.log('❌ Server health check failed');
    }
    
  } catch (error) {
    console.log('❌ Connection test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('1. MongoDB is running');
    console.log('2. Server is started with "npm run server"');
  } finally {
    await mongoose.disconnect();
  }
}

testConnection(); 