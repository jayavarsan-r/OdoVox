import { test, expect } from '@playwright/test';

/**
 * @e2e Full doctor onboarding happy path against a running dev stack.
 *
 * Runs only when E2E=1 (the dev stack must be up with OTP_PROVIDER=mock so the code is the
 * fixed dev OTP 123456). Walks: welcome slides → phone → OTP → role → create clinic → done.
 */
const enabled = process.env.E2E === '1';

test.describe('Doctor onboarding (smoke)', () => {
  test.skip(!enabled, 'Set E2E=1 and run the dev stack to enable this smoke test.');

  test('first-time doctor creates a clinic and reaches the join-code screen', async ({ page }) => {
    const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    await page.goto('/welcome');
    // Skip straight through the slides.
    await page.getByRole('button', { name: 'Skip' }).click();

    // Phone
    await expect(page.getByText('Welcome to Odovox')).toBeVisible();
    await page.getByLabel('Mobile number').fill(phone);
    await page.getByRole('button', { name: 'Continue' }).click();

    // OTP — dev code
    await expect(page.getByText('Verify your number')).toBeVisible();
    await page.getByLabel('Verification code').fill('123456');

    // Role
    await expect(page.getByText("What's your role?")).toBeVisible();
    await page.getByRole('button', { name: /Doctor/ }).click();

    // Clinic choice → create
    await page.getByRole('button', { name: /Create a new clinic/ }).click();

    // Clinic create — minimal required fields
    await page.getByLabel('Clinic name').fill('Smile Dental Care');
    await page.getByLabel('Address').fill('12 MG Road, Indiranagar');
    await page.getByLabel('City').fill('Bengaluru');
    await page.getByLabel('State').selectOption('Karnataka');
    await page.getByLabel('Pincode').fill('560001');
    await page.getByLabel('Your name').fill('Dr. Asha Menon');
    await page.getByLabel('Registration number').fill('KA-DENT-12345');
    await page.getByRole('button', { name: 'Create clinic' }).click();

    // Done — join code visible
    await expect(page.getByText('Your clinic is live')).toBeVisible();
    await expect(page.getByText('Join code')).toBeVisible();
    await expect(page.getByRole('button', { name: /Copy code/ })).toBeVisible();
  });
});
