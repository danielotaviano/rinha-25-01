import { randomUUID } from 'node:crypto';

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