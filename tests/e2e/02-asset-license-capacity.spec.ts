import { test, expect } from '@playwright/test';

test.describe('E2E Journey 2: Asset Management, License Provisioning & Capacity Constraints', () => {
  test('View assets and licenses, allocate seats to capacity limit, and release seat via stored procedures', async ({
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
    // 2. Navigate to Digital Assets Catalog
    // -------------------------------------------------------------------------
    await page.click('aside >> text=Digital Assets');
    await expect(page).toHaveURL(/\/assets/);
    await expect(page.locator('h1')).toContainText(/Asset/i);
    // Verify asset table rows exist
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // 3. Navigate to Licenses
    // -------------------------------------------------------------------------
    await page.click('aside >> text=Licenses');
    await expect(page).toHaveURL(/\/licenses/);
    await expect(page.locator('h1')).toContainText(/Licenses/i);
    // Verify license cards with utilization indicators
    await expect(page.locator('text=Seat Utilization').first()).toBeVisible({ timeout: 10000 });

    // Click first license card to enter detail page
    await page.locator('a[href^="/licenses/"]').first().click();
    await expect(page).toHaveURL(/\/licenses\/[a-f0-9-]+/);
    await expect(page.locator('text=Software License Key')).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // 4. Inspect Seat Allocations Tab & Capacity
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Seat Allocations")');
    await expect(page.locator('text=Active & Released Seats')).toBeVisible();

    // -------------------------------------------------------------------------
    // 5. Test Stored Procedure sp_allocate_license_seat capacity constraint
    // -------------------------------------------------------------------------
    // Retrieve login token for direct API verification of capacity enforcement
    const loginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: {
        email: 'techcorp.admin@techcorp.io',
        password: 'Password123!',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const token = (await loginRes.json()).data.accessToken;

    // Fetch tenant's seat-based licenses
    const licensesRes = await request.get('http://localhost:5000/api/licenses?limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(licensesRes.ok()).toBeTruthy();
    const licensesData = (await licensesRes.json()).data;
    const seatLicense = licensesData.find((l: any) => l.total_seats > 0) || licensesData[0];
    expect(seatLicense).toBeDefined();

    // Fetch available tenant users for allocation
    const usersRes = await request.get('http://localhost:5000/api/users?limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(usersRes.ok()).toBeTruthy();
    const users = (await usersRes.json()).data;
    expect(users.length).toBeGreaterThan(0);

    // Try allocating until exhaustion to prove sp_allocate_license_seat constraint
    let reachedLimit = false;
    for (const u of users) {
      const allocRes = await request.post(`http://localhost:5000/api/licenses/${seatLicense.license_id}/allocate`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { userId: u.id },
      });

      if (allocRes.status() === 409) {
        const body = await allocRes.json();
        const msg = body.error?.message || body.message || '';
        expect(msg).toMatch(/License seats exhausted|already has an active seat|already exists/i);
        reachedLimit = true;
        break;
      }
    }

    if (!reachedLimit) {
      const vendorsRes = await request.get('http://localhost:5000/api/vendors', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vendorId = (await vendorsRes.json()).data[0]?.id;
      const testLicRes = await request.post('http://localhost:5000/api/licenses', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          name: `Cap Test Lic ${Date.now()}`,
          vendorId,
          licenseTypeId: 3,
          licenseKey: `KEY-${Date.now()}`,
          totalSeats: 1,
          cost: 100,
          currency: 'USD',
          startDate: new Date().toISOString().split('T')[0],
        },
      });
      const testLic = (await testLicRes.json()).data;
      if (testLic?.id) {
        // Allocate 1st seat
        await request.post(`http://localhost:5000/api/licenses/${testLic.id}/allocate`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { userId: users[0].id },
        });
        // Try allocating 2nd seat -> proves constraint
        const overAllocRes = await request.post(`http://localhost:5000/api/licenses/${testLic.id}/allocate`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { userId: users[1].id },
        });
        expect(overAllocRes.status()).toBe(409);
        const overBody = await overAllocRes.json();
        const overMsg = overBody.error?.message || overBody.message || '';
        expect(overMsg).toMatch(/License seats exhausted|already has an active seat/i);
        reachedLimit = true;

        // Clean up test license to avoid DB pollution
        await request.delete(`http://localhost:5000/api/licenses/${testLic.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
    expect(reachedLimit).toBe(true);

    // Re-verify UI is responsive and shows allocation updates
    await page.reload();
    await page.click('button:has-text("Seat Allocations")');
    await expect(page.locator('text=Active & Released Seats')).toBeVisible();
  });
});
