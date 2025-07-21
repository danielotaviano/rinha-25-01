import { config } from "./config.js";
import { handlePaymentJob, getTotalPayment } from "./payment-service.js";
import http from 'node:http'

export function createHttpServer(tcpClient) {
  const server = http.createServer(async (req, res) => {
    const method = req.method;
    const [url, queryParams] = req.url.split('?');

    if (method === 'POST' && url === '/payments') {
      res.end();
      req.on('data', async data => {
        setTimeout(handlePaymentJob, 0, { data });
      });
    }
    else if (method === 'GET' && url === '/payments-summary') {
      try {
        const params = parseQueryParams(queryParams);
        const { from, to } = convertDatesToTimeRange(params);

        const response = await getTotalPayment(from, to, tcpClient);

        res.write(JSON.stringify({
          ...response,
          serverId: config.server.id
        }));
      } catch (error) {
        res.statusCode = 500;
        console.error('Error processing payment summary:', error);
      }

      res.end();
    }
    else {
      res.statusCode = 404;
      res.end();
    }
  });

  return server;
}

function parseQueryParams(queryParams) {
  if (!queryParams) return {};

  return queryParams.split('&').reduce((result, param) => {
    const [key, value] = param.split('=');
    result[key] = value;
    return result;
  }, {});
}

function convertDatesToTimeRange(params) {
  const from = new Date(params.from);
  const to = new Date(params.to);

  const fromInt = from.getTime() <= config.server.initDate
    ? 0
    : (from.getTime() - config.server.initDate);

  const toInt = to.getTime() - config.server.initDate;

  return { from: fromInt, to: toInt };
}