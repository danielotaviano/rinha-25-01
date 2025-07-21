import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import { config } from './config.js';
import { healthcheckState } from './health-check.js';
import { getPaymentReport } from './payment-service.js';

export class TcpCommunication {
  constructor() {
    this.sockets = new Map();
    this.messageHandlers = new Map();
    this.client = null;
    this.server = null;
  }

  getSockets() {
    return this.sockets;
  }

  getClient() {
    return this.client;
  }

  notifyAllSockets(payload) {
    for (const socket of this.sockets.values()) {
      socket.write(payload);
    }
  }

  initializeLeader() {
    if (fs.existsSync(config.tcp.socketPath)) {
      fs.unlinkSync(config.tcp.socketPath)
    }

    this.openTcpServer();
  }

  initializeFollower() {
    this.openTcpClient();
  }

  openTcpServer() {
    this.server = net.createServer((socket) => {
      const id = randomUUID();
      this.sockets.set(id, socket);
      socket.write(`SERVER_INIT_TIME ${config.server.initDate}`);

      socket.on('close', () => {
        this.sockets.delete(id);
      })

      socket.on('data', async (data) => {
        const [type, ...rest] = data.toString().split(' ');

        if (type === 'REQUEST_PAYMENT') {
          const [requestId, fromInt, toInt] = rest;
          const report = getPaymentReport(Number(fromInt), Number(toInt));

          const payload = `PAYMENT_REPORT ${requestId} ${report.default.totalRequests} ${report.default.totalAmount} ${report.fallback.totalRequests} ${report.fallback.totalAmount}`
          socket.write(payload);
        }
      });
    });

    this.server.listen(config.tcp.socketPath, () => {
      console.log('TCP server listening!');
    })
  }

  openTcpClient() {
    this.client = net.createConnection(config.tcp.socketPath);

    this.client.on('connect', () => {
      console.log('TCP client connected!');

      this.client.on('data', data => {
        const [type, ...rest] = data.toString().split(' ');

        if (type === 'HEALTHCHECK') {
          const [defaultFailing, defaultMinResponseTime, fallbackFailing, fallbackMinResponseTime] = rest;
          healthcheckState.default.failing = defaultFailing === 'true';
          healthcheckState.default.minResponseTime = Number(defaultMinResponseTime);
          healthcheckState.fallback.failing = fallbackFailing === 'true';
          healthcheckState.fallback.minResponseTime = Number(fallbackMinResponseTime);
          return;
        }

        if (type === 'REQUEST_PAYMENT') {
          const [requestId, fromInt, toInt] = rest;
          const report = getPaymentReport(Number(fromInt), Number(toInt));

          const payload = `PAYMENT_REPORT ${requestId} ${report.default.totalRequests} ${report.default.totalAmount} ${report.fallback.totalRequests} ${report.fallback.totalAmount}`;
          this.client.write(payload);
          return;
        }

        if (type === 'SERVER_INIT_TIME') {
          const [initTime] = rest;
          config.server.initDate = Number(initTime);
          console.log('Server init date updated:', config.server.initDate);
          return;
        }
      })
    });
  }
}