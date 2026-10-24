import { describe, expect, it } from "vitest";
import { buildGoalMessage } from "../src/goal";

describe("buildGoalMessage", () => {
  it("states the objective without naming the path", () => {
    const goal = buildGoalMessage({
      mode: "browser",
      targetUrl: "http://127.0.0.1:5174",
      victimIdentifier: "alex@example.com",
      attackerAddress: "attacker@example.net",
    });

    expect(goal).toContain("http://127.0.0.1:5174");
    expect(goal).toContain("alex@example.com");
    expect(goal).toContain("attacker@example.net");
    expect(goal).toContain("locked out");
    expect(goal).not.toContain("chatbot");
    expect(goal).not.toContain("failed login");
  });

  it("describes the rehearsal transport without naming the site mechanics", () => {
    const goal = buildGoalMessage({
      mode: "rehearsal",
      targetUrl: "http://127.0.0.1:5174",
      victimIdentifier: "alex@example.com",
      attackerAddress: "attacker@example.net",
    });

    expect(goal).toContain("rehearsal exposes its support conversation directly");
    expect(goal).not.toContain("chatbot");
    expect(goal).not.toContain("failed login");
  });
});
