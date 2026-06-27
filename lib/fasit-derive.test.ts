import { test } from "node:test"
import assert from "node:assert/strict"
import { bestThirdOutcome, type ThirdRecord } from "./fasit-derive"

const rec = (letter: string, finished: boolean, pts: number, gd: number, gf: number): ThirdRecord => ({
  letter,
  finished,
  pts,
  gd,
  gf,
})

test("clinched: the best third is in even if every unfinished group beats it", () => {
  // The real Sweden case: top of the third-placed table, only J/K/L unplayed.
  const rows = [
    rec("F", true, 4, 0, 7), // Sweden (us)
    rec("E", true, 4, 0, 2),
    rec("B", true, 4, -1, 5),
    rec("D", true, 4, -2, 2),
    rec("I", true, 3, 2, 8),
    rec("G", true, 3, 0, 3),
    rec("A", true, 3, -1, 2),
    rec("C", true, 3, -3, 1),
    rec("H", true, 2, -1, 3),
    rec("J", false, 3, -2, 2),
    rec("K", false, 1, -1, 1),
    rec("L", false, 3, -1, 3),
  ]
  assert.equal(bestThirdOutcome(rows, "F"), "in")
})

test("eliminated: eight finished thirds already strictly ahead", () => {
  const rows = [
    rec("F", true, 1, -5, 1), // us, far behind
    rec("A", true, 6, 5, 8),
    rec("B", true, 6, 4, 7),
    rec("C", true, 5, 3, 6),
    rec("D", true, 5, 2, 5),
    rec("E", true, 4, 2, 4),
    rec("G", true, 4, 1, 3),
    rec("H", true, 4, 0, 3),
    rec("I", true, 3, 1, 4), // ← eighth team ahead
    rec("J", false, 0, -3, 0),
    rec("K", false, 0, -2, 1),
    rec("L", false, 0, -4, 0),
  ]
  assert.equal(bestThirdOutcome(rows, "F"), "out")
})

test("undecided: a mid-table third with enough groups still in play", () => {
  const rows = [
    rec("F", true, 3, 0, 3), // us
    rec("A", true, 4, 2, 5),
    rec("B", true, 4, 1, 4),
    rec("C", true, 0, -3, 0),
    rec("D", true, 0, -2, 1),
    rec("E", true, 0, -4, 0),
    rec("G", false, 0, 0, 0),
    rec("H", false, 0, 0, 0),
    rec("I", false, 0, 0, 0),
    rec("J", false, 0, 0, 0),
    rec("K", false, 0, 0, 0),
    rec("L", false, 0, 0, 0),
  ]
  // 2 finished strictly ahead (< 8 → not out); 6 unfinished + 2 finished could be
  // ahead = 8 (≥ 8 → not in) → genuinely undecided.
  assert.equal(bestThirdOutcome(rows, "F"), "unknown")
})

test("boundary (all groups finished): 7 ahead → in, 8 ahead → out", () => {
  const ahead = (n: number) =>
    Array.from({ length: n }, (_, i) => rec(`X${i}`, true, 9, 9, 9))
  const behind = (n: number) =>
    Array.from({ length: n }, (_, i) => rec(`Y${i}`, true, 0, 0, 0))
  const me = rec("F", true, 3, 0, 3)

  assert.equal(bestThirdOutcome([me, ...ahead(7), ...behind(4)], "F"), "in")
  assert.equal(bestThirdOutcome([me, ...ahead(8), ...behind(3)], "F"), "out")
})

test("tie-safety: teams level on pts/GD/GF are treated as possibly ahead", () => {
  // With one spot left and an exact tie, the outcome is not yet certain.
  const rows = [rec("F", true, 4, 0, 5), rec("E", true, 4, 0, 5)]
  assert.equal(bestThirdOutcome(rows, "F", 1), "unknown")
})
