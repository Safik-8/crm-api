// src/utils/userAgentParser.js
import { UAParser } from 'ua-parser-js';

export const parseUserAgent = (headers = {}, ipAddress) => {
  const uaString = headers['user-agent'] || '';

  // Clean and extract IP
  let ip = ipAddress;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
    ip = 'Localhost';
  }

  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const browser = result.browser.name ? `${result.browser.name} ${result.browser.version || ''}`.trim() : 'Unknown Browser';
  
  // Windows 11 detection via Client Hints
  // Standard user agent for Windows 11 still reports "Windows NT 10.0"
  // Modern browsers send "sec-ch-ua-platform-version" where major version >= 13 maps to Windows 11.
  let os = result.os.name ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown OS';
  if (result.os.name === 'Windows') {
    const platformVer = headers['sec-ch-ua-platform-version'] || headers['Sec-Ch-Ua-Platform-Version'];
    if (platformVer) {
      const majorVersion = parseInt(platformVer.replace(/"/g, '').split('.')[0], 10);
      if (majorVersion >= 13) {
        os = 'Windows 11';
      } else {
        os = 'Windows 10';
      }
    } else if (uaString.includes('Windows NT 10.0')) {
      // Fallback if client hint headers aren't present (Windows 10/11)
      os = 'Windows 10/11';
    }
  }
  
  let deviceName = 'Desktop';
  if (result.device.type === 'mobile') {
    deviceName = result.device.model || result.device.vendor || 'Mobile Device';
  } else if (result.device.type === 'tablet') {
    deviceName = result.device.model || result.device.vendor || 'Tablet';
  } else {
    deviceName = result.os.name ? `${result.os.name} PC` : 'Desktop PC';
  }

  return {
    browser,
    os,
    deviceName,
    ipAddress: ip || null
  };
};
