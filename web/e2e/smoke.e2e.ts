import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** Plays whatever card is on screen until the end screen appears. Cards are random, so this handles every type. */
async function playSet(page: Page) {
  for (let step = 0; step < 12; step++) {
    if (await page.getByText(/You learned/).isVisible()) return;
    const text = await page.locator("body").innerText();

    if (/Drill/.test(text)) {
      // Drills are timed, so skip them with the keyboard (as a swipe would) to keep the test independent of machine speed.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press("ArrowRight");
    } else if (await page.getByRole("button", { name: "Why?" }).isVisible()) {
      await page.getByRole("button", { name: "Why?" }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
    } else if (await page.getByRole("button", { name: "Lock it in" }).isVisible()) {
      await page.getByRole("button", { name: "Lock it in" }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
    } else if (await page.getByLabel(/Next (panel|card)/).isVisible()) {
      // Story: tap through the panels.
      for (let i = 0; i < 6 && (await page.getByLabel(/Next (panel|card)/).isVisible()); i++) {
        await page.getByLabel(/Next (panel|card)/).click();
      }
    } else {
      // Guess first or a recall question: pick the first answer option.
      const options = page.locator("button").filter({ hasNotText: /^(Sources|Report|\u24D8|Next|Check)$/ });
      if ((await options.count()) === 0) {
        await page.waitForTimeout(300); // screen is still changing
        continue;
      }
      await options.first().click();
      await page.getByRole("button", { name: "Next", exact: true }).click({ timeout: 5000 });
    }
    await page.waitForTimeout(150);
  }
}

test("first run: pick interests, finish a set, see the end screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Want to pick up a language/ })).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("heading", { name: /What are you curious about/ })).toBeVisible();

  const go = page.getByRole("button", { name: /Pick 3 more/ });
  await expect(go).toBeDisabled();
  for (const name of ["History", "Science", "Money & Markets"]) await page.getByRole("button", { name }).first().click();
  await page.getByRole("button", { name: "Show me a quick one" }).click();

  await playSet(page);
  await expect(page.getByText("We'll check tomorrow if they stuck.")).toBeVisible();
});

test("progress and settings work after a set", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Not now" }).click();
  for (const name of ["History", "Science", "Tech"]) await page.getByRole("button", { name }).first().click();
  await page.getByRole("button", { name: "Show me a quick one" }).click();
  await playSet(page);

  await page.getByRole("button", { name: "See my progress" }).click();
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
  await expect(page.getByText(/1 day/)).toBeVisible();

  await page.getByRole("button", { name: /Browse what you've learned/ }).click();
  await expect(page.getByRole("heading", { name: "What you've learned" })).toBeVisible();
  await expect(page.getByPlaceholder("Search your cards")).toBeVisible();
  await expect(page.getByRole("list").getByRole("button").first()).toBeVisible();
  await page.getByRole("button", { name: "← Progress" }).click();

  await page.getByRole("button", { name: /Settings/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress" }).click();
  expect((await download).suggestedFilename()).toMatch(/^detour-progress-\d{4}-\d{2}-\d{2}\.json$/);
});

test("pick something specific: the skills page and a round of one math skill", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Not now" }).click();
  for (const name of ["History", "Science", "Tech"]) await page.getByRole("button", { name }).first().click();
  await page.getByRole("button", { name: "Show me a quick one" }).click();
  await playSet(page);
  await page.getByRole("button", { name: "Pick another round" }).click();

  await page.getByRole("button", { name: "Pick something specific" }).click();
  await page.getByRole("tab", { name: "Math" }).click();
  await page.getByRole("button", { name: /Choose your skills/ }).click();
  await expect(page.getByRole("heading", { name: "Your math skills" })).toBeVisible();
  await page.getByRole("switch", { name: /Estimation/ }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("tab", { name: "Math" }).click();
  await expect(page.getByText("10 of 11 on in your rounds")).toBeVisible();

  await page.getByRole("button", { name: /Geometry/ }).click();
  await expect(page.getByText("Drill · Geometry")).toBeVisible();
});

test("chess, hard: play a mate in two or three move by move", async ({ page }) => {
  // The first hard puzzle is the lowest-rated one, because the test fixes the random pick at zero.
  const data = JSON.parse(readFileSync("../content/games/chess.json", "utf8")) as { hard: { rating: number; line: string[]; mates: string[] }[] };
  const puzzle = [...data.hard].sort((a, b) => a.rating - b.rating)[0]!;

  await page.goto("/");
  await page.getByRole("button", { name: "Not now" }).click();
  for (const name of ["History", "Science", "Tech"]) await page.getByRole("button", { name }).first().click();
  await page.getByRole("button", { name: "Show me a quick one" }).click();
  await playSet(page);
  await page.getByRole("button", { name: "Pick another round" }).click();
  await page.getByRole("button", { name: /Games/ }).click();
  await page.getByRole("button", { name: "Hard" }).click();
  await page.evaluate(() => (Math.random = () => 0));
  await page.getByRole("button", { name: /Chess tactics/ }).click();

  const square = (name: string) => page.getByRole("button", { name: new RegExp(`^${name}( |$)`) });
  const move = async (uci: string) => {
    await square(uci.slice(0, 2)).click();
    await square(uci.slice(2, 4)).click();
  };
  const line = puzzle.line;
  await expect(page.getByText(/Find checkmate in (two|three)/)).toBeVisible();
  for (let i = 0; i < line.length - 1; i += 2) {
    await move(line[i]!);
    if (i + 2 < line.length) await expect(page.getByText(/Good\. Now find/)).toBeVisible({ timeout: 4000 });
  }
  await move(line[line.length - 1]!);
  await expect(page.getByText("Checkmate! Lovely.")).toBeVisible();
});

test("math round: one tap on Next goes straight to the next problem", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Not now" }).click();
  for (const name of ["History", "Science", "Tech"]) await page.getByRole("button", { name }).first().click();
  await page.getByRole("button", { name: "Show me a quick one" }).click();
  await playSet(page);
  await page.getByRole("button", { name: "Pick another round" }).click();
  await page.getByRole("button", { name: /Math round/ }).click();

  const answer = page.getByLabel("Your answer");
  await expect(answer).toBeVisible();
  const first = await page.locator("h1").first().innerText();
  await answer.fill("1");
  await page.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // No "1 of 1 right" screen in between: the next problem (a different skill) is already there.
  await expect(page.getByText(/of 1 right/)).toHaveCount(0);
  await expect(answer).toBeVisible();
  await expect(page.locator("h1").first()).not.toHaveText(first);
});
