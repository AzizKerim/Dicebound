# 🎲 Dicebound

> A tiny auto-battler where **your dice are your destiny**. Roll 2d6, let the **Dice Bag** decide what your hero does, level up, and take down **The Evil D100**. ⚔️

▶️ **Play it here:** [https://azizkerim.github.io/Dicebound/](https://azizkerim.github.io/Dicebound/)

No install, no account, no downloads. It runs right in your browser, on desktop and phone. 📱💻

## 🙌 Credits

Designed and built by **Kerim** 🎮 as a class project, made with the help of **Claude** 🤖 inside VS Code.
Course: Agentic Prototyping for Designers by Stone Librande
Thanks for playing! May your rolls be high and your Take Damage slots be few. 🍀🎲

---

## 🕹️ How to Play

There is no walking around and no button mashing. The game **rolls automatically** and your hero acts on whatever the dice say.

1. 🎲 Two six-sided dice are rolled and added together (**2 to 12**).
2. 🎒 The **Dice Bag** maps each number to an action (attack, heal, dodge, walk...).
3. 🧙 Your hero performs that action. Then the enemies take their turn.
4. ⭐ Defeat enemies to gain EXP, level up, and pick an upgrade.
5. 👹 Reach the end of the level and beat **The Evil D100** to win!

Your only real decisions are **which upgrades you pick**. You are building a dice strategy, not controlling a character.

---

## 🎒 The Dice Bag

Rolling two dice gives a **bell curve**: 7 is six times more likely than 2 or 12. Each bar in the bag shows the exact chance of that number. 📊

| Roll | Action | Type |
|:----:|--------|:----:|
| 2 | 💀 Take Damage | Bad |
| 3 | ⚔️ Basic Attack | Attack |
| 4 | ✚ Health Regen | Heal |
| 5 | 🔨 Heavy Attack | Attack |
| 6 | 🚶 Walk | Move |
| 7 | 💥 Critical Attack | Attack |
| 8 | 🛡️ Dodge | Defend |
| 9 | ⚔️ Basic Attack | Attack |
| 10 | ✚ Health Regen | Heal |
| 11 | ★ Special Attack | Special |
| 12 | 💚 Full Regen | Heal |

🔀 **Shuffle!** Every **5 rolls** the bag shuffles. The same actions stay in the bag, but they move to different numbers. Watch the bag, because yesterday's lucky 7 may be today's Take Damage.

### 🗡️ What each action does

| Action | Effect |
|--------|--------|
| ⚔️ Basic Attack | 8 damage to the nearest enemy |
| 🔨 Heavy Attack | 14 damage |
| 💥 Critical Attack | 24 damage |
| ★ Special Attack | 12 damage to **every** enemy in range |
| ✚ Health Regen | Restore 12 HP |
| 💚 Full Regen | Restore all HP |
| 🚶 Walk | Move forward through the level |
| 🛡️ Dodge | Gain a shield that blocks the next enemy attack |
| 💀 Take Damage | You hurt yourself for 6 |

> 💡 An attack with no enemy nearby makes your hero lunge forward a little, so the level never crawls.

---

## 👾 Enemies

| Enemy | HP | Damage | EXP |
|-------|:--:|:------:|:---:|
| 🟢 Blob | 22 | 5 | 10 |
| 🟣 Spiky | 34 | 8 | 16 |

Enemies approach once you get close, so choose your upgrades wisely.

---

## 👹 Boss: The Evil D100

The boss rolls a **d100** every turn and its intent is shown before it acts. 🎯

| D100 roll | Move | Effect |
|:---------:|------|--------|
| 1 to 30 | 👊 Bonk | 5 damage |
| 31 to 55 | 🔨 Heavy Slam | 10 damage |
| 56 to 68 | 🟢 Summon Minion | Calls a Blob |
| 69 to 82 | 🛡️ Defensive Stance | Takes half damage until its next turn |
| 83 to 99 | 💣 DEVASTATING ROLL | 18 damage |
| 100 | 🤡 Natural 100... it trips! | Hurts itself for 35 |

---

## ⭐ Level Up Upgrades

Every level you choose **1 of 3 cards** (click, or press **1 / 2 / 3**). Each level needs 1.5x more EXP than the last. 📈

### 🎯 ODDS cards (change what you roll)
| Upgrade | Effect |
|---------|--------|
| 🎲 **Loaded Die** | A die showing 1 rerolls once (pick twice to load both dice) |
| 🔁 **Second Chance** | Rolled "Take Damage"? Reroll once |
| 👁️ **Keen Eye** | +8% chance for any attack to crit for double damage |

### 💪 POWER cards (change how strong you are)
| Upgrade | Effect |
|---------|--------|
| 🗡️ **Sharper Sword** | +10% attack damage |
| 🧱 **Thick Skin** | +15 max HP and heal 15 |
| ❤️ **Big Heart** | +10% healing effectiveness |
| 🌀 **Slippery** | +8% chance to dodge any hit |
| 🪖 **Pot Helmet** | Take 10% less damage |
| 🦵 **Long Legs** | +25% walk distance |
| 🙈 **Less Clumsy** | "Take Damage" hurts 50% less |

### 🎒 DICE BAG cards (rewrite your bag)
Swap one action in the bag for a better one, for example replacing a **Take Damage** slot with a **Heavy Attack**. These cards are the heart of the game, because they let you build your own luck. 🍀

---

## 🧪 Tips

- 🔍 Hover over a slot in the Dice Bag to see its exact chance.
- 🎯 Numbers near **7** come up most often, so put your best actions there.
- 🛡️ Dodge stores at most **1** charge, so do not wait for more.
- 🧠 Watch the shuffle countdown and plan around it.
- ⏩ Want it faster? Add `?speed=3` to the URL (for example `https://azizkerim.github.io/Dicebound/?speed=3`).

---

## 📁 Project Structure

```
index.html        # 🌐 The whole game in one file (what GitHub Pages serves)
dice-roller.html  # 🎲 The original 3D dice roller warm-up
dicebound/
├── index.html    # Page layout, styles and script loading
├── config.js     # ⚙️ All tunable gameplay values (damage, HP, bag, upgrades)
├── dice.js       # 🎲 Dice rolls, exact probabilities and the Dice Bag
├── effects.js    # ✨ Floating numbers, particles and rings
├── entities.js   # 🧙 Player, enemies and the boss
├── ui.js         # 🖥️ HUD, dice, bag, level-up cards and end screens
├── game.js       # 🔁 Main game loop and turn flow
└── bundle.sh     # 📦 Rebuilds the root index.html from these files
```

Built with plain **HTML, CSS and JavaScript**, with no frameworks and no libraries. 🚫📦

---

## 🛠️ Run Locally

1. Download or clone this repo:
   ```bash
   git clone https://github.com/AzizKerim/Dicebound.git
   ```
2. Open `index.html` in your browser. 🎉

The scripts are plain (not modules), so a double-click is enough. No server needed.

### 🎛️ Balance it yourself

Everything lives in **`config.js`**. Make enemies tougher, change the Dice Bag layout, speed up the shuffle, or add new upgrades without touching the game logic. 🔧

After changing anything in `dicebound/`, run `sh dicebound/bundle.sh` to rebuild the root `index.html` before you push.

---

## 🚀 Publish Your Own Copy (GitHub Pages)

1. 🗂️ Put the game files (with `index.html`) at the **root** of a GitHub repo.
2. 🌐 Open **Settings → Pages**.
3. 🌿 Under *Build and deployment*, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. ⏳ Wait a minute or two. Your game is live at `https://YOUR_USERNAME.github.io/REPO_NAME/`.
