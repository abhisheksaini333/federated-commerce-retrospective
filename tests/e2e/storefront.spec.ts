import { test, expect } from "@playwright/test";

test("synthetic catalog to checkout to fulfilled order", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good things, for everyday." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Everyday notebook" }).click();
  await page.getByRole("button", { name: "Bag (1)" }).click();
  await page.getByLabel("Quantity for Everyday notebook").selectOption("2");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page.getByLabel("Demo name").fill("Morgan Demo");
  await expect(page.getByTestId("checkout-total")).toHaveText("$54.00");
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect(
    page.getByRole("heading", { name: "A good day for good things." }),
  ).toBeVisible();
  const id = await page.getByTestId("order-id").textContent();
  await page.getByRole("button", { name: "Order desk" }).click();
  const row = page.getByRole("row").filter({ hasText: id! });
  await expect(row).toContainText("Morgan Demo");
  await row.getByRole("button", { name: "Mark fulfilled" }).click();
  await expect(row).toContainText("fulfilled");
});

test("catalog filters, search and bag removal work without navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add Sunday carryall" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Everyday notebook" }),
  ).toHaveCount(0);
  await page.getByLabel("Search the collection").fill("nonexistent");
  await expect(page.getByText("No finds just yet.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Add The pencil set" }).click();
  await page.getByRole("button", { name: "Bag (1)" }).click();
  await page.getByRole("button", { name: "Remove The pencil set" }).click();
  await expect(
    page.getByText("Your next everyday favorite is waiting."),
  ).toBeVisible();
});

test("in-flight checkout locks navigation until the response settles", async ({
  page,
}) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/checkout", async (route) => {
    const response = await route.fetch();
    await responseGate;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Add The pencil set" }).click();
  await page.getByRole("button", { name: "Bag (1)" }).click();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page.getByRole("button", { name: "Place demo order" }).click();
  try {
    await expect(
      page.getByRole("button", { name: "Placing your demo order…" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Shop", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Order desk" }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Bag (1)" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Fieldwork Supply home" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Back to your bag" }),
    ).toBeDisabled();
  } finally {
    releaseResponse();
  }
  await expect(
    page.getByRole("heading", { name: "A good day for good things." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Shop", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Bag (0)" })).toBeEnabled();
});

test("unavailable catalog remote leaves shell and bag useful, reload recovers", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:4311/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The collection is taking a moment." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bag (0)" }).click();
  await expect(
    page.getByText("Your next everyday favorite is waiting."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Shop", exact: true }).click();
  await page.unroute("http://127.0.0.1:4311/**");
  await page.getByRole("button", { name: "Reload collection" }).click();
  await expect(
    page.getByRole("button", { name: "Add Everyday notebook" }),
  ).toBeVisible();
});

test("unavailable cart remote offers saved bag summary and recovery", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:4312/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Add Everyday notebook" }).click();
  await page.getByRole("button", { name: "Bag (1)" }).click();
  await expect(
    page.getByRole("heading", { name: "Your bag is saved." }),
  ).toBeVisible();
  await expect(page.getByText("1 item · $24.00")).toBeVisible();
  await page.unroute("http://127.0.0.1:4312/**");
  await page.getByRole("button", { name: "Reload bag" }).click();
  await expect(
    page.getByRole("button", { name: "Continue to checkout" }),
  ).toBeVisible();
  await expect(page.getByLabel("Quantity for Everyday notebook")).toHaveValue(
    "1",
  );
});

test("API outage has visible retry and recovers without a full page reload", async ({
  page,
}) => {
  await page.route("**/api/products", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "Demo catalog service is offline.",
        code: "API_UNAVAILABLE",
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Demo catalog service is offline.",
  );
  await page.unroute("**/api/products");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("button", { name: "Add Everyday notebook" }),
  ).toBeVisible();
});

for (const storageBlocked of [false, true]) {
  test(`lost checkout response retries the same key and creates exactly one order${storageBlocked ? " with storage disabled" : ""}`, async ({
    page,
    request,
  }) => {
    if (storageBlocked)
      await page.addInitScript(() => {
        Object.defineProperty(Storage.prototype, "setItem", {
          value() {
            throw new DOMException("Storage blocked", "SecurityError");
          },
        });
      });
    const before = (await (await request.get("/api/orders")).json()).orders
      .length;
    const keys: string[] = [];
    await page.route("**/api/checkout", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (keys.length === 1) {
        await route.fetch();
        await route.abort("connectionfailed");
      } else await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Add Everyday notebook" }).click();
    await page.getByRole("button", { name: "Bag (1)" }).click();
    await page.getByRole("button", { name: "Continue to checkout" }).click();
    await page.getByRole("button", { name: "Place demo order" }).click();
    await expect(page.getByRole("alert")).toContainText("Your bag is saved");
    await page.getByRole("button", { name: "Place demo order" }).click();
    await expect(
      page.getByRole("heading", { name: "A good day for good things." }),
    ).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(
      (await (await request.get("/api/orders")).json()).orders,
    ).toHaveLength(before + 1);
  });
}

test("mobile layout fits the viewport and preserves accessible shopping controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add Everyday notebook" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "evidence/2026-09-29-mobile.png",
    fullPage: true,
  });
});

test("desktop storefront has no uncaught errors on the healthy path", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    errors.push(`Failed request: ${request.url()}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add Catchall tray" }),
  ).toBeVisible();
  await page.screenshot({
    path: "evidence/2026-09-29-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
