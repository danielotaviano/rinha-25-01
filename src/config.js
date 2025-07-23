import { randomUUID } from 'node:crypto';
import { resolvePaymentProcessorUrls } from './dns-resolver.js';

export const config = {
  server: {
    port: process.env.PORT || 9999,
    id: randomUUID(),
    initDate: Date.now(),
    isLeader: process.env.LEADER === 'true'
  },
  tcp: {
    socketPath: process.env.TCP_SOCKET_PATH
  },
  paymentProcessors: {
    default: {
      url: process.env.PAYMENT_PROCESSOR_URL_DEFAULT,
      healthEndpoint: `${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`,
      paymentEndpoint: `${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments`
    },
    fallback: {
      url: process.env.PAYMENT_PROCESSOR_URL_FALLBACK,
      healthEndpoint: `${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`,
      paymentEndpoint: `${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments`
    }
  }
}

// Stores the resolved payment processor URLs (set during startup)
export let resolvedPaymentProcessors = null;

export async function initializeResolvedUrls() {
  console.log('Initializing DNS resolution for payment processors...');
  resolvedPaymentProcessors = await resolvePaymentProcessorUrls(config.paymentProcessors);
  console.log('DNS resolution completed.');
}