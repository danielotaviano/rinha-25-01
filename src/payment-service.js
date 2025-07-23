import { healthcheckState, decidePaymentService } from './health-check.js';
import { config, resolvedPaymentProcessors } from './config.js';
import { randomUUID } from 'node:crypto';

export const payments = [];
const retryQueue = [];

export function getPaymentReport(fromInt, toInt) {
  const paymentsRange = payments.slice(fromInt, toInt + 1);

  const response = paymentsRange.reduce((result, payments) => {
    if (!payments) return result;

    for (const payment of payments) {
      if (payment.default) {
        result.default.totalAmount += payment.amount;
        result.default.totalRequests++;
      } else {
        result.fallback.totalAmount += payment.amount;
        result.fallback.totalRequests++;
      }
    }
    return result;
  }, {
    default: { totalRequests: 0, totalAmount: 0 },
    fallback: { totalRequests: 0, totalAmount: 0 }
  });

  response.default.totalAmount = parseFloat(response.default.totalAmount.toFixed(2));
  response.fallback.totalAmount = parseFloat(response.fallback.totalAmount.toFixed(2));

  return response;
}

export async function handlePaymentJob({ data }) {
  const requestTime = Date.now();
  const { correlationId, amount } = JSON.parse(data.toString());
  const paymentIdx = requestTime - config.server.initDate;

  const serviceName = decidePaymentService(healthcheckState);
  if (serviceName === 'unavailable') {
    retryQueue.push({ data });
    return;
  }

  const endpointUrl = serviceName === 'default'
    ? resolvedPaymentProcessors.default.paymentEndpoint
    : resolvedPaymentProcessors.fallback.paymentEndpoint

  const body = JSON.stringify({
    correlationId,
    amount,
    requestedAt: new Date(requestTime)
  });

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    if (!response.ok) {
      return retryQueue.push({ add });
    }


    if (payments[paymentIdx] === undefined) {
      payments[paymentIdx] = [];
    }

    payments[paymentIdx].push({ amount, default: serviceName === 'default' });
  } catch (error) {
    retryQueue.push({ data });
  }
}

export function processRetryqueue() {
  const job = retryQueue.shift()
  if (job === undefined) {
    return setTimeout(processRetryqueue, 1000);
  }

  handlePaymentJob(job).then(() => {
    setImmediate(processRetryqueue)
  });
}

export async function getTotalPayment(fromInt, toInt, tcpClient, ignoreSocket = null) {
  return new Promise(async (resolve, reject) => {
    const requestId = randomUUID();
    const paymentReport = getPaymentReport(fromInt, toInt);

    if (config.server.isLeader) {
      const handleSocketData = createSocketDataHandler(requestId, paymentReport, resolve);
      const sockets = tcpClient.getSockets();
      let socketsCount = ignoreSocket ? sockets.size - 1 : sockets.size;

      if (socketsCount === 0) {
        return resolve(paymentReport);
      }

      for (const socket of sockets.values()) {
        if (ignoreSocket && socket === ignoreSocket) continue;
        socket.write(`REQUEST_PAYMENT ${requestId} ${fromInt} ${toInt}`);
        const handlefn = handleSocketData(() => {
          --socketsCount;
          socket.removeListener('data', handlefn);
        });
        socket.on('data', handlefn);
      }

      setTimeout(() => reject(new Error('Payment report request timed out')), 2000);
    } else {
      const handleClientData = createSocketDataHandler(requestId, paymentReport, resolve);
      const client = tcpClient.getClient();

      client.write(`REQUEST_PAYMENT ${requestId} ${fromInt} ${toInt}`);
      const handlefn = handleClientData(() => {
        client.removeListener('data', handlefn);
      });
      client.on('data', handlefn);
    }
  })
}

function createSocketDataHandler(requestId, paymentReport, resolvePromise) {
  return (onComplete = () => { }) => {
    return (data) => {
      const [type, ...rest] = data.toString().split(' ');

      if (type === 'PAYMENT_REPORT') {
        const [responseId, defaultTotalRequests, defaultTotalAmount, fallbackTotalRequests, fallbackTotalAmount] = rest;

        if (responseId !== requestId) return;

        paymentReport.default.totalRequests += Number(defaultTotalRequests);
        paymentReport.default.totalAmount += Number(defaultTotalAmount);
        paymentReport.fallback.totalRequests += Number(fallbackTotalRequests);
        paymentReport.fallback.totalAmount += Number(fallbackTotalAmount);

        paymentReport.default.totalAmount = parseFloat(paymentReport.default.totalAmount.toFixed(2));
        paymentReport.fallback.totalAmount = parseFloat(paymentReport.fallback.totalAmount.toFixed(2));

        onComplete();
        resolvePromise(paymentReport);
      }
    }
  }
}
