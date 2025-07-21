import { config } from './config.js'

export const healthcheckState = {
  default: {
    failing: false,
    minResponseTime: 0
  },
  fallback: {
    failing: false,
    minResponseTime: 0
  }
}

export function decidePaymentService() {
  if (healthcheckState.default.failing && healthcheckState.fallback.failing) return 'unavailable';
  if (healthcheckState.default.failing) return 'fallback';
  if (healthcheckState.fallback.failing) return 'default';

  if (healthcheckState.default.minResponseTime === healthcheckState.fallback.minResponseTime) return 'default';
  if (
    healthcheckState.fallback.minResponseTime < healthcheckState.default.minResponseTime &&
    (healthcheckState.default.minResponseTime - healthcheckState.fallback.minResponseTime) > 500
  ) return 'default';

  return 'default';
}

export async function checkHealthcheck(notifyTcpSockets) {
  try {
    const headers = { 'Content-Type': 'application/json' };

    const promises = [
      fetch(config.paymentProcessors.default.healthEndpoint, { headers }).then(res => res.json()),
      fetch(config.paymentProcessors.fallback.healthEndpoint, { headers }).then(res => res.json())
    ];

    const [defaultResponse, fallbackResponse] = await Promise.all(promises);

    healthcheckState.default = defaultResponse;
    healthcheckState.fallback = fallbackResponse;

    if (notifyTcpSockets) {
      const payload = `HEALTHCHECK ${healthcheckState.default.failing} ${healthcheckState.default.minResponseTime} ${healthcheckState.fallback.failing} ${healthcheckState.fallback.minResponseTime}`;
      notifyTcpSockets(payload);
    }
  } catch (error) {
    console.error('Health check error:', error);
  }

  setTimeout(() => checkHealthcheck(notifyTcpSockets), 4600);
}