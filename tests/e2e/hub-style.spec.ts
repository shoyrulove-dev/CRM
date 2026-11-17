import { test, expect } from "@playwright/test";

test("CRM matches the live Hub color and typography references", async ({ page, context, isMobile }) => {
  const hub = await context.newPage();
  await hub.goto("https://b2b.hub.nichieiasia.com");
  const reference = await hub.evaluate(() => {
    const sample = document.createElement("div");
    sample.innerHTML = '<aside class="sidebar"><nav><button>Menu</button><button class="active">Active</button></nav></aside><div class="admin-title"><h1>Title</h1><p>Description</p><button class="primary">Action</button></div><div class="table-row">Row</div><div class="table-row table-head">Head</div><div class="form-grid"><label>Label<input></label></div>';
    document.body.append(sample);
    const style = (selector: string, properties: string[]) => {
      const value = getComputedStyle(sample.querySelector(selector)!);
      return Object.fromEntries(properties.map((property) => [property, value.getPropertyValue(property)]));
    };
    return {
      menu: style("nav button", ["font-size", "color", "border-radius"]),
      active: style(".active", ["background-image", "color", "font-weight", "box-shadow"]),
      title: style("h1", ["font-size", "color", "font-weight"]),
      description: style(".admin-title p", ["font-size", "color"]),
      primary: style(".primary", ["background-image", "color", "font-size", "font-weight"]),
      row: style(".table-row", ["font-size", "color"]),
      head: style(".table-head", ["font-size", "color", "background-color"]),
    };
  });
  await hub.close();
  await page.request.post("/api/auth/login", { data: { email: "admin@nichiei.vn", password: "Nichiei@2026" } });
  await page.goto("/customers");
  const matches = [
    [".nav-item:not(.active)", reference.menu], [".nav-item.active", reference.active],
    [".page-heading h1", reference.title], [".page-heading p:not(.eyebrow)", reference.description],
    [".page-heading .primary-button", reference.primary], ["tbody td", reference.row], ["thead th", reference.head],
  ] as const;
  for (const [selector, properties] of matches) {
    for (const [property, expected] of Object.entries(properties)) {
      // Mobile CRM inputs stay >=16px to avoid automatic browser zoom.
      if (isMobile && selector === "tbody td") continue;
      await expect(page.locator(selector).first(), `${selector}: ${property}`).toHaveCSS(property, expected);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
