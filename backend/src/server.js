const { start } = require('./app');

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
