// =====================================================================
// Player, enemies and boss: state + geometric cartoon drawing.
// =====================================================================

const OUTLINE = "#1f2937";
const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOut = k => 1 - (1 - k) * (1 - k);
// 0 -> 1 -> 0 bump over k in [0,1]
const bump = k => Math.sin(clamp01(k) * Math.PI);

function shape(ctx, fill, draw) {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

// Shared animation + mood handling.
class Actor {
  constructor(x, hp) {
    this.x = x;
    this.renderX = x;
    this.hp = hp;
    this.maxHp = hp;
    this.anim = null;      // { name, t, dur }
    this.mood = "normal";  // normal | angry | hurt | happy | dead
    this.moodTimer = 0;
    this.flash = 0;        // white hit flash
    this.time = Math.random() * 10;
    this.dead = false;
    this.deadT = 0;
  }

  play(name, durMs) {
    this.anim = { name, t: 0, dur: durMs / 1000 / CONFIG.gameSpeed };
  }

  setMood(mood, seconds = 0.8) {
    this.mood = mood;
    this.moodTimer = seconds;
  }

  get alive() { return !this.dead; }

  update(dt) {
    this.time += dt;
    // Smoothly slide toward the logical position.
    this.renderX += (this.x - this.renderX) * (1 - Math.exp(-dt * 9));
    if (this.anim) {
      this.anim.t += dt;
      if (this.anim.t >= this.anim.dur) this.anim = null;
    }
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0 && !this.dead) this.mood = "normal";
    }
    if (this.flash > 0) this.flash -= dt;
    if (this.dead) this.deadT += dt;
  }

  animK() {
    return this.anim ? clamp01(this.anim.t / this.anim.dur) : 0;
  }

  drawHpBar(ctx, x, y, w) {
    if (this.dead) return;
    const k = this.hp / this.maxHp;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 12);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(x - w / 2, y, w, 8);
    ctx.fillStyle = k > 0.5 ? "#22c55e" : k > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(x - w / 2, y, w * k, 8);
  }
}

// Eyes + mouth, used by every character. `dir` = 1 looks right, -1 left.
function drawFace(ctx, cx, cy, mood, dir, scale = 1, blink = false) {
  const ex = 10 * scale, er = 7 * scale;
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  for (const side of [-1, 1]) {
    const x = cx + side * ex + dir * 4 * scale;
    const y = cy - 4 * scale;
    if (mood === "hurt" || mood === "dead") {
      // X eyes
      const s = 5 * scale;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
      ctx.stroke();
    } else if (mood === "happy") {
      // ^ ^ eyes
      ctx.beginPath();
      ctx.arc(x, y + 3 * scale, 6 * scale, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (blink) {
      ctx.beginPath();
      ctx.moveTo(x - 6 * scale, y); ctx.lineTo(x + 6 * scale, y);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, er, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.arc(x + dir * 2.5 * scale, y, 3.2 * scale, 0, Math.PI * 2); ctx.fill();
      if (mood === "angry") {
        // Brows slant down toward the middle of the face.
        ctx.beginPath();
        ctx.moveTo(x + side * 8 * scale, y - 14 * scale);
        ctx.lineTo(x - side * 8 * scale, y - 8 * scale);
        ctx.stroke();
      }
    }
  }
  // Mouth
  const my = cy + 12 * scale, mx = cx + dir * 4 * scale;
  ctx.beginPath();
  if (mood === "happy") {
    ctx.fillStyle = "#7f1d1d";
    ctx.arc(mx, my - 3 * scale, 9 * scale, 0, Math.PI);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (mood === "hurt") {
    ctx.fillStyle = "#7f1d1d";
    ctx.ellipse(mx, my, 6 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (mood === "angry") {
    ctx.moveTo(mx - 8 * scale, my + 2 * scale);
    ctx.lineTo(mx + 8 * scale, my - 2 * scale);
    ctx.stroke();
  } else if (mood === "dead") {
    ctx.moveTo(mx - 7 * scale, my); ctx.lineTo(mx + 7 * scale, my);
    ctx.stroke();
  } else {
    ctx.arc(mx, my - 4 * scale, 6 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------
class Player extends Actor {
  constructor() {
    super(CONFIG.player.startX, CONFIG.player.maxHp);
    this.level = 1;
    this.exp = 0;
    this.expToNext = CONFIG.exp.firstLevel;
    this.dodgeCharges = 0; // each charge blocks one enemy attack
    this.stats = {
      // power
      damageMult: 1, healMult: 1, dodgeChance: 0,
      damageTaken: 1, walkMult: 1, selfDamageMult: 1,
      // odds
      loadedDice: 0, secondChance: false, critChance: 0
    };
  }

  // Pose offsets for the current animation.
  pose() {
    const k = this.animK();
    const p = { ox: 0, oy: 0, sx: 1, sy: 1, rot: 0, sword: -0.3, legs: 0, glow: null };
    const name = this.anim ? this.anim.name : "idle";

    if (this.dead) {
      const d = clamp01(this.deadT * 2);
      p.rot = -d * Math.PI / 2; p.oy = 0; p.sword = 1.4;
      return p;
    }

    switch (name) {
      case "idle":
        p.oy = Math.sin(this.time * 3) * 2;
        p.sy = 1 + Math.sin(this.time * 3) * 0.03;
        p.sword = -0.3 + Math.sin(this.time * 3) * 0.08;
        break;
      case "walk":
        p.oy = -Math.abs(Math.sin(k * Math.PI * 3)) * 16;
        p.legs = Math.sin(k * Math.PI * 6);
        p.sy = 1 + Math.abs(Math.sin(k * Math.PI * 3)) * 0.08;
        break;
      case "attack":
        if (k < 0.35) { p.ox = -10 * (k / 0.35); p.sword = -0.3 - 1.3 * (k / 0.35); }
        else { const j = (k - 0.35) / 0.65; p.ox = -10 + 45 * bump(j); p.sword = -1.6 + 3.0 * easeOut(clamp01(j * 2)); }
        p.legs = 0.4 * bump(k);
        break;
      case "heavy":
      case "crit":
        if (k < 0.45) { const j = k / 0.45; p.ox = -16 * j; p.sy = 1 - 0.18 * j; p.sx = 1 + 0.12 * j; p.sword = -0.3 - 1.9 * j; }
        else { const j = (k - 0.45) / 0.55; p.ox = -16 + 60 * bump(j); p.oy = -40 * bump(j); p.sword = -2.2 + 4.0 * easeOut(clamp01(j * 1.6)); p.sy = 1 + 0.1 * bump(j); }
        if (name === "crit") p.glow = "rgba(255, 214, 0, 0.55)";
        break;
      case "special":
        p.rot = k * Math.PI * 2;
        p.oy = -50 * bump(k);
        p.sword = 1.2;
        p.glow = "rgba(56, 189, 248, 0.5)";
        break;
      case "hurt":
        p.ox = -24 * bump(Math.min(1, k * 1.5));
        p.sx = 1 + 0.3 * bump(k); p.sy = 1 - 0.3 * bump(k);
        p.rot = -0.25 * bump(k);
        p.sword = 1.0;
        break;
      case "heal":
        p.sy = 1 + 0.12 * bump(k); p.sx = 1 - 0.06 * bump(k);
        p.glow = `rgba(34, 197, 94, ${0.5 * bump(k)})`;
        break;
      case "fullheal":
        p.oy = -60 * bump(k);
        p.rot = k * Math.PI * 2;
        p.glow = `rgba(250, 204, 21, ${0.8 * bump(k)})`;
        p.sword = -1.2;
        break;
      case "dodge":
        p.ox = -30 * bump(k); p.oy = -20 * bump(k); p.rot = -0.35 * bump(k);
        break;
      case "victory":
        p.oy = -Math.abs(Math.sin(k * Math.PI * 4)) * 30;
        p.sword = -2.2;
        break;
    }
    return p;
  }

  draw(ctx, groundY) {
    const p = this.pose();
    const x = this.renderX + p.ox;
    const y = groundY + p.oy;
    ctx.save();
    if (this.dead) ctx.globalAlpha = Math.max(0.35, 1 - this.deadT * 0.4);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(this.renderX + p.ox, groundY + 4, 30 * (1 + p.oy / 200), 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(p.rot);
    ctx.scale(p.sx, p.sy);

    const bodyY = -62;
    // Glow behind body
    if (p.glow) {
      ctx.fillStyle = p.glow;
      ctx.beginPath(); ctx.arc(0, bodyY, 52, 0, Math.PI * 2); ctx.fill();
    }

    // Legs (stick lines)
    ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.strokeStyle = OUTLINE;
    for (const side of [-1, 1]) {
      const swing = p.legs * side * 10;
      ctx.beginPath();
      ctx.moveTo(side * 10, bodyY + 24);
      ctx.lineTo(side * 12 + swing, 0);
      ctx.stroke();
    }

    // Back arm
    ctx.beginPath(); ctx.moveTo(-24, bodyY + 6); ctx.lineTo(-38, bodyY + 22); ctx.stroke();

    // Body
    const bodyColor = this.flash > 0 ? "#ffffff" : "#ffd23f";
    shape(ctx, bodyColor, () => ctx.arc(0, bodyY, 30, 0, Math.PI * 2));

    // Tiny hat tuft
    shape(ctx, "#ff6b6b", () => {
      ctx.moveTo(-8, bodyY - 28); ctx.lineTo(0, bodyY - 46); ctx.lineTo(8, bodyY - 28); ctx.closePath();
    });

    const blink = Math.sin(this.time * 1.3) > 0.985;
    drawFace(ctx, 4, bodyY, this.mood, 1, 1, blink);

    // Front arm + sword
    ctx.save();
    ctx.translate(22, bodyY + 8);
    ctx.rotate(p.sword);
    ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, 0); ctx.stroke();
    shape(ctx, "#cbd5e1", () => ctx.rect(18, -4, 40, 8));        // blade
    shape(ctx, "#8b5e34", () => ctx.rect(14, -9, 6, 18));        // guard
    ctx.restore();

    // Dodge bubble
    if (this.dodgeCharges > 0) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, bodyY + 10, 62 + Math.sin(this.time * 6) * 3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
class Enemy extends Actor {
  constructor(type, x) {
    const def = CONFIG.enemies[type];
    super(x, def.hp);
    this.type = type;
    this.def = def;
    this.active = false; // becomes true when the player is within aggro range
    this.isBoss = false;
  }

  pose() {
    const k = this.animK();
    const p = { ox: 0, oy: 0, sx: 1, sy: 1 };
    const name = this.anim ? this.anim.name : "idle";
    if (this.dead) {
      const d = clamp01(this.deadT * 3);
      p.sx = 1 + d * 0.6; p.sy = 1 - d * 0.85;
      return p;
    }
    switch (name) {
      case "idle": {
        const b = Math.sin(this.time * 4);
        p.sy = 1 + b * 0.06; p.sx = 1 - b * 0.04;
        break;
      }
      case "walk":
        p.oy = -Math.abs(Math.sin(k * Math.PI * 2)) * 14;
        p.sy = 1 + 0.1 * Math.sin(k * Math.PI * 4);
        break;
      case "attack":
        p.ox = -40 * bump(k); p.oy = -18 * bump(k);
        p.sx = 1 + 0.15 * bump(k);
        break;
      case "hurt":
        p.ox = 20 * bump(k); p.sx = 1.25 - 0.25 * k; p.sy = 0.8 + 0.2 * k;
        break;
    }
    return p;
  }

  draw(ctx, groundY) {
    if (this.dead && this.deadT > 0.6) return;
    const p = this.pose();
    const x = this.renderX + p.ox;
    const y = groundY + p.oy;
    ctx.save();
    if (this.dead) ctx.globalAlpha = 1 - this.deadT / 0.6;

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(this.renderX, groundY + 4, 30, 7, 0, 0, Math.PI * 2); ctx.fill();

    ctx.translate(x, y);
    ctx.scale(p.sx, p.sy);
    const color = this.flash > 0 ? "#ffffff" : this.def.color;

    let faceY;
    if (this.type === "blob") {
      // Dome-shaped slime
      shape(ctx, color, () => {
        ctx.moveTo(-34, 0);
        ctx.bezierCurveTo(-36, -60, 36, -60, 34, 0);
        ctx.closePath();
      });
      faceY = -24;
    } else {
      // Spiky triangle creature
      shape(ctx, color, () => {
        ctx.moveTo(-34, 0); ctx.lineTo(-24, -40); ctx.lineTo(-30, -50); ctx.lineTo(-12, -54);
        ctx.lineTo(0, -82); ctx.lineTo(12, -54); ctx.lineTo(30, -50); ctx.lineTo(24, -40);
        ctx.lineTo(34, 0); ctx.closePath();
      });
      faceY = -28;
    }
    ctx.restore();

    // Face drawn unscaled vertically so it stays readable while squashing
    ctx.save();
    if (this.dead) ctx.globalAlpha = 1 - this.deadT / 0.6;
    ctx.translate(x, y + faceY * p.sy);
    const mood = this.dead ? "dead" : this.mood === "normal" ? "angry" : this.mood;
    drawFace(ctx, 0, 0, mood, -1, 0.85);
    ctx.restore();

    this.drawHpBar(ctx, this.renderX, groundY - (this.type === "blob" ? 70 : 100), 56);
  }
}

// ---------------------------------------------------------------------
// The boss: a giant evil die that rolls a D100 each turn.
class Boss extends Enemy {
  constructor(x) {
    super(CONFIG.boss.summonType, x); // base init, overridden below
    const def = CONFIG.boss;
    this.def = { ...def, color: "#b91c1c" };
    this.type = "boss";
    this.isBoss = true;
    this.hp = this.maxHp = def.hp;
    this.defending = false;
    // D100 badge state shown above the boss.
    this.d100 = { visible: false, rolling: false, value: 0, label: "" };
  }

  pose() {
    const p = super.pose();
    const k = this.animK();
    const name = this.anim ? this.anim.name : "idle";
    if (name === "heavy" || name === "devastate") {
      p.oy = -(name === "devastate" ? 120 : 60) * bump(k);
      p.ox = -50 * bump(k);
    } else if (name === "summon") {
      p.sy = 1 + 0.2 * bump(k); p.sx = 1 - 0.1 * bump(k);
    } else if (name === "fumble") {
      p.ox = 0; p.oy = 0; p.sx = 1 + 0.3 * bump(k); p.sy = 1 - 0.4 * bump(k);
    }
    return p;
  }

  draw(ctx, groundY) {
    if (this.dead && this.deadT > 1.2) return;
    const p = this.pose();
    const x = this.renderX + p.ox;
    const y = groundY + p.oy;
    const s = 120;

    ctx.save();
    if (this.dead) ctx.globalAlpha = 1 - this.deadT / 1.2;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(this.renderX, groundY + 5, 70, 10, 0, 0, Math.PI * 2); ctx.fill();

    ctx.translate(x, y);
    const wobble = this.dead ? this.deadT * 1.5 : Math.sin(this.time * 2) * 0.03;
    ctx.rotate(wobble);
    ctx.scale(p.sx, p.sy);

    // Horns
    for (const side of [-1, 1]) {
      shape(ctx, "#f5f5f4", () => {
        ctx.moveTo(side * 30, -s); ctx.lineTo(side * 62, -s - 36); ctx.lineTo(side * 52, -s); ctx.closePath();
      });
    }
    // Die body
    const body = this.flash > 0 ? "#ffffff" : this.defending ? "#1e40af" : "#b91c1c";
    shape(ctx, body, () => ctx.roundRect(-s / 2, -s, s, s, 18));
    // Pips in the corners
    ctx.fillStyle = "#fde68a";
    for (const [px, py] of [[-38, -102], [38, -102], [-38, -18], [38, -18]]) {
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    }
    drawFace(ctx, 0, -62, this.dead ? "dead" : this.mood === "normal" ? "angry" : this.mood, -1, 1.5);

    // Defensive stance shield
    if (this.defending && !this.dead) {
      ctx.strokeStyle = "rgba(147, 197, 253, 0.95)";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, -s / 2, 90, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
    }
    ctx.restore();

    if (!this.dead) this.drawD100(ctx, this.renderX, groundY - s - 90);
  }

  // Evil decagon "D100" with the rolled number and the telegraphed action.
  drawD100(ctx, x, y) {
    const d = this.d100;
    if (!d.visible) return;
    const value = d.rolling ? Dice.d100() : d.value;
    const r = 34;
    ctx.save();
    ctx.translate(x, y);
    if (d.rolling) ctx.rotate(Math.sin(this.time * 30) * 0.4);
    shape(ctx, "#111827", () => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    });
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = value === 100 ? "#facc15" : "#ef4444";
    ctx.font = "900 24px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(value, 0, 1);
    ctx.restore();

    if (!d.rolling && d.label) {
      ctx.font = "800 18px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(d.label).width + 24;
      ctx.fillStyle = "#111827";
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - 66, w, 30, 8); ctx.fill();
      ctx.fillStyle = "#fca5a5";
      ctx.fillText(d.label, x, y - 51);
    }
  }
}
