/**
 * Repeating (rhei) helpers kept pure so they can be unit-tested.
 */

export interface ShadowCandidate {
  text: string;
  rheiItemId?: string;
  rheiShadow?: boolean;
}

export interface RheiLike {
  id: string;
  text: string;
}

/**
 * A rhei-tap shadow: the daily task auto-created when a Repeating item is tapped.
 * It is represented by the item itself, so it stays out of the daily list, the
 * pomodoro picker and carry-forward.
 *
 * New shadows carry an explicit `rheiShadow` flag, so they survive a rename of the
 * item. Older shadows have no flag and are recognized by matching the item's text;
 * renaming an item rewrites those (see handleSaveRheiEdit) so they keep matching.
 */
export function isRheiShadowTask(t: ShadowCandidate, items: RheiLike[]): boolean {
  if (!t.rheiItemId) return false;
  if (t.rheiShadow) return true;
  return items.some(r => r.id === t.rheiItemId && r.text === t.text);
}
