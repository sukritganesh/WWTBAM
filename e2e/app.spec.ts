import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CatalogQuestion {
  id: string;
  prompt: string;
  correctChoiceId: string;
}

const generated = JSON.parse(readFileSync(resolve(process.cwd(), 'src/content/generated/catalog.json'), 'utf8')) as { questions: CatalogQuestion[] };
const byPrompt = new Map(generated.questions.map((question) => [question.prompt, question]));

async function createProfileAndReachSetup(page: Page, name = 'Browser Tester') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /One Million/i })).toBeAttached();
  await page.getByRole('button', { name: /Create profile/i }).click();
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Create Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Welcome back, ${name}`) })).toBeVisible();
  await page.getByRole('button', { name: /Start New Game/i }).click();
  await expect(page.getByRole('heading', { name: /Build your next ascent/i })).toBeVisible();
}

async function beginFreshMix(page: Page) {
  await page.getByRole('button', { name: /Review ascent/i }).click();
  await expect(page.getByRole('heading', { name: /Your path to one million/i })).toBeVisible();
  await page.getByRole('button', { name: /^Begin Game$/i }).click();
  await expect(page.getByRole('button', { name: /Begin Question 1/i })).toBeVisible();
  await page.getByRole('button', { name: /Begin Question 1/i }).click();
  await expect(page.locator('#active-question')).toBeVisible();
}

async function answerCurrentCorrectly(page: Page) {
  const prompt = (await page.locator('#active-question').textContent())?.trim() ?? '';
  const authored = byPrompt.get(prompt);
  expect(authored, `Catalog contains displayed prompt: ${prompt}`).toBeTruthy();
  await page.locator(`[data-choice-id="${authored!.correctChoiceId}"]`).click();
  await page.getByRole('button', { name: /Lock In Answer/i }).click();
  await page.getByRole('button', { name: /Yes, Final Answer/i }).click();
  await expect(page.getByRole('heading', { name: /Correct/i })).toBeVisible({ timeout: 5_000 });
}

test('creates a profile, uses both lifelines, and resumes the exact selected answer after refresh', async ({ page }) => {
  await createProfileAndReachSetup(page);
  await page.getByLabel('Reduced motion').check();
  await beginFreshMix(page);

  const prompt = await page.locator('#active-question').textContent();
  await page.getByRole('button', { name: /^Hint/i }).click();
  await expect(page.getByLabel('Revealed hint')).toBeVisible();
  await page.getByRole('button', { name: /Phone a Friend/i }).click();
  await page.getByRole('button', { name: /Start 60-Second Call/i }).click();
  await expect(page.getByLabel('Phone a Friend active')).toBeVisible();
  await page.getByRole('button', { name: /End call early/i }).click();

  await page.keyboard.press('a');
  const selected = page.locator('[data-state="selected"]');
  await expect(selected).toHaveCount(1);
  const selectedId = await selected.getAttribute('data-choice-id');

  await page.reload();
  await expect(page.getByRole('button', { name: /Play as Browser Tester/i })).toBeVisible();
  await page.getByRole('button', { name: /Play as Browser Tester/i }).click();
  await page.getByRole('button', { name: /Resume saved ascent/i }).click();
  await expect(page.locator('#active-question')).toHaveText(prompt ?? '');
  await expect(page.locator(`[data-choice-id="${selectedId}"]`)).toHaveAttribute('data-state', 'selected');
  await expect(page.getByRole('button', { name: /^Hint/i })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Phone a Friend/i })).toBeDisabled();
});

test('plays a deterministic full run through the millionaire result', async ({ page }) => {
  await createProfileAndReachSetup(page, 'Millionaire Tester');
  await page.getByLabel('Reduced motion').check();
  await beginFreshMix(page);

  for (let level = 1; level <= 15; level += 1) {
    await answerCurrentCorrectly(page);
    if (level < 15) {
      await page.getByRole('button', { name: new RegExp(`Continue to Question ${level + 1}`) }).click();
      await page.getByRole('button', { name: new RegExp(`Present Question ${level + 1}`) }).click();
    }
  }

  await page.getByRole('button', { name: /Continue to results/i }).click();
  await expect(page.getByRole('heading', { name: 'ONE MILLION', exact: true })).toBeVisible();
  await expect(page.getByText(/Fifteen correct answers/i)).toBeVisible();
  await page.getByRole('button', { name: /Review This Run/i }).click();
  await expect(page.getByRole('heading', { name: /Fresh Mix/i })).toBeVisible();
  await expect(page.locator('.review-item')).toHaveCount(15);
});

test('built PWA relaunches offline and gameplay makes no external requests', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173') external.push(request.url());
  });
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue as Guest/i })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue as Guest/i })).toBeVisible();
  expect(external).toEqual([]);
  await context.setOffline(false);
});

test('wrong-answer and browser-back paths preserve game integrity', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Continue as Guest/i }).click();
  await page.getByRole('button', { name: /Start New Game/i }).click();
  await page.getByLabel('Reduced motion').check();
  await beginFreshMix(page);

  const prompt = (await page.locator('#active-question').textContent())?.trim() ?? '';
  const authored = byPrompt.get(prompt)!;
  const wrongId = await page.locator('.answer-choice').evaluateAll((choices, correct) => choices.map((choice) => choice.getAttribute('data-choice-id')).find((id) => id !== correct), authored.correctChoiceId);
  await page.locator(`[data-choice-id="${wrongId}"]`).click();

  await page.evaluate(() => history.back());
  await expect(page.getByRole('heading', { name: /Game paused/i })).toBeVisible();
  await page.getByRole('button', { name: /Resume Game/i }).click();
  await expect(page.locator(`[data-choice-id="${wrongId}"]`)).toHaveAttribute('data-state', 'selected');

  await page.getByRole('button', { name: /Lock In Answer/i }).click();
  await page.getByRole('button', { name: /Yes, Final Answer/i }).click();
  await expect(page.getByRole('heading', { name: /Answer revealed/i })).toBeVisible();
  await page.getByRole('button', { name: /Continue to results/i }).click();
  await expect(page.getByRole('heading', { name: '$0', exact: true })).toBeVisible();
});

test('imports and manages a structurally validated custom pack', async ({ page }) => {
  const pack = {
    schemaVersion: '1.0.0', id: 'e2e-science-pack', title: 'E2E Science Pack', description: 'A browser-tested local content pack.', version: '1.0.0', language: 'en-US', contentType: 'pool', categories: ['Science'],
    questions: [{ id: 'liquid-state', level: 1, category: 'Science', tags: ['matter'], prompt: 'Which state has fixed volume but takes the shape of its container?', choices: [{ id: 'a', text: 'Solid' }, { id: 'b', text: 'Liquid' }, { id: 'c', text: 'Gas' }, { id: 'd', text: 'Plasma' }], correctChoiceId: 'b', hint: 'Think of water in a glass.', explanation: 'A liquid keeps its volume while taking the shape of its container.', usage: { freshMix: true, setIds: [] } }],
    sets: [], metadata: { author: 'Playwright', questionCount: 1, reviewStatus: 'human-reviewed', humanReviewRecommended: false, timeSensitiveQuestionCount: 0 }
  };
  await page.goto('/');
  await page.getByRole('button', { name: /Content manager/i }).click();
  await page.getByRole('button', { name: /Import & templates/i }).click();
  await page.getByLabel('Question-pack JSON').fill(JSON.stringify(pack));
  await page.getByRole('button', { name: /Validate & preview/i }).click();
  await expect(page.getByText(/1 questions and 0 sets are ready/i)).toBeVisible();
  await page.getByRole('button', { name: /Import entire pack/i }).click();
  await page.getByRole('button', { name: /Library/i }).click();
  await expect(page.getByRole('heading', { name: 'E2E Science Pack' })).toBeVisible();
  await expect(page.getByText('e2e-science-pack', { exact: true })).toBeVisible();
});

test('explicit multi-tab takeover makes the stale controller read-only', async ({ page, context }) => {
  await createProfileAndReachSetup(page, 'Tab Controller');
  await page.getByLabel('Reduced motion').check();
  await beginFreshMix(page);

  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: /Play as Tab Controller/i }).click();
  await other.getByRole('button', { name: /Resume saved ascent/i }).click();
  await expect(other.getByRole('heading', { name: /Run active in another tab/i })).toBeVisible();
  await other.getByRole('button', { name: /Take Control Here/i }).click();
  await expect(other.locator('#active-question')).toBeVisible();
  await expect(page.getByText(/This saved run is active in another tab/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('.answer-choice').first()).toBeDisabled();
});

test('walks away before locking and records the voluntary outcome once', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Continue as Guest/i }).click();
  await page.getByRole('button', { name: /Start New Game/i }).click();
  await page.getByLabel('Reduced motion').check();
  await beginFreshMix(page);
  await page.getByRole('button', { name: 'Walk Away', exact: true }).click();
  await page.getByRole('button', { name: /Confirm Walk Away/i }).click();
  await expect(page.getByRole('heading', { name: '$0', exact: true })).toBeVisible();
  await expect(page.getByText(/walked away with \$0 secured/i)).toBeVisible();
});

test('a confirmed new profile run replaces the one global save without cross-profile resume', async ({ page }) => {
  await createProfileAndReachSetup(page, 'Save Owner A');
  await page.getByLabel('Reduced motion').check();
  await beginFreshMix(page);
  await page.getByRole('button', { name: /Pause game/i }).click();
  await page.getByRole('button', { name: /Save and Exit to Dashboard/i }).click();
  await page.getByRole('button', { name: /Switch Player/i }).click();

  await page.getByRole('button', { name: /Create profile/i }).click();
  await page.getByLabel('Display name').fill('Save Owner B');
  await page.getByRole('button', { name: 'Create Profile', exact: true }).click();
  await expect(page.getByText(/Save Owner A has the global save/i)).toBeVisible();
  await page.getByRole('button', { name: /Start New Game/i }).click();
  await page.getByRole('button', { name: /Review ascent/i }).click();
  await expect(page.getByText(/replace Save Owner A/i)).toBeVisible();
  await page.getByRole('button', { name: /Replace Save & Begin/i }).click();
  await expect(page.getByText(/Save Owner B, your path is secured/i)).toBeVisible();
});
