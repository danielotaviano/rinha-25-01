import { promisify } from 'node:util';
import { lookup } from 'node:dns';

const dnsLookup = promisify(lookup);

/**
 * Resolves hostname from a URL to IP address
 * @param {string} url - The full URL (e.g., http://hostname:8080/path)
 * @returns {string} - URL with hostname replaced by IP address
 */
export async function resolveUrlToIp(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Skip resolution if it's already an IP address
    if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return url;
    }
    
    const { address } = await dnsLookup(hostname);
    urlObj.hostname = address;
    
    console.log(`DNS resolved: ${hostname} -> ${address}`);
    return urlObj.toString();
  } catch (error) {
    console.warn(`DNS resolution failed for ${url}:`, error.message);
    return url; // Fallback to original URL
  }
}

/**
 * Resolves all payment processor URLs to use IP addresses
 * @param {object} paymentProcessors - Configuration object with payment processor URLs
 * @returns {object} - Updated configuration with resolved IP addresses
 */
export async function resolvePaymentProcessorUrls(paymentProcessors) {
  const resolved = {};
  
  for (const [name, config] of Object.entries(paymentProcessors)) {
    console.log(`Resolving DNS for ${name} payment processor...`);
    
    resolved[name] = {
      ...config,
      url: await resolveUrlToIp(config.url),
      healthEndpoint: await resolveUrlToIp(config.healthEndpoint),
      paymentEndpoint: await resolveUrlToIp(config.paymentEndpoint)
    };
  }
  
  return resolved;
}