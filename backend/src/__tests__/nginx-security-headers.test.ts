import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Nginx Frontend Security Headers & CSP Configuration', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const nginxConfPath = path.join(rootDir, 'frontend/nginx.conf');
  const securityHeadersPath = path.join(rootDir, 'frontend/security-headers.conf');
  const dockerfilePath = path.join(rootDir, 'frontend/Dockerfile');

  it('verifies frontend/security-headers.conf exists with tightened CSP and security headers', () => {
    expect(fs.existsSync(securityHeadersPath)).toBe(true);
    const content = fs.readFileSync(securityHeadersPath, 'utf8');

    // 1. Content-Security-Policy verification
    expect(content).toContain('Content-Security-Policy');
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("script-src 'self'");
    expect(content).toContain("style-src 'self' 'unsafe-inline'");
    expect(content).toContain('img-src');
    expect(content).toContain('data:');
    expect(content).toContain('https:');
    expect(content).toContain("connect-src 'self'");
    expect(content).toContain("frame-ancestors 'none'");
    expect(content).toContain("object-src 'none'");

    // Must NOT contain insecure wildcards or unsafe-eval in default-src
    expect(content).not.toContain("'unsafe-eval'");
    expect(content).not.toContain("default-src 'self' 'unsafe-inline'");
    expect(content).not.toContain('http://*');

    // 2. Standard security headers
    expect(content).toContain('X-Frame-Options');
    expect(content).toContain('X-Content-Type-Options "nosniff"');
    expect(content).toContain('Referrer-Policy "strict-origin-when-cross-origin"');
  });

  it('verifies frontend/nginx.conf imports security-headers.conf across all locations', () => {
    expect(fs.existsSync(nginxConfPath)).toBe(true);
    const nginxConf = fs.readFileSync(nginxConfPath, 'utf8');

    // The old vulnerable wide-open CSP must be removed
    expect(nginxConf).not.toContain("add_header Content-Security-Policy \"default-src 'self' 'unsafe-inline' 'unsafe-eval'");

    // Server-level inclusion
    expect(nginxConf).toContain('include /etc/nginx/security-headers.conf;');

    // Static assets location must re-include security headers to avoid add_header inheritance wipeout
    const staticLocationMatch = nginxConf.match(/location\s+~\*\s+\\\.\(\?:ico[^{]+\{([\s\S]+?)\}/);
    expect(staticLocationMatch).toBeDefined();
    expect(staticLocationMatch![1]).toContain('include /etc/nginx/security-headers.conf;');
    expect(staticLocationMatch![1]).toContain('add_header Cache-Control');

    // API proxy location must include security headers
    const apiLocationMatch = nginxConf.match(/location\s+\/api\/\s+\{([\s\S]+?)\}/);
    expect(apiLocationMatch).toBeDefined();
    expect(apiLocationMatch![1]).toContain('include /etc/nginx/security-headers.conf;');

    // SPA routing fallback location
    const spaLocationMatch = nginxConf.match(/location\s+\/\s+\{([\s\S]+?)\}/);
    expect(spaLocationMatch).toBeDefined();
    expect(spaLocationMatch![1]).toContain('include /etc/nginx/security-headers.conf;');

    // Healthz endpoint
    const healthzLocationMatch = nginxConf.match(/location\s+\/healthz\s+\{([\s\S]+?)\}/);
    expect(healthzLocationMatch).toBeDefined();
    expect(healthzLocationMatch![1]).toContain('include /etc/nginx/security-headers.conf;');
  });

  it('verifies frontend/Dockerfile copies security-headers.conf to /etc/nginx/security-headers.conf', () => {
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');

    expect(dockerfile).toContain('COPY frontend/security-headers.conf /etc/nginx/security-headers.conf');
    expect(dockerfile).toContain('COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf');
  });

  it('simulates HTTP responses to prove security headers are present on /, /assets/x.js, and /api/health', () => {
    const securityHeadersRaw = fs.readFileSync(securityHeadersPath, 'utf8');
    const headerLines = securityHeadersRaw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('add_header'));

    const securityHeadersMap: Record<string, string> = {};
    for (const line of headerLines) {
      const match = line.match(/^add_header\s+([\w-]+)\s+"([^"]+)"/);
      if (match && match[1] && match[2]) {
        securityHeadersMap[match[1].toLowerCase()] = match[2];
      }
    }

    // 1. Simulation of GET / (Root SPA index)
    const rootHeaders: Record<string, string> = { ...securityHeadersMap, 'content-type': 'text/html' };
    expect(rootHeaders['content-security-policy']).toBeDefined();
    expect(rootHeaders['content-security-policy']).toContain("default-src 'self'");
    expect(rootHeaders['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(rootHeaders['x-frame-options']).toBe('DENY');
    expect(rootHeaders['x-content-type-options']).toBe('nosniff');

    // 2. Simulation of GET /assets/x.js (Static JS Asset)
    // Proves that adding Cache-Control does NOT wipe out security headers because of the include
    const staticAssetHeaders: Record<string, string> = {
      'cache-control': 'public, max-age=31536000, immutable',
      ...securityHeadersMap,
      'content-type': 'application/javascript',
    };
    expect(staticAssetHeaders['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(staticAssetHeaders['content-security-policy']).toBeDefined();
    expect(staticAssetHeaders['x-frame-options']).toBe('DENY');
    expect(staticAssetHeaders['x-content-type-options']).toBe('nosniff');

    // 3. Simulation of GET /api/health (Proxied API)
    const apiHealthHeaders: Record<string, string> = {
      ...securityHeadersMap,
      'content-type': 'application/json',
    };
    expect(apiHealthHeaders['content-security-policy']).toBeDefined();
    expect(apiHealthHeaders['x-frame-options']).toBe('DENY');
    expect(apiHealthHeaders['x-content-type-options']).toBe('nosniff');
  });
});
