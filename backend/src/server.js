const cluster = require('cluster');
const os = require('os');

const workers = parseInt(process.env.CLUSTER_WORKERS || '0', 10);
const workerCount = workers > 0 ? workers : 0;

function startWorker() {
  const { start } = require('./app');
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

if (workerCount > 1 && cluster.isPrimary) {
  console.log(`Starting ${workerCount} API workers for concurrent load`);
  for (let i = 0; i < workerCount; i += 1) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    console.warn(`Worker ${worker.process.pid} exited — restarting`);
    cluster.fork();
  });
} else {
  if (workerCount === 0 && process.env.NODE_ENV === 'production') {
    const cpus = os.cpus().length;
    const recommended = Math.min(Math.max(cpus - 1, 2), 4);
    console.log(`Single-process mode. For 200+ concurrent users set CLUSTER_WORKERS=${recommended}`);
  }
  startWorker();
}
