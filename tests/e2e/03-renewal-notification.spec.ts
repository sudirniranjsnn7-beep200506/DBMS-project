import { test, expect } from '@playwright/test';

test.describe('E2E Journey 3: License Renewal via Stored Procedure & Expiry Notifications', () => {
  test('Renew license term using sp_renew_license, generate expiry alerts, and verify notification bell', async ({
    page,
    request,
  }) => {
    // -------------------------------------------------------------------------
    // 1. Log in as Tenant Admin
    // -------------------------------------------------------------------------
    await page.goto('/login');
    await page.click('button:has-text("Tenant Admin")');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\//);
    await expect(page.locator('text=TechCorp Dynamics').first()).toBeVisible({ timeout: 15000 });

    // -------------------------------------------------------------------------
    // 2. Fetch Active License to Test Renewal
    // -------------------------------------------------------------------------
    const loginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: {
        email: 'techcorp.admin@techcorp.io',
        password: 'Password123!',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const token = (await loginRes.json()).data.accessToken;

    const licensesRes = await request.get('http://localhost:5000/api/licenses?limit=5', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(licensesRes.ok()).toBeTruthy();
    const license = (await licensesRes.json()).data[0];
    expect(license).toBeDefined();

    // -------------------------------------------------------------------------
    // 3. Navigate to License Detail Page via UI
    // -------------------------------------------------------------------------
    await page.click('aside >> text=Licenses');
    await expect(page).toHaveURL(/\/licenses/);
    await expect(page.locator('text=Seat Utilization').first()).toBeVisible({ timeout: 10000 });
    await page.locator('a[href^="/licenses/"]').first().click();
    await expect(page).toHaveURL(/\/licenses\/[a-f0-9-]+/);
    await expect(page.locator('text=Software License Key')).toBeVisible({ timeout: 10000 });

    // Switch to Renewal History tab
    await page.click('button:has-text("Renewal History")');
    await expect(page.locator('text=Renewal Log')).toBeVisible();

    // -------------------------------------------------------------------------
    // 4. Execute Contract Extension via sp_renew_license Stored Procedure
    // -------------------------------------------------------------------------
    const currentUrl = page.url();
    const targetId = currentUrl.match(/\/licenses\/([a-f0-9-]+)/)?.[1] || license?.license_id || license?.id;

    // Retrieve current license details to dynamically extend past current expiration
    const currentDetailRes = await request.get(`http://localhost:5000/api/licenses/${targetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const currentLic = (await currentDetailRes.json()).data;
    const baseDate = currentLic?.endDate ? new Date(currentLic.endDate) : new Date();
    baseDate.setFullYear(baseDate.getFullYear() + 1);
    const newEndDateStr = baseDate.toISOString().split('T')[0];

    const renewRes = await request.post(`http://localhost:5000/api/licenses/${targetId}/renew`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        newEndDate: newEndDateStr,
        cost: 2500.0,
        notes: 'Automated E2E multi-year contract renewal',
      },
    });
    if (!renewRes.ok()) {
      console.log('Renew failed:', renewRes.status(), await renewRes.text());
    }
    expect(renewRes.ok()).toBeTruthy();
    const renewBody = await renewRes.json();
    expect(renewBody.data?.success || renewBody.success).toBe(true);

    // Refresh page and confirm renewal timeline rendered
    await page.reload();
    await page.click('button:has-text("Renewal History")');
    await expect(page.locator('text=Renewal Log')).toBeVisible();

    // -------------------------------------------------------------------------
    // 5. Trigger Expiry Check Function fn_generate_expiry_notifications()
    // -------------------------------------------------------------------------
    const checkExpiryRes = await request.post('http://localhost:5000/api/notifications/run-expiry-check', {
      headers: { Authorization: `Bearer ${token}` },
      data: { lookaheadDays: 90 },
    });
    expect(checkExpiryRes.ok()).toBeTruthy();
    const expiryBody = await checkExpiryRes.json();
    expect(expiryBody.data).toHaveProperty('notificationsGenerated');

    // -------------------------------------------------------------------------
    // 6. Navigate to Notifications UI Page
    // -------------------------------------------------------------------------
    await page.click('aside >> text=Notifications');
    await expect(page).toHaveURL(/\/notifications/);
    await expect(page.locator('h1')).toContainText(/Alerts|Notifications/i);
    // Ensure notifications view loaded cleanly
    await expect(page.locator('button:has-text("Mark All Read")')).toBeVisible({ timeout: 10000 });
  });
});
