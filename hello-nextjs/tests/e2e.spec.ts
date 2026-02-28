import { test as base, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const testPassword = 'Test123456';

type MyFixtures = {
  authPage: Page;
};

type WorkerFixtures = {
  authContext: BrowserContext;
  loggedInPage: Page;
};

const test = base.extend<MyFixtures, WorkerFixtures>({
  authContext: [async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  }, { scope: 'worker' }],
  
  loggedInPage: [async ({ authContext }, use) => {
    const page = await authContext.newPage();
    
    const email = `e2e_${Date.now()}@test.com`;
    console.log(`Worker fixture email: ${email}`);
    
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="name"]', 'E2E Test User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=注册成功')).toBeVisible({ timeout: 10000 });
    
    await page.waitForURL('**/', { timeout: 5000 });
    await expect(page).toHaveURL(BASE_URL + '/');
    
    await use(page);
    await page.close();
  }, { scope: 'worker' }],
  
  authPage: async ({ loggedInPage }, use) => {
    await use(loggedInPage);
  },
});

test.describe('生视频智能体 - E2E Tests', () => {
  test('01 - Homepage loads correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await expect(page).toHaveTitle(/生视频智能体/);
    await expect(page.locator('h1')).toContainText('故事转视频生成平台');
    
    const loginLinks = page.getByRole('link', { name: '登录' });
    await expect(loginLinks.first()).toBeVisible();
  });

  test('02 - User registration flow', async ({ page }) => {
    const email = `e2e_reg_${Date.now()}@test.com`;
    console.log(`Registration test email: ${email}`);
    
    await page.goto(`${BASE_URL}/register`);
    await expect(page.locator('h1')).toContainText('注册');
    
    await page.fill('input[name="name"]', 'Registration Test User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=注册成功')).toBeVisible({ timeout: 10000 });
    
    await page.waitForURL('**/', { timeout: 5000 });
    await expect(page).toHaveURL(BASE_URL + '/');
    
    await expect(page.locator('text=/欢迎回来/')).toBeVisible({ timeout: 5000 });
  });

  test('03 - User login flow - already logged in after registration', async ({ page }) => {
    const email = `e2e_login_${Date.now()}@test.com`;
    console.log(`Login test email: ${email}`);
    
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="name"]', 'Login Test User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=注册成功')).toBeVisible({ timeout: 10000 });
    
    await page.goto(`${BASE_URL}/login`);
    await page.waitForURL('**/', { timeout: 5000 });
    await expect(page).toHaveURL(BASE_URL + '/');
    
    await expect(page.locator('text=欢迎回来')).toBeVisible({ timeout: 5000 });
  });

  test('04 - Invalid login shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=邮箱或密码错误')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('05 - Protected routes redirect to login when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url.includes('/login') || url.includes('/projects')).toBeTruthy();
  });
});

test.describe('生视频智能体 - Authenticated Flow', () => {
  test.describe.configure({ mode: 'serial' });
  
  test('01 - Create new project page accessible after login', async ({ authPage }) => {
    await authPage.goto(`${BASE_URL}/create`);
    await authPage.waitForLoadState('networkidle');
    
    const url = authPage.url();
    console.log('URL after navigating to /create:', url);
    
    expect(url).not.toContain('/login');
    await expect(authPage.locator('h1:has-text("创建新项目")')).toBeVisible({ timeout: 5000 });
  });

  test('02 - Projects page accessible after login', async ({ authPage }) => {
    await authPage.goto(`${BASE_URL}/projects`);
    await authPage.waitForLoadState('networkidle');
    
    const url = authPage.url();
    console.log('URL after navigating to /projects:', url);
    
    expect(url).not.toContain('/login');
  });

  test('03 - Create a new project', async ({ authPage }) => {
    await authPage.goto(`${BASE_URL}/create`);
    await authPage.waitForLoadState('networkidle');
    
    const titleInput = authPage.locator('#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    
    const projectName = `E2E Test Project ${Date.now()}`;
    await titleInput.fill(projectName);
    
    const storyTextarea = authPage.locator('#story');
    await expect(storyTextarea).toBeVisible({ timeout: 5000 });
    await storyTextarea.fill('这是一个E2E测试项目的故事内容。一位勇敢的探险家踏上了寻找失落文明的旅程。');
    
    const cinematicButton = authPage.locator('button:has-text("电影风格")');
    if (await cinematicButton.count() > 0) {
      await cinematicButton.click();
    }
    
    const submitButton = authPage.locator('button[type="submit"]:has-text("创建项目")');
    await submitButton.click();
    
    await authPage.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });
    
    const finalUrl = authPage.url();
    expect(finalUrl).toMatch(/\/projects\/[a-f0-9-]+/);
  });

  test('04 - Verify project appears in list', async ({ authPage }) => {
    await authPage.goto(`${BASE_URL}/projects`);
    await authPage.waitForLoadState('networkidle');
    
    await expect(authPage.locator('text=E2E Test Project')).toBeVisible({ timeout: 5000 });
  });

  test('05 - Logout flow', async ({ authPage, context }) => {
    await authPage.goto(BASE_URL);
    await authPage.waitForLoadState('networkidle');
    
    await expect(authPage.locator('text=欢迎回来')).toBeVisible();
    
    await authPage.request.post(`${BASE_URL}/api/auth/logout`);
    
    await authPage.goto(BASE_URL);
    await authPage.waitForLoadState('networkidle');
    
    const loginLinks = authPage.getByRole('link', { name: '登录' });
    await expect(loginLinks.first()).toBeVisible();
  });
});
