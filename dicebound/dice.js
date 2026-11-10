// =====================================================================
// Dice logic and the Dice Bag.
// =====================================================================

const Dice = {
  // One fair six-sided die.
  d6() {
    return 1 + Math.floor(Math.random() * 6);
  },

  // Two independent d6 added together. This is what produces the
  // correct bell curve (7 is 6x more likely than 2 or 12).
  // Never replace this with a uniform 2..12 roll.
  roll2d6() {
    const a = Dice.d6();
    const b = Dice.d6();
    return { a, b, sum: a + b };
  },

  d100() {
    return 1 + Math.floor(Math.random() * 100);
  },

  // Exact probability of rolling `sum` on 2d6: number of combinations / 36.
  probability2d6(sum) {
    return (6 - Math.abs(sum - 7)) / 36;
  },

  // Exact distribution of the sum when `loaded` dice (0..2) reroll a 1 once.
  // A loaded die shows 1 with chance 1/36 and 2..6 with chance 7/36 each.
  distribution(loaded = 0) {
    const fair = [0, 1, 1, 1, 1, 1, 1].map(v => v / 6);
    const load = [0, 1 / 36, 7 / 36, 7 / 36, 7 / 36, 7 / 36, 7 / 36];
    const A = loaded >= 1 ? load : fair;
    const B = loaded >= 2 ? load : fair;
    const out = {};
    for (let s = 2; s <= 12; s++) out[s] = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) out[a + b] += A[a] * B[b];
    return out;
  }
};

// The Dice Bag maps each 2d6 result (2..12) to an action id.
class DiceBag {
  constructor(layout) {
    this.slots = {};
    this.timesRolled = {};
    for (let s = 2; s <= 12; s++) {
      this.slots[s] = layout[s];
      this.timesRolled[s] = 0;
    }
  }

  actionFor(sum) {
    return this.slots[sum];
  }

  record(sum) {
    this.timesRolled[sum]++;
  }

  // Replace a slot's action (Dice Bag swap reward).
  setSlot(sum, actionId) {
    this.slots[sum] = actionId;
  }

  // Randomly re-assign the bag's actions to the numbers 2..12.
  // pairSwaps = null shuffles everything; a number swaps only that many random pairs.
  shuffle(pairSwaps = null) {
    const keys = Object.keys(this.slots).map(Number);
    const values = keys.map(k => this.slots[k]);
    if (pairSwaps == null) {
      // Fisher-Yates
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
    } else {
      for (let n = 0; n < pairSwaps; n++) {
        const i = Math.floor(Math.random() * values.length);
        const j = Math.floor(Math.random() * values.length);
        [values[i], values[j]] = [values[j], values[i]];
      }
    }
    keys.forEach((k, i) => { this.slots[k] = values[i]; });
  }
}
