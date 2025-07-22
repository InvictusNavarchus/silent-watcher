// Jest globals are available globally, no need to import
import { chromium, Browser, Page, BrowserContext } from 'playwright';

describe('Dashboard E2E Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: process.env.CI === 'true' ? 0 : 100,
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
  });

  afterEach(async () => {
    await context.close();
  });

  describe('Authentication Flow', () => {
    it('should redirect to login when not authenticated', async () => {
      await page.goto(baseURL);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('h2')).toContainText('Silent Watcher');
    });

    it('should login successfully with valid credentials', async () => {
      await page.goto(`${baseURL}/login`);
      
      // Fill login form
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password123');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(baseURL + '/');
      await expect(page.locator('h1')).toContainText('Dashboard');
    });

    it('should show error for invalid credentials', async () => {
      await page.goto(`${baseURL}/login`);
      
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('[role="alert"]')).toContainText('Invalid credentials');
    });

    it('should toggle password visibility', async () => {
      await page.goto(`${baseURL}/login`);
      
      const passwordInput = page.locator('input[name="password"]');
      const toggleButton = page.locator('button[type="button"]').last();
      
      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Click toggle button
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Click again to hide
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Dashboard Navigation', () => {
    beforeEach(async () => {
      // Login before each test
      await page.goto(`${baseURL}/login`);
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(baseURL + '/');
    });

    it('should navigate between pages using sidebar', async () => {
      // Test Messages page
      await page.click('a[href="/messages"]');
      await expect(page).toHaveURL(baseURL + '/messages');
      await expect(page.locator('h1')).toContainText('Messages');
      
      // Test Chats page
      await page.click('a[href="/chats"]');
      await expect(page).toHaveURL(baseURL + '/chats');
      await expect(page.locator('h1')).toContainText('Chats');
      
      // Test Statistics page
      await page.click('a[href="/stats"]');
      await expect(page).toHaveURL(baseURL + '/stats');
      await expect(page.locator('h1')).toContainText('Statistics');
      
      // Test Settings page
      await page.click('a[href="/settings"]');
      await expect(page).toHaveURL(baseURL + '/settings');
      await expect(page.locator('h1')).toContainText('Settings');
      
      // Return to Dashboard
      await page.click('a[href="/"]');
      await expect(page).toHaveURL(baseURL + '/');
      await expect(page.locator('h1')).toContainText('Dashboard');
    });

    it('should highlight active navigation item', async () => {
      // Dashboard should be active initially
      await expect(page.locator('a[href="/"]')).toHaveClass(/bg-primary/);
      
      // Navigate to Messages
      await page.click('a[href="/messages"]');
      await expect(page.locator('a[href="/messages"]')).toHaveClass(/bg-primary/);
      await expect(page.locator('a[href="/"]')).not.toHaveClass(/bg-primary/);
    });

    it('should toggle mobile sidebar', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Sidebar should be hidden on mobile
      const sidebar = page.locator('[data-testid="sidebar"]').first();
      await expect(sidebar).toHaveClass(/-translate-x-full/);
      
      // Click menu button to open
      await page.click('button[aria-label="Open menu"]');
      await expect(sidebar).toHaveClass(/translate-x-0/);
      
      // Click outside to close
      await page.click('body');
      await expect(sidebar).toHaveClass(/-translate-x-full/);
    });
  });

  describe('Dashboard Content', () => {
    beforeEach(async () => {
      await page.goto(`${baseURL}/login`);
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(baseURL + '/');
    });

    it('should display stats cards', async () => {
      await expect(page.locator('text=Total Messages')).toBeVisible();
      await expect(page.locator('text=Active Chats')).toBeVisible();
      await expect(page.locator('text=Media Files')).toBeVisible();
      await expect(page.locator('text=Storage Used')).toBeVisible();
    });

    it('should display bot status', async () => {
      await expect(page.locator('text=Bot Status')).toBeVisible();
      await expect(page.locator('text=WhatsApp Connection')).toBeVisible();
      await expect(page.locator('text=Database')).toBeVisible();
      await expect(page.locator('text=Messages Processed')).toBeVisible();
      await expect(page.locator('text=Uptime')).toBeVisible();
    });

    it('should display recent activity', async () => {
      await expect(page.locator('text=Recent Activity')).toBeVisible();
      await expect(page.locator('text=Last 24 hours')).toBeVisible();
      await expect(page.locator('text=Last 7 days')).toBeVisible();
      await expect(page.locator('text=Last 30 days')).toBeVisible();
    });

    it('should display quick actions', async () => {
      await expect(page.locator('text=Quick Actions')).toBeVisible();
      await expect(page.locator('button:has-text("View Recent Messages")')).toBeVisible();
      await expect(page.locator('button:has-text("Manage Chats")')).toBeVisible();
      await expect(page.locator('button:has-text("Export Data")')).toBeVisible();
    });
  });

  describe('Messages Page', () => {
    beforeEach(async () => {
      await page.goto(`${baseURL}/login`);
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.click('a[href="/messages"]');
    });

    it('should display message filters', async () => {
      await expect(page.locator('input[placeholder*="Search messages"]')).toBeVisible();
      await expect(page.locator('select').first()).toBeVisible(); // Days filter
      await expect(page.locator('select').nth(1)).toBeVisible(); // State filter
      await expect(page.locator('select').nth(2)).toBeVisible(); // Type filter
    });

    it('should filter messages by search term', async () => {
      const searchInput = page.locator('input[placeholder*="Search messages"]');
      await searchInput.fill('test message');
      
      // Wait for debounced search
      await page.waitForTimeout(500);
      
      // Should trigger API call with search parameter
      // Note: This would require mocking the API or having test data
    });

    it('should change filters and update results', async () => {
      // Change days filter
      await page.selectOption('select', '1'); // Last 24 hours
      
      // Change message state filter
      await page.selectOption('select >> nth=1', 'edited');
      
      // Change message type filter
      await page.selectOption('select >> nth=2', 'text');
      
      // Should trigger API calls with updated filters
    });

    it('should refresh messages', async () => {
      const refreshButton = page.locator('button:has-text("Refresh")');
      await refreshButton.click();
      
      // Should show loading state briefly
      await expect(refreshButton).toBeDisabled();
    });
  });

  describe('Theme Switching', () => {
    beforeEach(async () => {
      await page.goto(`${baseURL}/login`);
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
    });

    it('should toggle between light and dark themes', async () => {
      const themeButton = page.locator('button[title*="theme"]');
      
      // Should start in light mode (or system preference)
      await expect(page.locator('html')).not.toHaveClass('dark');
      
      // Click to switch to dark mode
      await themeButton.click();
      await expect(page.locator('html')).toHaveClass('dark');
      
      // Click again to switch to system mode
      await themeButton.click();
      // System mode behavior depends on OS preference
      
      // Click again to cycle back to light mode
      await themeButton.click();
      await expect(page.locator('html')).not.toHaveClass('dark');
    });

    it('should persist theme preference', async () => {
      const themeButton = page.locator('button[title*="theme"]');
      
      // Switch to dark mode
      await themeButton.click();
      await expect(page.locator('html')).toHaveClass('dark');
      
      // Reload page
      await page.reload();
      
      // Should still be in dark mode
      await expect(page.locator('html')).toHaveClass('dark');
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      await page.goto(`${baseURL}/login`);
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
    });

    it('should logout and redirect to login page', async () => {
      await page.click('button:has-text("Sign out")');
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      
      // Should not be able to access protected pages
      await page.goto(baseURL + '/');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  describe('Responsive Design', () => {
    beforeEach(async () => {
      await page.goto(`${baseURL}/login`);
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
    });

    it('should work on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      // Dashboard should be responsive
      await expect(page.locator('h1')).toBeVisible();
      
      // Stats cards should stack vertically
      const statsCards = page.locator('[data-testid="stats-card"]');
      if (await statsCards.count() > 0) {
        // Cards should be visible and properly sized
        await expect(statsCards.first()).toBeVisible();
      }
    });

    it('should work on tablet devices', async () => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await expect(page.locator('h1')).toBeVisible();
      
      // Should show mobile menu button
      await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
    });

    it('should work on desktop', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      await expect(page.locator('h1')).toBeVisible();
      
      // Sidebar should be visible
      await expect(page.locator('nav')).toBeVisible();
      
      // Should not show mobile menu button
      await expect(page.locator('button[aria-label="Open menu"]')).not.toBeVisible();
    });
  });
});
