import { test, expect, type Response } from '@playwright/test';

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });

    await test.step('Verify game cards show a rating value or fallback text', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      await expect(firstGameCard.getByTestId('game-rating')).not.toBeEmpty();
    });
  });

  test('should filter games by category', async ({ page }) => {
    await test.step('Navigate to homepage and capture one category id', async () => {
      await page.goto('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });

    const firstGameCard = page.getByTestId('game-card').first();
    const categoryId = await firstGameCard.getAttribute('data-game-category-id');
    expect(categoryId).toBeTruthy();

    await test.step('Apply a category filter', async () => {
      const categoryCheckbox = page.locator(`[data-testid="category-filter-${categoryId}"]`);
      await categoryCheckbox.check();
    });

    await test.step('Verify only matching-category cards remain visible', async () => {
      const visibleGameCards = page.locator('[data-testid="game-card"]:visible');
      const visibleCount = await visibleGameCards.count();
      expect(visibleCount).toBeGreaterThan(0);

      for (let index = 0; index < visibleCount; index++) {
        await expect(visibleGameCards.nth(index)).toHaveAttribute('data-game-category-id', categoryId ?? '');
      }
    });
  });

  test('should filter games by publisher', async ({ page }) => {
    await test.step('Navigate to homepage and capture one publisher id', async () => {
      await page.goto('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });

    const firstGameCard = page.getByTestId('game-card').first();
    const publisherId = await firstGameCard.getAttribute('data-game-publisher-id');
    expect(publisherId).toBeTruthy();

    await test.step('Apply a publisher filter', async () => {
      await page.getByTestId('publisher-filter-select').selectOption(publisherId ?? '');
    });

    await test.step('Verify only matching-publisher cards remain visible', async () => {
      const visibleGameCards = page.locator('[data-testid="game-card"]:visible');
      const visibleCount = await visibleGameCards.count();
      expect(visibleCount).toBeGreaterThan(0);

      for (let index = 0; index < visibleCount; index++) {
        await expect(visibleGameCards.nth(index)).toHaveAttribute('data-game-publisher-id', publisherId ?? '');
      }
    });
  });

  test('should combine category and publisher filters', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });

    const firstGameCard = page.getByTestId('game-card').first();
    const categoryId = await firstGameCard.getAttribute('data-game-category-id');
    const publisherId = await firstGameCard.getAttribute('data-game-publisher-id');
    expect(categoryId).toBeTruthy();
    expect(publisherId).toBeTruthy();

    await test.step('Apply category and publisher filters together', async () => {
      await page.locator(`[data-testid="category-filter-${categoryId}"]`).check();
      await page.getByTestId('publisher-filter-select').selectOption(publisherId ?? '');
    });

    await test.step('Verify visible cards satisfy both filters', async () => {
      const visibleGameCards = page.locator('[data-testid="game-card"]:visible');
      const visibleCount = await visibleGameCards.count();
      expect(visibleCount).toBeGreaterThan(0);

      for (let index = 0; index < visibleCount; index++) {
        await expect(visibleGameCards.nth(index)).toHaveAttribute('data-game-category-id', categoryId ?? '');
        await expect(visibleGameCards.nth(index)).toHaveAttribute('data-game-publisher-id', publisherId ?? '');
      }
    });
  });

  test('should clear category and publisher filters', async ({ page }) => {
    await test.step('Navigate to homepage and capture total card count', async () => {
      await page.goto('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });

    const totalGameCardCount = await page.getByTestId('game-card').count();
    const firstGameCard = page.getByTestId('game-card').first();
    const categoryId = await firstGameCard.getAttribute('data-game-category-id');
    expect(categoryId).toBeTruthy();

    await test.step('Apply one category filter', async () => {
      await page.locator(`[data-testid="category-filter-${categoryId}"]`).check();
      await expect(page.locator('input[name="category-filter"]:checked')).toHaveCount(1);
    });

    await test.step('Clear all filters and verify reset state', async () => {
      await page.getByTestId('clear-filters-button').click();
      await expect(page.locator('input[name="category-filter"]:checked')).toHaveCount(0);
      await expect(page.getByTestId('publisher-filter-select')).toHaveValue('');
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(totalGameCardCount);
      await expect(page.getByTestId('filtered-empty-state')).toHaveClass(/hidden/);
    });
  });

  test('should show an empty-state message when combined filters match no games', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });

    const noMatchPair = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="game-card"]')).map((card) => ({
        categoryId: card.getAttribute('data-game-category-id') ?? '',
        publisherId: card.getAttribute('data-game-publisher-id') ?? '',
      }));
      const categoryIds = Array.from(new Set(cards.map((card) => card.categoryId)));
      const publisherIds = Array.from(new Set(cards.map((card) => card.publisherId)));

      for (const categoryId of categoryIds) {
        for (const publisherId of publisherIds) {
          const hasMatch = cards.some((card) => (
            card.categoryId === categoryId && card.publisherId === publisherId
          ));

          if (!hasMatch) {
            return { categoryId, publisherId };
          }
        }
      }

      return null;
    });

    test.skip(noMatchPair === null, 'Dataset includes every category/publisher combination.');

    await test.step('Apply a category and publisher pair with no intersection', async () => {
      await page.locator(`[data-testid="category-filter-${noMatchPair?.categoryId}"]`).check();
      await page.getByTestId('publisher-filter-select').selectOption(noMatchPair?.publisherId ?? '');
    });

    await test.step('Verify no cards are visible and filter empty state is shown', async () => {
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(0);
      await expect(page.getByTestId('filtered-empty-state')).not.toHaveClass(/hidden/);
      await expect(page.getByTestId('empty-state-text')).toHaveText('No games match your current filters.');
      await expect(page.getByTestId('filter-results-count')).toHaveText(/Showing 0 of \d+ games/);
    });
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});
