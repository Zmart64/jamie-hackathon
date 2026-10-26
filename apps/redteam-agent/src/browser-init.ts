interface InitPage {
  goto(url: string, options?: { waitUntil?: "domcontentloaded" }): Promise<unknown>;
}

interface InitContext {
  page: InitPage;
}

export default async function openTarget({ page }: InitContext): Promise<void> {
  const target = process.env.REDTEAM_TARGET_URL;
  if (target === undefined || target === "") return;
  try {
    await page.goto(target, { waitUntil: "domcontentloaded" });
  } catch {
    // The demo may not be running yet; the agent can navigate later.
  }
}
