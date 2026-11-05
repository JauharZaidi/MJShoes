module.exports = {
  apps: [
    {
      name: 'mjstore-api',
      script: './index.js',
      instances: 'max', // Leverages Node.js Cluster Module across all CPU cores securely
      exec_mode: 'cluster',
      wait_ready: true, // Waits for process.send('ready') explicitly eliminating zero-downtime overlaps
      listen_timeout: 10000,
      kill_timeout: 5000, // Provides 5000ms strictly to drain existing active checkout socket connections
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'mjstore-worker',
      script: './worker.js',
      instances: 1, // Single strictly processing unified queue payloads
      kill_timeout: 5000, 
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
