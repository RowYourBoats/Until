import { describe, it, expect } from "vitest";
import { isRheiShadowTask } from "./rhei";

const items = [
  { id: "ex", text: "Exercise" },
  { id: "rd", text: "Reading" },
];

describe("isRheiShadowTask", () => {
  it("is false for a task not linked to a Repeating item", () => {
    expect(isRheiShadowTask({ text: "Exercise" }, items)).toBe(false);
  });

  it("recognizes a legacy shadow by matching the item's text", () => {
    expect(isRheiShadowTask({ text: "Exercise", rheiItemId: "ex" }, items)).toBe(true);
  });

  it("recognizes a flagged shadow even after the item is renamed", () => {
    const renamed = [{ id: "ex", text: "Movement" }];
    expect(isRheiShadowTask({ text: "Exercise", rheiItemId: "ex", rheiShadow: true }, renamed)).toBe(true);
  });

  it("does not treat an unflagged task as a shadow once the text differs", () => {
    const renamed = [{ id: "ex", text: "Movement" }];
    expect(isRheiShadowTask({ text: "Exercise", rheiItemId: "ex" }, renamed)).toBe(false);
  });

  it("does not treat an 'Item - sub' sub-task as a shadow", () => {
    expect(isRheiShadowTask({ text: "Exercise - stretch", rheiItemId: "ex" }, items)).toBe(false);
  });

  it("does not match another item's text", () => {
    expect(isRheiShadowTask({ text: "Reading", rheiItemId: "ex" }, items)).toBe(false);
  });

  it("still recognizes shadows of archived or deleted items while they're in the list", () => {
    const archived = [{ id: "ex", text: "Exercise", archivedAt: "2026-01-01T00:00:00.000Z" }];
    expect(isRheiShadowTask({ text: "Exercise", rheiItemId: "ex" }, archived)).toBe(true);
  });
});
