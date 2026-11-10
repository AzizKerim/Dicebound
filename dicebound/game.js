// =====================================================================
// Game: turn loop, combat, progression, rendering.
// =====================================================================

// ?speed=3 in the URL fast-forwards the game.
const params = new URLSearchParams(location.search);
if (params.has("speed")) CONFIG.gameSpeed = Number(params.get("speed")) || 1;

// Waits `ms` scaled by game speed (pass raw=true to skip scaling).
function sleep(ms, raw = false) {
  return new Promise(r => setTimeout(r, raw ? ms : ms / CONFIG.gameSpeed));
}

const T = CONFIG.timing;
const W = CONFIG.world;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const Game = {
  state: "playing", // playing | won | lost
  camX: 0,
  shakeT: 0,
  shakeMag: 0,
  turn: 0,

  init() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = W.width;
    this.canvas.height = W.height;

    this.player = new Player();
    this.enemies = CONFIG.spawns.map(s => new Enemy(s.type, s.x));
    this.boss = new Boss(CONFIG.boss.x);
    this.enemies.push(this.boss);
    this.bag = new DiceBag(CONFIG.diceBag);

    // ?start=boss skips straight to the boss fight (handy for demos/testing).
    if (params.get("start") === "boss") {
      this.enemies.forEach(e => { if (!e.isBoss) { e.dead = true; e.deadT = 99; } });
      this.player.x = this.player.renderX = CONFIG.boss.x - 300;
      this.camX = this.player.x - 260;
    }

    UI.init(this.bag);
    UI.setShuffleCountdown(CONFIG.bagShuffle.everyRolls);
    UI.setAction("Get ready...");
    this.refreshHud();

    document.getElementById("restart").onclick = () => location.reload();

    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
    this.turnLoop();
  },

  // -------------------------------------------------------------------
  // TURN LOOP: roll -> reveal -> highlight -> player acts -> enemies act
  // -------------------------------------------------------------------
  async turnLoop() {
    await sleep(800);
    while (this.state === "playing") {
      this.turn++;
      await this.playerTurn();
      if (this.checkEnd()) break;
      await this.handleLevelUps();

      await this.enemyTurns();
      if (this.checkEnd()) break;
      await this.handleLevelUps();

      const every = CONFIG.bagShuffle.everyRolls;
      if (every > 0) {
        if (this.turn % every === 0) await this.shuffleBag();
        UI.setShuffleCountdown(every - (this.turn % every));
      }

      await sleep(T.betweenTurns);
    }
  },

  async playerTurn() {
    let { a, b, sum } = await this.rollWithModifiers();
    let id = this.bag.actionFor(sum);

    // Second Chance upgrade: one free reroll when the bag says "Take Damage".
    if (id === "takeDamage" && this.player.stats.secondChance) {
      UI.highlightSlot(sum);
      UI.setAction(`${sum} → Take Damage... SECOND CHANCE!`, "special");
      await sleep(T.reveal);
      ({ a, b, sum } = await this.rollWithModifiers());
      id = this.bag.actionFor(sum);
    }

    this.bag.record(sum);
    const action = CONFIG.actions[id];
    UI.highlightSlot(sum);
    UI.setAction(`${a} + ${b} = ${sum}  →  ${action.name}`, action.kind);
    await sleep(T.reveal);

    await PlayerActions[id](action);
    this.refreshHud();
  },

  // Roll 2d6 with the tumbling animation, then apply Loaded Die rerolls.
  async rollWithModifiers() {
    const dice = [Dice.d6(), Dice.d6()];
    UI.setAction("Rolling...");
    await UI.animateRoll(dice[0], dice[1], T.rollAnim / CONFIG.gameSpeed);

    for (let i = 0; i < this.player.stats.loadedDice; i++) {
      if (dice[i] !== 1) continue;
      dice[i] = Dice.d6();
      UI.setAction("Loaded Die rerolls the 1!", "special");
      await UI.rerollDie(i, dice[i], 350 / CONFIG.gameSpeed);
      UI.setSum(dice[0] + dice[1]);
    }
    return { a: dice[0], b: dice[1], sum: dice[0] + dice[1] };
  },

  // Exact chances for each number, given the player's Loaded Die upgrades.
  probs() {
    return Dice.distribution(this.player.stats.loadedDice);
  },

  refreshBag() {
    UI.buildBag(this.probs());
  },

  // Every N rolls the Dice Bag re-assigns its actions to random numbers.
  async shuffleBag() {
    const before = { ...this.bag.slots };
    this.bag.shuffle(CONFIG.bagShuffle.pairSwaps);
    UI.setAction("DICE BAG SHUFFLE!", "special");
    await UI.animateShuffle(this.probs(), before, T.bagShuffle / CONFIG.gameSpeed);
  },

  // A level-up card that replaces one action in the Dice Bag.
  makeBagSwapCard() {
    const cfg = CONFIG.bagSwap;
    const slots = Object.keys(this.bag.slots).map(Number);
    const bad = slots.filter(s => this.bag.slots[s] === "takeDamage");
    const slot = bad.length && Math.random() < cfg.badSlotBias ? pick(bad) : pick(slots);
    const from = this.bag.slots[slot];
    const to = pick(cfg.offers.filter(id => id !== from));
    const pct = (this.probs()[slot] * 100).toFixed(1);
    return {
      type: "bag",
      slot,
      name: `${CONFIG.actions[from].name} → ${CONFIG.actions[to].name}`,
      desc: `Swap it on ${slot} (${pct}% right now). It stays in your bag; shuffles only move it.`,
      apply: () => this.bag.setSlot(slot, to)
    };
  },

  async enemyTurns() {
    const p = this.player;
    // Wake up enemies that are close enough.
    // The boss waits until every regular (non-summoned) enemy is defeated.
    const minionsLeft = this.enemies.some(e => e.alive && !e.isBoss && !e.summoned);
    for (const e of this.enemies) {
      if (e.isBoss && minionsLeft) continue;
      if (e.alive && !e.active && e.x - p.x < W.aggroRange) {
        e.active = true;
        e.setMood("angry", 1);
        Effects.text(e.x, W.groundY - (e.isBoss ? 230 : 110), "!", "#facc15", 34);
      }
    }
    const acting = this.enemies.filter(e => e.alive && e.active).sort((a, b) => a.x - b.x);
    for (const e of acting) {
      if (this.state !== "playing" || p.dead || e.dead) continue;
      if (e.isBoss) await this.bossTurn(e);
      else await this.enemyAct(e);
      this.refreshHud();
    }
  },

  // Regular enemy: attack if in range, otherwise step toward the player.
  async enemyAct(e) {
    const p = this.player;
    if (e.x - p.x <= e.def.range) {
      e.play("attack", T.enemyStep);
      await sleep(T.enemyStep * 0.5);
      this.hitPlayer(e.def.damage);
      await sleep(T.enemyStep * 0.5);
    } else if (this.stepToward(e, e.def.speed)) {
      e.play("walk", T.enemyStep);
      await sleep(T.enemyStep * 0.6);
    }
  },

  // Move an enemy left toward the player without overlapping anyone. Returns true if it moved.
  stepToward(e, speed) {
    const p = this.player;
    const ahead = this.enemies.filter(o => o !== e && o.alive && o.x < e.x);
    const frontX = ahead.length ? Math.max(...ahead.map(o => o.x)) : -Infinity;
    const gap = e.isBoss ? 100 : 60;
    const targetX = Math.max(e.x - speed, p.x + e.def.range * 0.85, frontX + gap);
    if (targetX >= e.x - 1) return false;
    e.x = targetX;
    return true;
  },

  // -------------------------------------------------------------------
  // BOSS: rolls a D100, telegraphs the result, then acts.
  // -------------------------------------------------------------------
  async bossTurn(b) {
    b.defending = false; // stance lasts until its next turn
    if (this.stepToward(b, b.def.speed)) b.play("walk", T.enemyStep);

    b.d100 = { visible: true, rolling: true, value: 0, label: "" };
    UI.setAction("The Evil D100 is rolling...", "bad");
    await sleep(T.bossRoll);

    const roll = Dice.d100();
    const entry = CONFIG.boss.table.find(t => roll <= t.max);
    b.d100 = { visible: true, rolling: false, value: roll, label: entry.name };
    UI.setAction(`Boss rolled ${roll}  →  ${entry.name}`, "bad");
    await sleep(T.bossReveal);

    await BossActions[entry.id](b, entry);
    b.d100.label = "";
  },

  // -------------------------------------------------------------------
  // COMBAT HELPERS
  // -------------------------------------------------------------------
  nearestEnemy(range) {
    let best = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.abs(e.x - this.player.x);
      if (d <= range && (!best || d < Math.abs(best.x - this.player.x))) best = e;
    }
    return best;
  },

  enemiesInRange(range) {
    return this.enemies.filter(e => e.alive && Math.abs(e.x - this.player.x) <= range);
  },

  // Player deals damage to an enemy.
  damageEnemy(e, base, color = "#ffffff", size = 26) {
    let dmg = Math.round(base * this.player.stats.damageMult);
    // Keen Eye upgrade: any hit can crit.
    if (Math.random() < this.player.stats.critChance) {
      dmg = Math.round(dmg * CONFIG.critMultiplier);
      color = "#facc15";
      size += 8;
      Effects.text(e.x, W.groundY - (e.isBoss ? 220 : 160), "LUCKY CRIT!", "#facc15", 20);
    }
    if (e.defending) {
      dmg = Math.round(dmg * (1 - CONFIG.boss.table.find(t => t.id === "defend").reduction));
      Effects.text(e.x, W.groundY - 190, "BLOCKED", "#93c5fd", 20);
    }
    e.hp = Math.max(0, e.hp - dmg);
    e.flash = 0.12;
    if (!e.isBoss) e.active = true; // the boss wakes up on its own terms
    e.play("hurt", 350);
    e.setMood("hurt", 0.5);
    Effects.text(e.x, W.groundY - (e.isBoss ? 150 : 90), dmg, color, size);
    Effects.burst(e.x, W.groundY - 40, e.def.color, 8);
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    e.dead = true;
    e.mood = "dead";
    Effects.burst(e.x, W.groundY - 40, e.def.color, 22, 320);
    if (e.def.exp) this.gainExp(e.def.exp, e.x);
    if (e.isBoss) {
      this.shake(18, 0.8);
      for (let i = 0; i < 5; i++) {
        setTimeout(() => Effects.burst(e.x + (Math.random() - 0.5) * 120, W.groundY - 80, pick(["#facc15", "#ef4444", "#fff"]), 18, 380), i * 150);
      }
    }
  },

  // Enemy damages the player (dodge and upgrades apply).
  hitPlayer(base) {
    const p = this.player;
    if (p.dead) return;
    // A stored Dodge charge blocks exactly one attack.
    if (p.dodgeCharges > 0) {
      p.dodgeCharges--;
      p.play("dodge", 400);
      Effects.text(p.x, W.groundY - 130, "BLOCKED!", "#38bdf8", 24);
      return;
    }
    if (Math.random() < p.stats.dodgeChance) {
      p.play("dodge", 400);
      Effects.text(p.x, W.groundY - 130, "DODGED!", "#38bdf8", 24);
      return;
    }
    this.hurtPlayer(Math.round(base * p.stats.damageTaken));
  },

  hurtPlayer(dmg) {
    const p = this.player;
    p.hp = Math.max(0, p.hp - dmg);
    p.flash = 0.12;
    p.play("hurt", 450);
    p.setMood("hurt", 0.7);
    Effects.text(p.x, W.groundY - 130, "-" + dmg, "#f87171", 28);
    this.shake(6, 0.2);
    if (p.hp <= 0) {
      p.dead = true;
      p.mood = "dead";
    }
    this.refreshHud();
  },

  healPlayer(amount) {
    const p = this.player;
    const healed = Math.min(p.maxHp - p.hp, Math.round(amount * p.stats.healMult));
    p.hp += healed;
    Effects.text(p.x, W.groundY - 130, "+" + healed, "#4ade80", 28);
    return healed;
  },

  // Move the player forward, stopping in front of the first living enemy.
  movePlayer(dist) {
    const p = this.player;
    const ahead = this.enemies.filter(e => e.alive && e.x > p.x);
    const blocker = ahead.sort((a, b) => a.x - b.x)[0];
    const gap = blocker ? (blocker.isBoss ? 105 : CONFIG.player.minGapToEnemy) : 0;
    const maxX = blocker ? blocker.x - gap : W.levelLength - 60;
    const newX = Math.max(p.x, Math.min(p.x + dist, maxX));
    const moved = newX - p.x;
    p.x = newX;
    return moved;
  },

  gainExp(amount, x) {
    this.player.exp += amount;
    Effects.text(x, W.groundY - 160, `+${amount} EXP`, "#60a5fa", 20);
    this.refreshHud();
  },

  async handleLevelUps() {
    const p = this.player;
    while (p.exp >= p.expToNext && this.state === "playing" && !p.dead) {
      p.exp -= p.expToNext;
      p.level++;
      p.expToNext = Math.round(p.expToNext * CONFIG.exp.growth);
      this.refreshHud();
      await sleep(300);

      // 3 cards: Dice Bag swap(s) + random available upgrades, in random order.
      const swaps = Array.from({ length: CONFIG.bagSwap.cardsPerLevelUp }, () => this.makeBagSwapCard());
      const upgrades = CONFIG.upgrades
        .filter(u => !u.available || u.available(p))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3 - swaps.length);
      const pool = [...swaps, ...upgrades].sort(() => Math.random() - 0.5);
      // ?auto=1 picks automatically (used for automated testing).
      const choice = params.has("auto") ? pool[0] : await UI.chooseUpgrade(p.level, pool);
      choice.apply(p);
      this.refreshBag(); // odds or slots may have changed
      if (choice.slot) UI.markSlot(choice.slot);
      p.setMood("happy", 1.2);
      Effects.rise(p.x, W.groundY - 80, "#facc15", 16);
      Effects.text(p.x, W.groundY - 150, choice.name + "!", "#facc15", 22);
      this.refreshHud();
      await sleep(400);
    }
  },

  checkEnd() {
    const ended = this.player.dead || this.boss.dead;
    if (ended) {
      const counts = Object.values(this.bag.timesRolled).join(",");
      document.title = `Dicebound - ${this.player.dead ? "DEFEATED" : "VICTORY"} turn=${this.turn} lv=${this.player.level} hp=${Math.ceil(this.player.hp)} progress=${this.progressPct()} bossHp=${this.boss.hp} rolls2to12=${counts}`;
    }
    if (this.player.dead) {
      this.state = "lost";
      UI.setAction("Your hero has fallen...", "bad");
      setTimeout(() => UI.showEnd(false,
        `Reached ${this.progressPct()}% of the level at LV ${this.player.level} after ${this.turn} rolls.`), 1400);
      return true;
    }
    if (this.boss.dead) {
      this.state = "won";
      this.player.setMood("happy", 999);
      this.player.play("victory", 1600);
      UI.setAction("The Evil D100 is defeated!", "heal");
      setTimeout(() => UI.showEnd(true,
        `You beat the level at LV ${this.player.level} with ${Math.ceil(this.player.hp)} HP left, in ${this.turn} rolls.`), 1600);
      return true;
    }
    return false;
  },

  progressPct() {
    const start = CONFIG.player.startX, end = CONFIG.boss.x;
    return Math.round(100 * Math.max(0, Math.min(1, (this.player.x - start) / (end - start))));
  },

  refreshHud() {
    UI.updateHud(this.player, `World 1 · ${this.progressPct()}%`);
    UI.updateBossBar(this.boss);
  },

  shake(mag, seconds) {
    this.shakeMag = mag;
    this.shakeT = seconds;
  },

  // -------------------------------------------------------------------
  // RENDERING
  // -------------------------------------------------------------------
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    this.player.update(dt);
    this.enemies.forEach(e => e.update(dt));
    Effects.update(dt);

    const targetCam = Math.max(0, Math.min(this.player.renderX - 260, W.levelLength - W.width + 120));
    this.camX += (targetCam - this.camX) * (1 - Math.exp(-dt * 4));
    if (this.shakeT > 0) this.shakeT -= dt;

    this.draw();
    requestAnimationFrame(t => this.frame(t));
  },

  draw() {
    const ctx = this.ctx;
    const cam = this.camX;
    const gy = W.groundY;

    // Sky
    ctx.fillStyle = "#bfe9ff";
    ctx.fillRect(0, 0, W.width, W.height);

    ctx.save();
    if (this.shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * this.shakeMag, (Math.random() - 0.5) * this.shakeMag);
    }

    // Clouds (slow parallax)
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 12; i++) {
      const x = i * 330 - cam * 0.2 + (i % 3) * 40;
      const y = 60 + (i % 3) * 40;
      ctx.beginPath();
      ctx.ellipse(x, y, 50, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 30, y - 12, 32, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hills (mid parallax)
    for (let i = 0; i < 14; i++) {
      const x = i * 260 - cam * 0.45;
      ctx.fillStyle = i % 2 ? "#9ad98f" : "#86cf7c";
      ctx.beginPath();
      ctx.arc(x, gy + 40, 150 + (i % 3) * 30, Math.PI, 0);
      ctx.fill();
    }

    // World-space layer
    ctx.save();
    ctx.translate(-cam, 0);

    // Ground with stripes so movement is readable
    ctx.fillStyle = "#6cc35f";
    ctx.fillRect(cam - 50, gy, W.width + 100, 18);
    ctx.fillStyle = "#c98b55";
    ctx.fillRect(cam - 50, gy + 18, W.width + 100, W.height - gy);
    ctx.fillStyle = "#b97a46";
    for (let x = Math.floor(cam / 80) * 80; x < cam + W.width + 80; x += 80) {
      if ((x / 80) % 2 === 0) ctx.fillRect(x, gy + 18, 40, W.height - gy);
    }
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cam - 50, gy); ctx.lineTo(cam + W.width + 50, gy); ctx.stroke();

    this.drawSign(CONFIG.player.startX - 70, "START", "#3b82f6");
    this.drawSign(CONFIG.boss.x - 330, "BOSS!", "#dc2626");

    // Characters (enemies first so the player is drawn on top)
    for (const e of this.enemies) e.draw(ctx, gy);
    this.player.draw(ctx, gy);

    Effects.draw(ctx);
    ctx.restore();
    ctx.restore();
  },

  drawSign(x, text, color) {
    const ctx = this.ctx, gy = W.groundY;
    ctx.fillStyle = "#8b5e34";
    ctx.fillRect(x - 4, gy - 70, 8, 70);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.strokeRect(x - 4, gy - 70, 8, 70);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x - 40, gy - 100, 80, 34, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, x, gy - 83);
  }
};

// =====================================================================
// PLAYER ACTIONS - one function per action id in CONFIG.actions.
// Each one plays an animation and resolves when it is finished.
// =====================================================================
const actionMs = (mult = 1) => T.action * mult;

async function attackNearest(action, anim, opts = {}) {
  const p = Game.player;
  const target = Game.nearestEnemy(CONFIG.player.meleeRange);
  const dur = actionMs(opts.slow ? 1.4 : 1);
  p.play(anim, dur);
  p.setMood("angry", dur / 1000 / CONFIG.gameSpeed + 0.2);

  if (!target) {
    // Nothing to hit: swing at the air and stumble forward a little.
    Game.movePlayer(CONFIG.player.attackLunge);
    await sleep(dur * 0.5);
    Effects.text(p.x + 40, W.groundY - 120, pick(["*whoosh*", "Hit nothing!", "Take that, air!"]), "#e5e7eb", 18);
    await sleep(dur * 0.5);
    return;
  }

  await sleep(dur * (opts.slow ? 0.6 : 0.45));
  Game.damageEnemy(target, action.damage, opts.color, opts.size);
  if (opts.onHit) opts.onHit(target);
  await sleep(dur * (opts.slow ? 0.4 : 0.55));
}

const PlayerActions = {
  async takeDamage(action) {
    const p = Game.player;
    Effects.text(p.x, W.groundY - 165, pick(["Tripped!", "Stubbed a toe!", "Bit my tongue!", "Sneezed into my sword!"]), "#fca5a5", 18);
    Game.hurtPlayer(Math.max(1, Math.round(action.amount * p.stats.selfDamageMult)));
    await sleep(actionMs());
  },

  basicAttack: a => attackNearest(a, "attack"),

  heavyAttack: a => attackNearest(a, "heavy", {
    slow: true, color: "#fdba74", size: 32,
    onHit: () => Game.shake(8, 0.2)
  }),

  critAttack: a => attackNearest(a, "crit", {
    slow: true, color: "#facc15", size: 40,
    onHit: t => {
      Game.shake(14, 0.3);
      Effects.text(t.x, W.groundY - (t.isBoss ? 200 : 140), "CRIT!", "#facc15", 30);
      Effects.burst(t.x, W.groundY - 50, "#facc15", 20, 360);
    }
  }),

  async specialAttack(action) {
    const p = Game.player;
    p.play("special", actionMs(1.2));
    await sleep(actionMs(0.6));
    Effects.ring(p.x, W.groundY - 50, "#38bdf8", CONFIG.player.specialRange);
    const targets = Game.enemiesInRange(CONFIG.player.specialRange);
    if (!targets.length) Effects.text(p.x, W.groundY - 150, "Spin attack! (on nobody)", "#bae6fd", 18);
    targets.forEach(e => Game.damageEnemy(e, action.damage, "#7dd3fc", 30));
    Game.shake(6, 0.2);
    await sleep(actionMs(0.6));
  },

  async heal(action) {
    const p = Game.player;
    p.play("heal", actionMs());
    p.setMood("happy", 0.9);
    Effects.rise(p.x, W.groundY - 60, "#4ade80", 12);
    Game.healPlayer(action.amount);
    await sleep(actionMs());
  },

  async fullHeal() {
    const p = Game.player;
    p.play("fullheal", actionMs(1.4));
    p.setMood("happy", 1.5);
    Effects.rise(p.x, W.groundY - 60, "#facc15", 26);
    Effects.ring(p.x, W.groundY - 60, "#facc15", 140);
    p.hp = p.maxHp;
    Effects.text(p.x, W.groundY - 160, "FULL HP!!", "#facc15", 32);
    await sleep(actionMs(1.4));
  },

  async walk() {
    const p = Game.player;
    const moved = Game.movePlayer(CONFIG.player.walkDistance * p.stats.walkMult);
    p.play("walk", actionMs());
    if (moved < 5) Effects.text(p.x + 30, W.groundY - 140, "Blocked!", "#e5e7eb", 18);
    await sleep(actionMs());
  },

  async dodge() {
    const p = Game.player;
    const full = p.dodgeCharges >= CONFIG.maxDodgeCharges;
    p.dodgeCharges = Math.min(CONFIG.maxDodgeCharges, p.dodgeCharges + 1);
    p.play("dodge", actionMs());
    Effects.text(p.x, W.groundY - 150, full ? "Shield already up!" : "Shield up! Blocks next hit", "#38bdf8", 20);
    await sleep(actionMs());
  }
};

// =====================================================================
// BOSS ACTIONS - one function per id in CONFIG.boss.table.
// =====================================================================
const BossActions = {
  async basic(b, entry) {
    b.play("attack", T.enemyStep * 1.2);
    await sleep(T.enemyStep * 0.6);
    Game.hitPlayer(entry.damage);
    await sleep(T.enemyStep * 0.6);
  },

  async heavy(b, entry) {
    b.play("heavy", actionMs(1.2));
    await sleep(actionMs(0.6));
    Game.shake(10, 0.25);
    Game.hitPlayer(entry.damage);
    await sleep(actionMs(0.6));
  },

  async summon(b) {
    b.play("summon", actionMs());
    await sleep(actionMs(0.5));
    const minions = Game.enemies.filter(e => e.alive && !e.isBoss && e.x > Game.player.x).length;
    if (minions >= 2) {
      Effects.text(b.x, W.groundY - 160, "...but nobody came", "#e5e7eb", 18);
    } else {
      // Spawn between boss and player, never on top of the player.
      const m = new Enemy(CONFIG.boss.summonType, Math.max(Game.player.x + 85, b.x - 110));
      m.active = true;
      m.summoned = true;
      m.renderX = b.x;
      Game.enemies.push(m);
      Effects.burst(m.x, W.groundY - 30, "#a855f7", 20);
    }
    await sleep(actionMs(0.5));
  },

  async defend(b) {
    b.defending = true;
    Effects.text(b.x, W.groundY - 160, "DEFENSE UP", "#93c5fd", 22);
    await sleep(actionMs(0.8));
  },

  async devastate(b, entry) {
    b.play("devastate", actionMs(1.6));
    await sleep(actionMs(0.9));
    Effects.ring(b.x, W.groundY - 10, "#ef4444", 600);
    Game.shake(20, 0.45);
    Game.hitPlayer(entry.damage);
    await sleep(actionMs(0.7));
  },

  async fumble(b, entry) {
    b.play("fumble", actionMs(1.2));
    Effects.text(b.x, W.groundY - 190, "NAT 100... TRIPPED!", "#facc15", 24);
    await sleep(actionMs(0.5));
    b.hp = Math.max(0, b.hp - entry.selfDamage);
    b.flash = 0.2;
    Effects.text(b.x, W.groundY - 150, "-" + entry.selfDamage, "#facc15", 34);
    if (b.hp <= 0) Game.killEnemy(b);
    await sleep(actionMs(0.7));
  }
};

window.addEventListener("load", () => Game.init());
