// ==============================================================================
// AssetVault: Responsive Screenshot & Persona Automation Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Captures responsive screens across Desktop (1280px), Tablet (768px), and Mobile (375px)
// Preserves in-memory JWT session via client-side SPA navigation
// ==============================================================================

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Launching headless Chromium via Playwright...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
  });

  const page = await context.newPage();
  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('[vite]') && !text.includes('Download the React DevTools')) {
      console.log('  [Browser]', text);
    }
  });
  page.on('pageerror', (err) => console.log('  [Browser Error]', err.message));

  async function capture(filename, viewport = VIEWPORTS.desktop) {
    if (!filename.startsWith('01_login') && !filename.startsWith('02_register') && page.url().endsWith('/login')) {
      throw new Error(`Auth guard failed! Attempted to capture ${filename} while redirected to /login (${page.url()})`);
    }
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await sleep(600);
    const filepath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`📸 Captured: ${filename} (${viewport.width}x${viewport.height})`);
  }

  // SPA navigation helper that preserves in-memory JWT token
  async function spaNavigate(routePath) {
    console.log(`🧭 Navigating to: ${routePath}`);
    await page.evaluate((p) => {
      if (window.__navigate) {
        window.__navigate(p);
      } else {
        window.history.pushState({}, '', p);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }, routePath);

    // Wait until pathname matches
    await page.waitForFunction(
      (path) => window.location.pathname === path || window.location.pathname.startsWith(path),
      routePath,
      { timeout: 5000 }
    ).catch(() => {});

    await sleep(600);

    // Wait until loading skeletons disappear
    await page.waitForFunction(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      return skeletons.length === 0;
    }, { timeout: 6000 }).catch(() => {});

    await sleep(400);
  }

  // Persona Login Helper
  async function loginAsPersona(roleKeyword) {
    console.log(`\n🔑 Authenticating as: ${roleKeyword}...`);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(800);

    const clicked = await page.evaluate((kw) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => b.innerText.toLowerCase().includes(kw.toLowerCase()));
      if (btn) {
        btn.click();
        return btn.innerText.replace(/\n/g, ' ');
      }
      return null;
    }, roleKeyword);

    console.log(`  👉 Selected Persona: "${clicked}"`);
    await sleep(400);

    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/login') && res.status() === 200, { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForSelector('aside', { timeout: 10000 });
    await page.waitForSelector('h1', { timeout: 10000 });

    // Wait for skeletons to clear
    await page.waitForFunction(() => {
      const skeletons = document.querySelectorAll('.animate-pulse');
      return skeletons.length === 0;
    }, { timeout: 6000 }).catch(() => {});

    await sleep(600);
    console.log(`✅ Logged in successfully. Current route: ${page.url()}`);
  }

  try {
    // -------------------------------------------------------------------------
    // 1. PUBLIC AUTH PAGES
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Capturing Public Auth Pages ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await capture('01_login_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('01_login_tablet_768px.png', VIEWPORTS.tablet);
    await capture('01_login_mobile_375px.png', VIEWPORTS.mobile);

    await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    await capture('02_register_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('02_register_mobile_375px.png', VIEWPORTS.mobile);

    // -------------------------------------------------------------------------
    // 2. TENANT ADMIN WORKFLOW (TechCorp)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Tenant Administrator Experience ---');
    await loginAsPersona('Tenant Admin');

    // Dashboard
    await capture('03_admin_dashboard_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('03_admin_dashboard_tablet_768px.png', VIEWPORTS.tablet);
    await capture('03_admin_dashboard_mobile_375px.png', VIEWPORTS.mobile);

    // Toggle Dark Theme
    const themeButton = await page.$('button[title*="theme" i], button[aria-label*="theme" i]');
    if (themeButton) {
      await themeButton.click();
      await sleep(600);
      await capture('03_admin_dashboard_dark_1280px.png', VIEWPORTS.desktop);
      await themeButton.click(); // Revert back
      await sleep(400);
    }

    // Asset Catalog
    await spaNavigate('/assets');
    await capture('04_assets_catalog_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('04_assets_catalog_tablet_768px.png', VIEWPORTS.tablet);
    await capture('04_assets_catalog_mobile_375px.png', VIEWPORTS.mobile);

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForSelector('a[href*="/assets/"]', { timeout: 6000 }).catch(() => {});

    let firstAssetHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/assets/"]'));
      const detailLink = links.find((l) => {
        const href = l.getAttribute('href');
        return href && href !== '/assets' && !href.endsWith('/new');
      });
      return detailLink ? detailLink.getAttribute('href') : null;
    });

    if (!firstAssetHref) {
      const assetRes = await page.evaluate(async () => {
        try {
          const r = await fetch('/api/assets?limit=1');
          const d = await r.json();
          const item = d.data?.[0] || d?.[0];
          return item ? item.id : null;
        } catch {
          return null;
        }
      });
      if (assetRes) firstAssetHref = `/assets/${assetRes}`;
    }

    if (firstAssetHref) {
      console.log(`  🔗 Found asset detail link: ${firstAssetHref}`);
      await spaNavigate(firstAssetHref);
      await capture('05_asset_detail_desktop_1280px.png', VIEWPORTS.desktop);
      await capture('05_asset_detail_mobile_375px.png', VIEWPORTS.mobile);
    } else {
      console.warn('  ⚠️ No asset link found on /assets');
    }

    // License Catalog
    await spaNavigate('/licenses');
    await capture('06_licenses_catalog_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('06_licenses_catalog_mobile_375px.png', VIEWPORTS.mobile);

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForSelector('a[href*="/licenses/"]', { timeout: 6000 }).catch(() => {});

    let firstLicenseHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/licenses/"]'));
      const detailLink = links.find((l) => {
        const href = l.getAttribute('href');
        return href && href !== '/licenses' && !href.endsWith('/new');
      });
      return detailLink ? detailLink.getAttribute('href') : null;
    });

    if (!firstLicenseHref) {
      const licRes = await page.evaluate(async () => {
        try {
          const r = await fetch('/api/licenses?limit=1');
          const d = await r.json();
          const item = d.data?.[0] || d?.[0];
          return item ? item.id : null;
        } catch {
          return null;
        }
      });
      if (licRes) firstLicenseHref = `/licenses/${licRes}`;
    }

    if (firstLicenseHref) {
      console.log(`  🔗 Found license detail link: ${firstLicenseHref}`);
      await spaNavigate(firstLicenseHref);
      await capture('07_license_detail_desktop_1280px.png', VIEWPORTS.desktop);
      await capture('07_license_detail_mobile_375px.png', VIEWPORTS.mobile);
    } else {
      console.warn('  ⚠️ No license link found on /licenses');
    }

    // Analytical Reports (Visualizations)
    await spaNavigate('/reports');
    await capture('08_reports_analytics_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('08_reports_analytics_mobile_375px.png', VIEWPORTS.mobile);

    // Category Hierarchy Tree
    await spaNavigate('/categories');
    await capture('09_categories_tree_desktop_1280px.png', VIEWPORTS.desktop);

    // User Management
    await spaNavigate('/users');
    await capture('10_users_table_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('10_users_table_mobile_375px.png', VIEWPORTS.mobile);

    // Notifications Center
    await spaNavigate('/notifications');
    await capture('11_notifications_desktop_1280px.png', VIEWPORTS.desktop);

    // Compliance Audit Trail
    await spaNavigate('/audit-logs');
    await capture('12_audit_logs_desktop_1280px.png', VIEWPORTS.desktop);

    // -------------------------------------------------------------------------
    // 3. MEMBER WORKFLOW (Self-Service Portal)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Standard Member Experience ---');
    await loginAsPersona('Member');
    await spaNavigate('/my-licenses');
    await capture('13_member_my_licenses_desktop_1280px.png', VIEWPORTS.desktop);
    await capture('13_member_my_licenses_mobile_375px.png', VIEWPORTS.mobile);

    // -------------------------------------------------------------------------
    // 4. SUPER ADMIN PLATFORM GOVERNANCE
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Super Administrator Governance ---');
    await loginAsPersona('Super Admin');
    await spaNavigate('/');
    await capture('14_superadmin_overview_desktop_1280px.png', VIEWPORTS.desktop);

    await spaNavigate('/platform/tenants');
    await capture('15_platform_tenants_desktop_1280px.png', VIEWPORTS.desktop);

    await spaNavigate('/platform/plans');
    await capture('16_platform_plans_desktop_1280px.png', VIEWPORTS.desktop);

    console.log('\n🎉 ALL RESPONSIVE SCREENSHOTS CAPTURED BEAUTIFULLY!');
  } catch (err) {
    console.error('❌ Capture error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
