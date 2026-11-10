// =====================================================================
// Floating numbers, particles and shockwave rings (drawn in world space).
// =====================================================================

const Effects = {
  items: [],

  text(x, y, text, color, size = 26) {
    this.items.push({ type: "text", x, y, text, color, size, t: 0, life: 1.1 });
  },

  burst(x, y, color, count = 12, speed = 220) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.items.push({
        type: "particle", x, y, color,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
        size: 4 + Math.random() * 5, t: 0, life: 0.5 + Math.random() * 0.4
      });
    }
  },

  // Particles that float upward (healing sparkles).
  rise(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.items.push({
        type: "particle", x: x + (Math.random() - 0.5) * 60, y: y + Math.random() * 40, color,
        vx: (Math.random() - 0.5) * 30, vy: -80 - Math.random() * 80, gravity: 0,
        size: 4 + Math.random() * 4, t: 0, life: 0.8 + Math.random() * 0.5
      });
    }
  },

  ring(x, y, color, maxR = 200) {
    this.items.push({ type: "ring", x, y, color, maxR, t: 0, life: 0.45 });
  },

  update(dt) {
    for (const e of this.items) {
      e.t += dt;
      if (e.type === "particle") {
        e.vy += (e.gravity ?? 600) * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
    }
    this.items = this.items.filter(e => e.t < e.life);
  },

  draw(ctx) {
    for (const e of this.items) {
      const k = e.t / e.life;
      ctx.globalAlpha = 1 - k;
      if (e.type === "text") {
        const y = e.y - 60 * k;
        const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, k);
        ctx.font = `800 ${Math.round(e.size * pop)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#1f2937";
        ctx.strokeText(e.text, e.x, y);
        ctx.fillStyle = e.color;
        ctx.fillText(e.text, e.x, y);
      } else if (e.type === "particle") {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "ring") {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 10 * (1 - k) + 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.maxR * k, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },

  clear() {
    this.items = [];
  }
};
