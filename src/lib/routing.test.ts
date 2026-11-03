import { describe, expect, it } from "vitest";
import { decideRoute, platformHosts } from "./routing";

const platform = platformHosts("app.example.com,localhost");
const base = { platform, hasSession: false };

describe("decideRoute", () => {
  it("rewrites a school's own domain to its website", () => {
    expect(decideRoute({ ...base, host: "www.nns.edu.pk", pathname: "/" })).toEqual({
      kind: "rewrite",
      pathname: "/site/www.nns.edu.pk",
    });
    expect(decideRoute({ ...base, host: "WWW.NNS.EDU.PK:443", pathname: "/news" })).toEqual({
      kind: "rewrite",
      pathname: "/site/www.nns.edu.pk/news",
    });
  });

  it("does not expose website routes on the platform host", () => {
    expect(decideRoute({ ...base, host: "app.example.com", pathname: "/site/other.pk" })).toEqual({
      kind: "redirect",
      pathname: "/",
    });
  });

  it("turns the /s/<code> shortcut into a pre-filled sign-in", () => {
    expect(decideRoute({ ...base, host: "localhost:3000", pathname: "/s/nns" })).toEqual({
      kind: "redirect",
      pathname: "/sign-in",
      search: { school: "NNS" },
    });
  });

  it("sends visitors without a session from the portal to sign-in", () => {
    expect(decideRoute({ ...base, host: "app.example.com", pathname: "/app/students" })).toEqual({
      kind: "redirect",
      pathname: "/sign-in",
      search: { next: "/app/students" },
    });
    expect(
      decideRoute({ ...base, hasSession: true, host: "app.example.com", pathname: "/app" }),
    ).toEqual({ kind: "next" });
  });

  it("sends visitors without a session from the platform console to its sign-in", () => {
    expect(decideRoute({ ...base, host: "app.example.com", pathname: "/platform/schools/new" })).toEqual({
      kind: "redirect",
      pathname: "/platform/sign-in",
    });
    expect(decideRoute({ ...base, host: "app.example.com", pathname: "/platform/sign-in" })).toEqual({ kind: "next" });
  });

  it("lets sign-in through", () => {
    expect(decideRoute({ ...base, host: "app.example.com", pathname: "/sign-in" })).toEqual({
      kind: "next",
    });
  });
});
