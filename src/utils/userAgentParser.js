// src/utils/userAgentParser.js
import { UAParser } from 'ua-parser-js';

/**
 * Proxy-Safe IP Extraction & Loopback Normalization.
 * Priority: req.ip -> x-real-ip -> x-forwarded-for (first IP) -> socket remote address.
 * @param {object|string} reqOrHeaders
 * @param {string} [fallbackIp]
 * @returns {string} Cleaned & Normalized IP address
 */
export const normalizeIpAddress = (reqOrHeaders, fallbackIp) => {
  let rawIp = '';

  if (typeof reqOrHeaders === 'string' && reqOrHeaders.trim() !== '') {
    rawIp = reqOrHeaders;
  } else if (reqOrHeaders && typeof reqOrHeaders === 'object') {
    // 1. Express req.ip / req.ips (Proxy-aware if trust proxy configured)
    if (reqOrHeaders.ip) {
      rawIp = reqOrHeaders.ip;
    } else if (Array.isArray(reqOrHeaders.ips) && reqOrHeaders.ips.length > 0) {
      rawIp = reqOrHeaders.ips[0];
    } else {
      // 2. Headers inspection: x-real-ip
      const headers = reqOrHeaders.headers || reqOrHeaders;
      const realIp = headers['x-real-ip'] || headers['X-Real-IP'];
      const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];

      if (realIp && typeof realIp === 'string') {
        rawIp = realIp.trim();
      } else if (forwarded && typeof forwarded === 'string') {
        rawIp = forwarded.split(',')[0].trim();
      } else if (reqOrHeaders.socket && reqOrHeaders.socket.remoteAddress) {
        rawIp = reqOrHeaders.socket.remoteAddress;
      }
    }
  }

  if (!rawIp && fallbackIp && typeof fallbackIp === 'string') {
    rawIp = fallbackIp.trim();
  }

  if (!rawIp || rawIp === 'undefined' || rawIp === 'null') {
    return 'Unknown';
  }

  const cleanIp = rawIp.trim();

  // Localhost IPv4 & IPv6 loopbacks
  if (
    cleanIp === '::1' ||
    cleanIp === '127.0.0.1' ||
    cleanIp === '::ffff:127.0.0.1' ||
    cleanIp.toLowerCase() === 'localhost'
  ) {
    return 'Localhost';
  }

  return cleanIp;
};

/**
 * Parses user agent header and client hints to extract clean browser, OS, device, and IP.
 * Priority: real value > parsed value > fallback.
 * @param {object} reqOrHeaders
 * @param {string} [ipAddress]
 * @returns {object} { browser, os, deviceName, ipAddress }
 */
export const parseUserAgent = (reqOrHeaders = {}, ipAddress = '') => {
  const headers = reqOrHeaders.headers || (typeof reqOrHeaders === 'object' ? reqOrHeaders : {});
  const uaString = headers['user-agent'] || headers['User-Agent'] || '';
  const ip = normalizeIpAddress(reqOrHeaders, ipAddress);

  if (!uaString) {
    return {
      browser: 'Unknown Browser',
      os: 'Unknown OS',
      deviceName: 'Unknown Device',
      ipAddress: ip,
    };
  }

  try {
    const parser = new UAParser(uaString);
    const result = parser.getResult();

    // 1. Browser Parsing (e.g., "Chrome 122" or "Chrome")
    let browser = 'Unknown Browser';
    if (result.browser && result.browser.name) {
      const mainVersion = result.browser.version ? result.browser.version.split('.')[0] : '';
      browser = mainVersion ? `${result.browser.name} ${mainVersion}` : result.browser.name;
    }

    // 2. OS Parsing (With Windows 11 Client Hints support)
    let os = result.os && result.os.name ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown OS';
    if (result.os && result.os.name === 'Windows') {
      const platformVer = headers['sec-ch-ua-platform-version'] || headers['Sec-Ch-Ua-Platform-Version'];
      if (platformVer) {
        const majorVersion = parseInt(platformVer.replace(/"/g, '').split('.')[0], 10);
        if (majorVersion >= 13) {
          os = 'Windows 11';
        } else {
          os = 'Windows 10';
        }
      } else if (uaString.includes('Windows NT 10.0')) {
        os = 'Windows 10/11';
      }
    }

    // 3. Device Hardware Name Detection
    let deviceName = 'Desktop PC';
    if (result.device && result.device.type === 'mobile') {
      deviceName = result.device.model || result.device.vendor || 'Mobile Device';
    } else if (result.device && result.device.type === 'tablet') {
      deviceName = result.device.model || result.device.vendor || 'Tablet';
    } else if (result.os && result.os.name) {
      if (result.os.name.includes('Mac') || result.os.name.includes('iOS')) {
        deviceName = 'Mac PC';
      } else if (result.os.name.includes('Windows')) {
        deviceName = 'Windows PC';
      } else if (result.os.name.includes('Linux')) {
        deviceName = 'Linux PC';
      } else {
        deviceName = `${result.os.name} PC`;
      }
    }

    return {
      browser,
      os,
      deviceName,
      ipAddress: ip,
    };
  } catch (err) {
    console.error('[UserAgentParser] Failed to parse User-Agent header:', err.message);
    return {
      browser: 'Unknown Browser',
      os: 'Unknown OS',
      deviceName: 'Unknown Device',
      ipAddress: ip,
    };
  }
};
