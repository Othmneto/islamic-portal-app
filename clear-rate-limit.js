#!/usr/bin/env node

/**
 * Clear Rate Limiting Cache
 * 
 * This script clears the in-memory rate limiting cache by restarting the server.
 * Use this when you've hit the rate limit during testing.
 */

const { exec } = require('child_process');
const os = require('os');

console.log('🔄 Clearing rate limiting cache...');

// Kill all Node.js processes
const killCommand = os.platform() === 'win32' ? 'taskkill /F /IM node.exe' : 'pkill -f node';

exec(killCommand, (error, stdout, stderr) => {
  if (error && !error.message.includes('not found')) {
    console.error('❌ Error killing Node processes:', error);
    return;
  }
  
  console.log('✅ Node.js processes terminated');
  console.log('🚀 You can now restart the server with: node server.js');
  console.log('📝 Rate limiting cache has been cleared');
});
