// =====================================================================
// DOM UI: HUD bars, dice, Dice Bag, level-up and end screens.
// =====================================================================

// Look per action kind: color + simple glyph.
const KIND_STYLE = {
  bad:     { color: "#ef4444", icon: "✕" },
  attack:  { color: "#f97316", icon: "⚔" },
  special: { color: "#a855f7", icon: "★" },
  heal:    { color: "#22c55e", icon: "✚" },
  move:    { color: "#3b82f6", icon: "➜" },
  defend:  { color: "#06b6d4", icon: "◯" }
};

// Pip layout on a 3x3 grid (cells 1..9).
const PIP_CELLS = {
  1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
};

const $ = id => document.getElementById(id);

const UI = {
  init(bag) {
    this.bag = bag;
    this.buildBag();
    this.drawDie($("die1"), 1);
    this.drawDie($("die2"), 1);
  },

  // ---------- HUD ----------
  updateHud(player, stageLabel) {
    $("hpFill").style.width = (100 * player.hp / player.maxHp) + "%";
    $("hpText").textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    $("expFill").style.width = (100 * player.exp / player.expToNext) + "%";
    $("expText").textContent = `${player.exp} / ${player.expToNext}`;
    $("levelText").textContent = `LV ${player.level}`;
    $("stageText").textContent = stageLabel;
  },

  updateBossBar(boss) {
    const show = boss && boss.active && !boss.dead;
    $("bossBar").style.display = show ? "flex" : "none";
    if (show) $("bossFill").style.width = (100 * boss.hp / boss.maxHp) + "%";
  },

  setAction(text, kind) {
    const el = $("actionText");
    el.textContent = text;
    el.style.color = kind ? KIND_STYLE[kind].color : "#6b7280";
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  },

  // ---------- Dice ----------
  drawDie(el, value) {
    el.innerHTML = "";
    for (const cell of PIP_CELLS[value]) {
      const pip = document.createElement("i");
      pip.style.gridRow = Math.ceil(cell / 3);
      pip.style.gridColumn = ((cell - 1) % 3) + 1;
      el.appendChild(pip);
    }
  },

  // Tumble both dice for `ms`, then land on the real values.
  async animateRoll(a, b, ms) {
    const d1 = $("die1"), d2 = $("die2");
    $("sumText").textContent = "?";
    this.clearHighlight();
    d1.classList.add("rolling"); d2.classList.add("rolling");
    const end = performance.now() + ms;
    while (performance.now() < end) {
      this.drawDie(d1, Dice.d6());
      this.drawDie(d2, Dice.d6());
      await sleep(70, true);
    }
    d1.classList.remove("rolling"); d2.classList.remove("rolling");
    this.drawDie(d1, a);
    this.drawDie(d2, b);
    const sum = $("sumText");
    sum.textContent = a + b;
    sum.classList.remove("pop"); void sum.offsetWidth; sum.classList.add("pop");
  },

  // ---------- Dice Bag ----------
  // `probs` = exact chance per number (changes with Loaded Die upgrades).
  buildBag(probs = Dice.distribution(0)) {
    const root = $("bag");
    root.innerHTML = "";
    for (let s = 2; s <= 12; s++) {
      const action = CONFIG.actions[this.bag.actionFor(s)];
      const style = KIND_STYLE[action.kind];
      const pct = probs[s] * 100;
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.id = "slot" + s;
      slot.style.setProperty("--c", style.color);
      slot.title = `${s}: ${action.name}, ${pct.toFixed(2)}% chance`;
      slot.innerHTML = `
        <div class="num">${s}</div>
        <div class="icon">${style.icon}</div>
        <div class="name">${action.name}</div>
        <div class="prob"><div class="probFill" style="height:${pct / 16.67 * 100}%"></div></div>
        <div class="pct">${pct.toFixed(1)}%</div>
        <div class="count" id="count${s}">×${this.bag.timesRolled[s]}</div>`;
      root.appendChild(slot);
    }
  },

  // Rolls left until the next shuffle (0 = shuffle disabled).
  setShuffleCountdown(n) {
    $("shuffleText").textContent = n > 0 ? `· shuffles in ${n} roll${n === 1 ? "" : "s"}` : "";
  },

  // Spin the slots, rebuild with the new layout, and flag slots whose action changed.
  async animateShuffle(probs, before, ms) {
    const root = $("bag");
    root.classList.add("shuffling");
    await sleep(ms / 2, true);
    this.buildBag(probs);
    for (let s = 2; s <= 12; s++) {
      if (before[s] !== this.bag.slots[s]) $("slot" + s).classList.add("changed");
    }
    await sleep(ms / 2, true);
    root.classList.remove("shuffling");
  },

  // Flag one slot as freshly swapped.
  markSlot(sum) {
    $("slot" + sum).classList.add("changed");
  },

  // Briefly re-tumble one die (Loaded Die reroll).
  async rerollDie(index, value, ms) {
    const el = $(index === 0 ? "die1" : "die2");
    el.classList.add("rolling", "loaded");
    const end = performance.now() + ms;
    while (performance.now() < end) {
      this.drawDie(el, Dice.d6());
      await sleep(60, true);
    }
    el.classList.remove("rolling");
    this.drawDie(el, value);
    setTimeout(() => el.classList.remove("loaded"), 400);
  },

  setSum(sum) {
    const el = $("sumText");
    el.textContent = sum;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  },

  highlightSlot(sum) {
    this.clearHighlight();
    $("slot" + sum).classList.add("active");
    $("count" + sum).textContent = "×" + this.bag.timesRolled[sum];
  },

  clearHighlight() {
    document.querySelectorAll(".slot.active").forEach(s => s.classList.remove("active"));
  },

  // ---------- Level-up ----------
  // Shows 3 cards and resolves with the chosen upgrade.
  chooseUpgrade(level, options) {
    return new Promise(resolve => {
      $("levelupTitle").textContent = `LEVEL ${level}!`;
      const cards = $("cards");
      cards.innerHTML = "";
      options.forEach((u, i) => {
        const btn = document.createElement("button");
        btn.className = "card";
        const type = u.type || "power";
        const tag = { power: "POWER", odds: "ODDS", bag: "DICE BAG" }[type];
        btn.classList.add("type-" + type);
        btn.innerHTML = `<span class="key">${i + 1}</span><em class="tag">${tag}</em><b>${u.name}</b><span>${u.desc}</span>`;
        btn.onclick = () => finish(u);
        cards.appendChild(btn);
      });
      const onKey = e => {
        const i = Number(e.key) - 1;
        if (options[i]) finish(options[i]);
      };
      const finish = u => {
        document.removeEventListener("keydown", onKey);
        $("levelup").classList.remove("show");
        resolve(u);
      };
      document.addEventListener("keydown", onKey);
      $("levelup").classList.add("show");
    });
  },

  // ---------- Victory / defeat ----------
  showEnd(won, summary) {
    $("endTitle").textContent = won ? "VICTORY!" : "DEFEATED";
    $("endTitle").style.color = won ? "#16a34a" : "#dc2626";
    $("endText").textContent = summary;
    $("end").classList.add("show");
  },

  hideEnd() {
    $("end").classList.remove("show");
  }
};
