import 'dotenv/config'
import { config, initializeResolvedUrls } from "./config.js";
import { checkHealthcheck } from "./health-check.js";
import { createHttpServer } from "./http-server.js";
import { processRetryqueue } from "./payment-service.js";
import { TcpCommunication } from "./tcp-communication.js";

console.log('SERVER ID:', config.server.id);
console.log('INIT DATE:', config.server.initDate);

// Initialize DNS resolution before starting servers
await initializeResolvedUrls();

const tcpCommunication = new TcpCommunication();

if (config.server.isLeader) {
  tcpCommunication.initializeLeader();
  checkHealthcheck(payload => tcpCommunication.notifyAllSockets(payload));
} else {
  tcpCommunication.initializeFollower();
}


const httpServer = createHttpServer(tcpCommunication);
httpServer.listen({
  reusePort: true,
  port: config.server.port
}, () => {
  console.log(`HTTP server listening on port ${config.server.port}!`)
  processRetryqueue();
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  httpServer.close();
  process.exit(0);
})
