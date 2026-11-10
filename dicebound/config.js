// =====================================================================
// DICEBOUND - all tunable gameplay values live here.
// =====================================================================

const CONFIG = {
  // Global speed multiplier (2 = everything twice as fast).
  // You can also pass ?speed=3 in the URL.
  gameSpeed: 1,

  // Turn timing in milliseconds (divided by gameSpeed).
  timing: {
    rollAnim: 560,      // dice tumbling
    reveal: 360,        // show result + highlight slot before acting
    action: 480,        // player action animation
    enemyStep: 300,     // per enemy turn
    bossRoll: 650,      // D100 tumbling
    bossReveal: 600,    // boss intent shown before it acts
    betweenTurns: 300,  // pause before the next automatic roll
    bagShuffle: 900     // Dice Bag shuffle animation
  },

  // Every N rolls the Dice Bag shuffles: its actions are randomly
  // re-assigned to the numbers 2..12. Contents stay the same, positions change.
  bagShuffle: {
    everyRolls: 5,      // set 0 to disable
    // Only shuffle this many random pairs of slots (null = full shuffle).
    pairSwaps: null
  },

  // At most this many Dodge charges can be stored. Each charge blocks one enemy attack.
  maxDodgeCharges: 1,

  // Damage multiplier when an attack randomly crits (see "Keen Eye" upgrade).
  critMultiplier: 2,

  world: {
    width: 960,          // canvas logical size
    height: 460,
    groundY: 370,        // y of the ground surface
    levelLength: 2300,   // world x of the level end
    aggroRange: 520      // enemies within this distance start approaching
  },

  player: {
    maxHp: 100,
    startX: 120,
    walkDistance: 170,
    meleeRange: 125,     // attacks hit the nearest enemy within this distance
    specialRange: 330,   // special attack hits every enemy within this distance
    // Design choice: an attack with no enemy in range lunges forward a bit,
    // so the level does not crawl when the dice refuse to roll a 6. Set 0 to disable.
    attackLunge: 45,
    minGapToEnemy: 75    // the player cannot walk through enemies
  },

  // Every action the Dice Bag can contain.
  actions: {
    takeDamage:    { name: "Take Damage",     kind: "bad",     amount: 6 },
    basicAttack:   { name: "Basic Attack",    kind: "attack",  damage: 8 },
    heavyAttack:   { name: "Heavy Attack",    kind: "attack",  damage: 14 },
    critAttack:    { name: "Critical Attack", kind: "attack",  damage: 24 },
    specialAttack: { name: "Special Attack",  kind: "special", damage: 12 }, // hits all enemies in specialRange
    heal:          { name: "Health Regen",    kind: "heal",    amount: 12 },
    fullHeal:      { name: "Full Regen",      kind: "heal" },
    walk:          { name: "Walk",            kind: "move" },
    dodge:         { name: "Dodge",           kind: "defend" }  // gain a shield that blocks the next enemy attack
  },

  // Dice result -> action id. Exact starting configuration.
  diceBag: {
    2: "takeDamage",
    3: "basicAttack",
    4: "heal",
    5: "heavyAttack",
    6: "walk",
    7: "critAttack",
    8: "dodge",
    9: "basicAttack",
    10: "heal",
    11: "specialAttack",
    12: "fullHeal"
  },

  enemies: {
    blob:  { name: "Blob",  hp: 22, damage: 5, speed: 70, range: 95,  exp: 10, color: "#5cc96b" },
    spiky: { name: "Spiky", hp: 34, damage: 8, speed: 50, range: 105, exp: 16, color: "#a66be0" }
  },

  // Enemy placement along the level (world x).
  spawns: [
    { type: "blob",  x: 620 },
    { type: "blob",  x: 760 },
    { type: "spiky", x: 1150 },
    { type: "blob",  x: 1450 },
    { type: "spiky", x: 1560 }
  ],

  boss: {
    name: "The Evil D100",
    x: 2080,
    hp: 100,
    speed: 80,
    range: 140,       // stops at ~85% of this, inside the player's melee range
    exp: 0,
    summonType: "blob",
    // D100 table: each entry covers results up to `max` (inclusive). Order matters.
    table: [
      { max: 30,  id: "basic",     name: "Bonk",                 damage: 5 },
      { max: 55,  id: "heavy",     name: "Heavy Slam",           damage: 10 },
      { max: 68,  id: "summon",    name: "Summon Minion" },
      { max: 82,  id: "defend",    name: "Defensive Stance",     reduction: 0.5 }, // halves damage taken until its next turn
      { max: 99,  id: "devastate", name: "DEVASTATING ROLL",     damage: 18 },
      { max: 100, id: "fumble",    name: "Natural 100... it trips!", selfDamage: 35 }
    ]
  },

  exp: {
    firstLevel: 20,   // EXP needed for level 2
    growth: 1.5       // each level needs 1.5x more
  },

  // Dice Bag swap cards offered on level-up ("replace one action with another").
  bagSwap: {
    cardsPerLevelUp: 1,       // how many of the 3 level-up cards are bag swaps
    badSlotBias: 0.6,         // chance the offer targets a "Take Damage" slot if you still have one
    // Actions a swap can put into the bag (repeat an id to make it more common).
    offers: ["basicAttack", "heavyAttack", "heavyAttack", "critAttack", "specialAttack", "heal", "walk", "dodge", "fullHeal"]
  },

  // Level-up choices. `apply` mutates the player's stats.
  // `type`: "power" changes how strong actions are, "odds" changes what you roll.
  // Optional `available(p)` hides an upgrade once it is maxed out.
  upgrades: [
    { id: "loaded", type: "odds", name: "Loaded Die",    desc: "A die that shows 1 rerolls once (pick twice: both dice)",
      available: p => p.stats.loadedDice < 2, apply: p => { p.stats.loadedDice++; } },
    { id: "second", type: "odds", name: "Second Chance", desc: "Rolled 'Take Damage'? Reroll once",
      available: p => !p.stats.secondChance, apply: p => { p.stats.secondChance = true; } },
    { id: "keen",   type: "odds", name: "Keen Eye",      desc: "+8% chance any attack crits for double damage", apply: p => { p.stats.critChance += 0.08; } },

    // Power upgrades (all stack)
    { id: "dmg",    name: "Sharper Sword", desc: "+10% attack damage",           apply: p => { p.stats.damageMult += 0.10; } },
    { id: "hp",     name: "Thick Skin",    desc: "+15 max HP (and heal 15)",     apply: p => { p.maxHp += 15; p.hp = Math.min(p.maxHp, p.hp + 15); } },
    { id: "heal",   name: "Big Heart",     desc: "+10% healing effectiveness",   apply: p => { p.stats.healMult += 0.10; } },
    { id: "dodge",  name: "Slippery",      desc: "+8% chance to dodge any hit",  apply: p => { p.stats.dodgeChance += 0.08; } },
    { id: "armor",  name: "Pot Helmet",    desc: "Take 10% less damage",         apply: p => { p.stats.damageTaken *= 0.9; } },
    { id: "legs",   name: "Long Legs",     desc: "+25% walk distance",           apply: p => { p.stats.walkMult += 0.25; } },
    { id: "clumsy", name: "Less Clumsy",   desc: "'Take Damage' hurts 50% less", apply: p => { p.stats.selfDamageMult *= 0.5; } }
  ]
};
