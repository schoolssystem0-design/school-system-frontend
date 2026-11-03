import { describe, expect, it } from "vitest";
import { safeNextPath, validateSignIn } from "./sign-in-schema";

describe("validateSignIn", () => {
  it("normalises the school code to upper case", () => {
    const result = validateSignIn({ schoolCode: " nns-1 ", username: " admin ", password: "x" });
    expect(result).toEqual({
      ok: true,
      values: { schoolCode: "NNS-1", username: "admin", password: "x" },
    });
  });

  it("reports every missing field", () => {
    const result = validateSignIn({ schoolCode: "", username: "", password: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["password", "schoolCode", "username"]);
    }
  });

  it("rejects unsafe characters in the school code", () => {
    const result = validateSignIn({ schoolCode: "NNS<script>", username: "a", password: "b" });
    expect(result.ok).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("only allows paths inside the portal", () => {
    expect(safeNextPath("/app/students")).toBe("/app/students");
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("//evil.example")).toBe("/app");
    expect(safeNextPath(null)).toBe("/app");
  });
});
