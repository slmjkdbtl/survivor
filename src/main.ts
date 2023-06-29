import kaboom, {
	Vec2,
	Key,
	GameObj,
	PosComp,
	ScaleComp,
	HealthComp,
	TimerComp,
	ColorComp,
} from "kaboom"

const k = kaboom({
	canvas: document.querySelector("#game"),
	font: "happy",
})

// Keep constants in one place so we can tweak them easily
const SPEED = 320
const WIDTH = 1920
const HEIGHT = 1920
const TILE_WIDTH = 64
const TILE_HEIGHT = 64
const MAX_HP = 100
const HPBAR_WIDTH = 200
const EXPBAR_WIDTH = 200
const SWORD_SPEED = 60
const MAX_SWORDS = 3
const BULLET_SPEED = 800
const DINO_BULLET_SPEED = 400
const BTFLY_SPEED = 300
const DINO_SPEED = 80
const GIGAGANTRUM_SPEED = 200
const BAG_SPEED = 60
const SWORD_DMG = 150
const GUN_DMG = 100
const DIZZY_SPEED = 1000
const MAX_EXP_INIT = 10
const MAX_EXP_STEP = 5
const BOSS_MARK = 3000
const BOSS_MARK_STEP = 3000
const TOUCH_SPEED = 40

const colors = {
	red: k.rgb(204, 66, 94),
	green: k.rgb(91, 166, 117),
	orange: k.rgb(255, 184, 121),
	black: k.rgb(31, 16, 42),
	blue: k.rgb(109, 128, 250),
	lightblue: k.rgb(141, 183, 255),
	grey: k.rgb(166, 133, 159),
}

k.volume(0.5)
k.setBackground(k.black)

const sprites = [
	"bean",
	"bag",
	"dino",
	"btfly",
	"gigagantrum",
	"hpbar",
	"expbar",
	"toolbar",
	"sword",
	"gun",
	"heart",
	"trumpet",
	"!",
]

const aseprites = [
	"field",
]

for (const spr of sprites) {
	k.loadSprite(spr, `sprites/${spr}.png`)
}

for (const spr of aseprites) {
	k.loadAseprite(spr, `sprites/${spr}.png`, `sprites/${spr}.json`)
}

k.loadBitmapFont("happy", "sprites/happy_28x36.png", 28, 36, {
	// TODO: not working
	outline: 4,
})

const sounds = [
	"music",
	"music2",
	"sword",
	"wooosh",
	"shoot",
	"spring",
	"off",
	"alarm",
	"powerup",
	"mystic",
	"error",
	"horn",
]

for (const snd of sounds) {
	k.loadSound(snd, `sounds/${snd}.mp3`)
}

let music = k.play("music", {
	loop: true,
	// paused: true,
})

// All objects in the main game scene will all be children of this "game" game
// object, so can more easily manage them. For example, we just need to toggle
// game.paused to pause everything, useful for menues and stuff.
const game = k.add([
	// We also add a timer component to this master game object and we use
	// game.wait(), game.tween() etc for in game timer events instead of k.wait()
	// so these timers can be paused when game.paused is true
	k.timer(),
])

// Also initialize the parent game object of all UI objects
const ui = game.add([
	// All UI objects don't respond to camera, so we use a fixed() component
	k.fixed(),
	// They should be always drawn above the game, so we explicitly give it a z()
	k.z(100),
])

// Add the background tiles
for (let i = 0; i < WIDTH / TILE_WIDTH; i++) {
	for (let j = 0; j < HEIGHT / TILE_HEIGHT; j++) {
		game.add([
			k.pos(j * TILE_WIDTH, i * TILE_HEIGHT ),
			k.sprite("field", { frame: k.randi(0, 4) }),
		])
	}
}

// Pause game when user press escape, we just toggle the paused / hidden props
// the "game" parent game object and "menu" parent game object
k.onKeyPress("escape", () => {
	if (game.paused && !menu.hidden) {
		music.paused = false
		game.paused = false
		menu.paused = true
		menu.hidden = true
	} else if (!game.paused && menu.hidden) {
		music.paused = true
		game.paused = true
		menu.paused = false
		menu.hidden = false
	}
})

// Add our main character
const bean = game.add([
	k.pos(WIDTH / 2, HEIGHT / 2),
	k.sprite("bean"),
	k.anchor("center"),
	k.area({ scale: 0.8 }),
	k.health(100),
	k.scale(),
	highlight(),
])

// Add a screen filter to UI that turns red when player gets hit
const dmgFilter = ui.add([
	k.fixed(),
	k.rect(k.width(), k.height()),
	k.color(colors.red),
	k.opacity(0),
	k.z(200),
])

// Add some feedbacks when bean is hurt - show a short red screen filter effect
// and screen shake
bean.onHurt((dmg) => {
	// Cap the damage filter opacity to 0.7
	dmgFilter.opacity = Math.min(0.7, dmgFilter.opacity + k.dt() * 2.5)
	k.shake(5)
})

// Always recover to 0
dmgFilter.onUpdate(() => {
	dmgFilter.opacity = Math.max(0, dmgFilter.opacity - k.dt())
})

// Add feedbacks when we heal
bean.onHeal((dmg) => {
	if (bean.hp() > MAX_HP) bean.setHP(MAX_HP)
	// highlight() is from the custom component highlight(), which makes the game
	// objects scale big a bit and then recover to normal
	hpbar.highlight()
	bean.highlight()
})

// A parent game object to manage all swords
const swords = bean.add([
	k.rotate(0),
	{ speed: SWORD_SPEED },
])

// The swords will be constantly rotating, we only have to rotate the parent
// game object!
swords.onUpdate(() => {
	swords.angle += k.dt() * swords.speed
})

// Parent game object for all guns
const guns = bean.add([])
// Parent game object for all trumpets
const trumpets = bean.add([])

// Current player level on all weapons, start with level 1 on sword
const levels = {
	sword: 1,
	gun: 0,
	trumpet: 0,
}

// Add swords mechanics
function initSwords() {
	// To make it easy we'll remove all swords and add them again (it's cheap)
	swords.removeAll()
	if (levels.sword <= 0) return
	const numSwords = Math.min(levels.sword, MAX_SWORDS)
	const interval = 360 / numSwords
	for (let i = 0; i < numSwords; i++) {
		// Use another indirect parent game object to manage the swords position
		// to the center
		const center = swords.add([
			k.rotate(i * interval),
		])
		const sword = center.add([
			k.pos(0, -70),
			k.sprite("sword"),
			k.anchor("center"),
			k.area({ shape: new k.Rect(k.vec2(0, -10), 5, 40) }),
			{ dmg: SWORD_DMG },
		])
		sword.onCollide("enemy", (e) => {
			k.play("sword", {
				// Randomly detune the sound effect to add some variation when multiple
				// happening sequetially
				detune: k.rand(-300, 300),
			})
			e.hurt(sword.dmg)
		})
	}
	// When level is more than 4, we increase the rotate speed
	if (levels.sword >= 4) {
		swords.speed = SWORD_SPEED * (levels.sword - 2)
	}
	updateToolbar()
}

function initGuns() {
	guns.removeAll()
	if (levels.gun <= 0) return
	const rate = levels.gun >= 3 ? 1 / (levels.gun - 1) : 1
	const gun = guns.add([
		k.pos(60, 0),
		k.sprite("gun"),
		k.anchor("center"),
		k.timer(),
	])
	gun.loop(rate, () => {
		game.add([
			k.rect(24, 8, { radius: 2 }),
			k.outline(4, colors.black),
			k.pos(gun.worldPos().add(16, -8)),
			k.move(k.RIGHT, BULLET_SPEED),
			k.color(colors.grey),
			k.lifespan(10),
			k.area(),
			"bullet",
			{ dmg: GUN_DMG },
		])
	})
	// TODO: clean
	if (levels.gun >= 2) {
		const gun = guns.add([
			k.pos(-60, 0),
			k.sprite("gun", { flipX: true }),
			k.anchor("center"),
			k.timer(),
		])
		gun.loop(rate, () => {
			game.add([
				k.rect(24, 8, { radius: 2 }),
				k.outline(4, colors.black),
				k.pos(gun.worldPos().add(-16, -8)),
				k.move(k.LEFT, BULLET_SPEED),
				k.color(colors.grey),
				k.lifespan(10),
				k.area(),
				"bullet",
				{ dmg: GUN_DMG },
			])
		})
	}
	updateToolbar()
}

function initTrumpet() {
	trumpets.removeAll()
	if (levels.trumpet <= 0) return
	const trumpet = trumpets.add([
		k.pos(0, 0),
		k.sprite("trumpet"),
		k.timer(),
		k.scale(),
		highlight(),
	])
	trumpet.loop(3, async () => {
		// TODO: find all enemies within a radius
		for (const e of game.get("enemy")) {
			if (e.pos.dist(bean.pos) <= 240) {
				e.enterState("dizzy")
			}
		}
		trumpet.highlight()
		k.play("horn")
		const effect = bean.add([
			k.circle(0),
			k.timer(),
			k.opacity(0.3),
			k.color(),
			k.z(-100),
		])
		effect.onUpdate(() => {
			const c1 = colors.lightblue
			const c2 = colors.green
			const s = 16
			effect.color.r = k.wave(c1.r, c2.r, k.time() * s)
			effect.color.g = k.wave(c1.g, c2.g, k.time() * s)
			effect.color.b = k.wave(c1.b, c2.b, k.time() * s)
		})
		effect.tween(0, 300, 1, (r) => effect.radius = r)
		effect.tween(1, 0, 1, (o) => effect.opacity = o)
		effect.wait(1, () => effect.destroy())
	})
	updateToolbar()
}

k.onCollide("bullet", "enemy", (b, e) => {
	e.hurt(b.dmg)
	if (e.is("boss")) {
		b.destroy()
	}
})

// The toolbar UI element to show the current levels on all weapons
const toolbar = ui.add([
	k.pos(k.vec2(24, k.height() - 24)),
	k.scale(),
	k.sprite("toolbar"),
	k.fixed(),
	k.anchor("botleft"),
	highlight({ scale: 1.1 }),
])

initSwords()
initGuns()
initTrumpet()

// Update the toolbar to reflect current levels. To make it easy we'll just
// remove everything and initialize items again.
function updateToolbar() {
	toolbar.removeAll()
	let x = 36
	for (const tool in levels) {
		const level = levels[tool]
		if (level <= 0) continue
		toolbar.add([
			k.sprite(tool),
			k.pos(x, -38),
			k.fixed(),
			k.anchor("center"),
			k.scale(0.8),
		])
		const dot = toolbar.add([
			k.circle(12),
			k.fixed(),
			k.pos(x + 22, -24),
			k.anchor("center"),
			k.color(colors.black),
		])
		dot.add([
			k.text(level + "", { size: 16 }),
			k.fixed(),
			k.anchor("center"),
		])
		x += 64
	}
}

updateToolbar()

// TODO: this still runs when game is paused
bean.onCollideUpdate("enemy", (e) => {
	if (game.paused) return
	bean.hurt(k.dt() * e.dmg)
})

const hurtSnd = k.play("alarm", { loop: true, paused: true })

bean.onCollide("enemy", (e) => {
	hurtSnd.play()
})

bean.onCollideEnd("enemy", (e) => {
	const cols = bean.getCollisions()
	hurtSnd.paused = true
})

bean.onCollide("enemybullet", (e) => {
	bean.hurt(e.dmg)
	e.destroy()
})

bean.onDeath(() => {
	game.paused = true
	lose.paused = false
	lose.hidden = false
	hurtSnd.paused = true
})

const dirs = {
	"left": k.LEFT,
	"right": k.RIGHT,
	"up": k.UP,
	"down": k.DOWN,
}

k.onUpdate(() => {
	k.camPos(bean.pos)
})

for (const dir in dirs) {
	k.onKeyDown(dir as Key, () => {
		if (game.paused) return
		bean.move(dirs[dir].scale(SPEED))
		const xMin = bean.width / 2
		const yMin = bean.height / 2
		const xMax = WIDTH - bean.width / 2
		const yMax = HEIGHT - bean.height / 2
		if (bean.pos.x < xMin) bean.pos.x = xMin
		if (bean.pos.y < yMin) bean.pos.y = yMin
		if (bean.pos.x > xMax) bean.pos.x = xMax
		if (bean.pos.y > yMax) bean.pos.y = yMax
	})
}

function bounce(opts: {
	to?: number,
	keep?: boolean,
} = {}) {
	let timer = 0
	const speed = 10
	const to = opts.to || 1
	return {
		id: "bounce",
		require: [ "scale" ],
		async add(this: GameObj<ScaleComp | TimerComp>) {
			// TODO: easier to use timer tied to game object
			this.use(k.timer())
			this.scaleTo(0, 0)
			await this.tween(0, to, 1, (s) => this.scaleTo(s), k.easings.easeOutElastic)
			if (opts.keep) {
				this.onUpdate(() => {
					this.scaleTo(k.wave(to, to * 1.2, timer * speed, (t) => -Math.cos(t)))
					timer += k.dt()
				})
			}
		},
	}
}

function highlight(opts: {
	speed?: number,
	scale?: number,
} = {}) {
	let highlighting = false
	let timer = 0
	const speed = opts.speed || 10
	const scale = opts.scale || 1.5
	const cycle = Math.PI / speed * 2
	return {
		require: [ "scale" ],
		highlight() {
			highlighting = true
			timer = 0
		},
		update(this: GameObj<ScaleComp>) {
			if (!highlighting) return
			timer += k.dt()
			this.scaleTo(k.wave(1, scale, timer * speed, (t) => -Math.cos(t)))
			if (timer >= cycle) {
				highlighting = false
				this.scaleTo(1)
			}
		},
	}
}

let bossMark = BOSS_MARK

function enemy(opts: {
	dmg?: number,
	exp?: number,
} = {}) {
	return {
		id: "enemy",
		dmg: opts.dmg ?? 50,
		update() {
			this.color.r = k.lerp(this.color.r, 255, k.dt())
			this.color.g = k.lerp(this.color.g, 255, k.dt())
			this.color.b = k.lerp(this.color.b, 255, k.dt())
		},
		add(this: GameObj<PosComp | HealthComp | ColorComp>) {
			this.onHurt(() => {
				if (this.hp() <= 0) return
				this.color = k.rgb(150, 150, 255)
			})
			this.onDeath(() => {
				this.destroy()
				k.addKaboom(this.pos)
				setScore((s) => s + (this.is("boss") ? 2000 : 100))
				if (score >= bossMark) {
					bossMark += BOSS_MARK_STEP + 2000
					spawnGigagantrum()
				}
				exp += opts.exp ?? 1
				if (exp >= maxExp) {
					exp = exp - maxExp
					presentUpgrades()
					maxExp += MAX_EXP_STEP
				}
				if (k.chance(0.2)) {
					addHeart(this.pos)
				}
			})
		},
	}
}

// TODO: dont spawn on bean or outside
function getSpawnPos() {
	return bean.pos.add(k.rand(-400, 400), k.rand(-400, 400))
}

function spawnBag() {
	const bag = game.add([
		k.pos(getSpawnPos()),
		k.sprite("bag"),
		k.anchor("center"),
		k.scale(),
		k.rotate(0),
		k.area({ scale: 0.8 }),
		k.health(100),
		k.state("move"),
		k.timer(),
		k.color(),
		bounce(),
		enemy({ dmg: 50 }),
		"minion",
	])
	bag.onStateUpdate("move", async () => {
		const dir = bean.pos.sub(bag.pos).unit()
		bag.move(dir.scale(BAG_SPEED))
	})
	bag.onStateEnter("dizzy", async () => {
		await bag.wait(2)
		if (bag.state !== "dizzy") return
		bag.enterState("move")
	})
	bag.onStateUpdate("dizzy", async () => {
		bag.angle += k.dt() * DIZZY_SPEED
	})
	bag.onStateEnd("dizzy", async () => {
		bag.angle = 0
	})
	// bag.add([
		// k.rect(40, 8, { radius: 4 }),
		// k.color(colors.black),
		// k.pos(-20, -40),
	// ])
	// bag.add([
		// k.rect(40, 8, { radius: 4 }),
		// k.color(colors.green),
		// k.pos(-20, -40),
	// ])
	// bag.add([
		// k.rect(40, 8, { radius: 4 }),
		// k.outline(4, colors.black),
		// k.pos(-20, -40),
	// ])
	return bag
}

function spawnBtfly() {
	const btfly = game.add([
		k.pos(getSpawnPos()),
		k.sprite("btfly"),
		k.anchor("center"),
		k.scale(),
		k.rotate(0),
		k.area({ scale: 0.8 }),
		k.state("idle"),
		k.health(100),
		k.timer(),
		k.color(),
		bounce(),
		enemy({ dmg: 50 }),
		"minion",
	])
	btfly.onUpdate(() => {
		btfly.pos.x += k.dt() * k.rand(-1, 1) * 100
		btfly.pos.y += k.dt() * k.rand(-1, 1) * 100
	})
	btfly.onStateEnter("idle", async () => {
		await btfly.wait(2)
		if (btfly.state !== "idle") return
		btfly.enterState("attack")
	})
	btfly.onStateEnter("attack", async () => {
		const dir = bean.pos.sub(btfly.pos).unit()
		const dest = bean.pos.add(dir.scale(100))
		const dis = bean.pos.dist(btfly.pos)
		const t = dis / BTFLY_SPEED
		k.play("wooosh", {
			detune: k.rand(-300, 300),
			volume: Math.min(1, 320 / dis),
		})
		await btfly.tween(btfly.pos, dest, t, (p) => btfly.pos = p, k.easings.easeOutQuad)
		btfly.enterState("idle")
	})
	btfly.onStateEnter("dizzy", async () => {
		await btfly.wait(2)
		if (btfly.state !== "dizzy") return
		btfly.enterState("idle")
	})
	btfly.onStateUpdate("dizzy", async () => {
		btfly.angle += k.dt() * DIZZY_SPEED
	})
	btfly.onStateEnd("dizzy", async () => {
		btfly.angle = 0
	})
	return btfly
}

function spawnDino() {
	const dino = game.add([
		k.pos(getSpawnPos()),
		k.sprite("dino"),
		k.anchor("center"),
		k.scale(),
		k.rotate(0),
		k.area({ scale: 0.8 }),
		k.state("idle"),
		k.timer(),
		k.health(100),
		k.color(),
		bounce(),
		enemy({ dmg: 50 }),
		"minion",
	])
	dino.onUpdate(() => {
		dino.flipX = bean.pos.x < dino.pos.x
	})
	dino.onStateEnter("idle", async () => {
		await dino.wait(1)
		if (dino.state !== "idle") return
		dino.enterState("attack")
	})
	dino.onStateEnter("attack", async () => {
		game.add([
			k.rect(24, 8, { radius: 2 }),
			k.outline(4, colors.black),
			k.pos(dino.worldPos().add(dino.flipX ? -24 : 24, 4)),
			k.move(dino.flipX ? k.LEFT : k.RIGHT, DINO_BULLET_SPEED),
			k.color(colors.grey),
			k.area(),
			k.lifespan(10),
			"enemybullet",
			{ dmg: 20 },
		])
		const dis = bean.pos.dist(dino.pos)
		k.play("shoot", {
			detune: k.rand(-300, 300),
			volume: Math.min(1, 320 / dis),
		})
		await dino.wait(1)
		if (dino.state !== "attack") return
		dino.enterState("move")
	})
	dino.onStateUpdate("move", async () => {
		const dir = bean.pos.sub(dino.pos).unit()
		dino.move(dir.scale(DINO_SPEED))
		if (Math.abs(bean.pos.y - dino.pos.y) < 50 && bean.pos.dist(dino.pos) < 400) {
			dino.enterState("idle")
		}
	})
	dino.onStateEnter("dizzy", async () => {
		await dino.wait(2)
		if (dino.state !== "dizzy") return
		dino.enterState("idle")
	})
	dino.onStateUpdate("dizzy", async () => {
		dino.angle += k.dt() * DIZZY_SPEED
	})
	dino.onStateEnd("dizzy", async () => {
		dino.angle = 0
	})
	return dino
}

let isBossFighting = false

async function spawnGigagantrum() {
	if (isBossFighting) return
	isBossFighting = true
	const minions = game.get("minion")
	for (const m of minions) {
		m.paused = true
		game.add([
			k.sprite("!"),
			k.pos(m.pos.add(40, -40)),
			k.scale(),
			k.opacity(1),
			k.lifespan(2, { fade: 0.5 }),
			bounce(),
		])
	}
	await game.wait(2)
	for (const m of minions) {
		k.addKaboom(m.pos)
		m.destroy()
	}
	const maxHP = 2000
	await game.wait(1)
	k.play("mystic")
	music.paused = true
	music = k.play("music2", { loop: true })
	const boss = game.add([
		k.pos(getSpawnPos()),
		k.sprite("gigagantrum"),
		k.anchor("center"),
		k.scale(),
		k.rotate(0),
		k.area({ shape: new k.Rect(k.vec2(0), 80, 160) }),
		k.state("idle"),
		k.timer(),
		k.health(maxHP),
		k.color(),
		bounce(),
		enemy({ dmg: 80, exp: 20 }),
		"boss",
	])
	boss.onDeath(() => {
		isBossFighting = false
		music.paused = true
		music = k.play("music", { loop: true })
	})
	boss.onStateEnter("idle", async () => {
		await boss.wait(1)
		boss.enterState(`charge${k.choose([1, 2])}`)
	})
	boss.onStateEnter("charge1", async () => {
		await boss.wait(1)
		boss.enterState("attack1")
	})
	boss.onStateUpdate("charge1", () => {
		boss.pos = boss.pos.add(k.rand(-5, 5), k.rand(-5, 5))
	})
	boss.onStateEnter("attack1", async () => {
		const num = 20
		for (let i = 0; i < num; i++) {
			const b = game.add([
				k.pos(boss.pos),
				k.circle(12),
				k.outline(4, colors.black),
				k.anchor("center"),
				k.area({ scale: 0.5 }),
				k.move(k.Vec2.fromAngle(360 / num * i), BULLET_SPEED),
				k.lifespan(10),
				k.color(),
				"enemybullet",
				{ dmg: 20 },
			])
			// b.onUpdate(() => {
				// b.color = k.choose(Object.values(colors))
			// })
		}
		k.play("error", { volume: 0.3 })
		await boss.wait(1)
		boss.enterState("move")
	})
	boss.onStateEnter("charge2", async () => {
		await boss.wait(1)
		boss.enterState("attack2")
	})
	boss.onStateDraw("charge2", () => {
		const diff = bean.pos.sub(boss.pos).unit()
		const p1 = diff.scale(80)
		const p2 = diff.scale(240)
		const p3 = p2.add(k.Vec2.fromAngle(boss.pos.angle(bean.pos) + 45).scale(40))
		const p4 = p2.add(k.Vec2.fromAngle(boss.pos.angle(bean.pos) - 45).scale(40))
		const opts = {
			width: 4,
			opacity: k.wave(0, 1, k.time() * 12),
			color: colors.black,
		}
		k.drawLine({ p1: p1, p2: p2, ...opts })
		k.drawLine({ p1: p2, p2: p3, ...opts })
		k.drawLine({ p1: p2, p2: p4, ...opts })
	})
	boss.onStateEnter("attack2", async () => {
		const dir = bean.pos.sub(boss.pos).unit()
		const dest = bean.pos.add(dir.scale(100))
		const dis = bean.pos.dist(boss.pos)
		const t = dis / (GIGAGANTRUM_SPEED * 3)
		k.play("error")
		await boss.tween(boss.pos, dest, t, (p) => boss.pos = p, k.easings.easeOutQuad)
		boss.enterState("idle")
	})
	boss.onStateEnter("move", async () => {
		await boss.wait(1)
		boss.enterState("idle")
	})
	boss.onStateUpdate("move", async () => {
		const dir = bean.pos.sub(boss.pos).unit()
		boss.move(dir.scale(GIGAGANTRUM_SPEED))
	})
	// TODO: clean
	boss.add([
		k.rect(60, 12, { radius: 6 }),
		k.color(colors.black),
		k.pos(-30, -120),
	])
	const hp = boss.add([
		k.rect(60 - 8, 12 - 8, { radius: 4 }),
		k.color(colors.green),
		k.pos(-30 + 4, -120 + 4),
	])
	hp.onUpdate(() => {
		hp.width = k.lerp(
			hp.width,
			52 * boss.hp() / maxHP,
			k.dt() * 12,
		)
	})
	return boss
}

game.loop(0.5, () => {
	if (isBossFighting) return
	k.choose([
		spawnBag,
		spawnBtfly,
		spawnDino,
	])()
})

bean.onCollide("heart", (h) => {
	k.play("powerup"),
	bean.heal(10)
	h.destroy()
})

function addHeart(pos: Vec2) {
	return game.add([
		k.pos(pos),
		k.scale(),
		k.anchor("center"),
		k.sprite("heart"),
		k.area(),
		bounce({ keep: true }),
		"heart",
	])
}

function addBar(pos, width, color, sprite, getPerc) {

	const bg = ui.add([
		k.pos(pos),
		k.scale(),
		k.rect(width, 16, { radius: 8 }),
		k.fixed(),
		k.color(colors.black),
		highlight({ scale: 1.1 }),
	])

	const bar = bg.add([
		k.rect(0, 16, { radius: 8 }),
		k.fixed(),
		k.color(color),
	])

	bar.add([
		k.pos(0, -22),
		k.sprite(sprite),
		k.fixed(),
	])

	bar.onUpdate(() => {
		bar.width = k.lerp(
			bar.width,
			width * getPerc(),
			k.dt() * 12,
		)
	})

	return bg

}

const hpbar = addBar(k.vec2(24, 44), HPBAR_WIDTH, colors.green, "hpbar", () => bean.hp() / MAX_HP)
const expbar = addBar(k.vec2(24, 90), EXPBAR_WIDTH, colors.lightblue, "expbar", () => exp / maxExp)

let score = 0
let exp = 0
let maxExp = MAX_EXP_INIT

function setScore(s: number | ((prev: number) => number)) {
	score = typeof s === "number" ? s : s(score)
	scoreLabel.text = score + ""
	scoreLabel.highlight()
}

const scoreLabel = ui.add([
	k.text("0", {
		transform: (idx, ch) => ({
			color: k.hsl2rgb((k.time() * 0.2 + idx * 0.1) % 1, 0.7, 0.8),
			pos: k.vec2(0, k.wave(-4, 4, k.time() * 4 + idx * 0.5)),
			scale: k.wave(1, 1.2, k.time() * 3 + idx),
			angle: k.wave(-9, 9, k.time() * 3 + idx),
		}),
	}),
	k.anchor("topright"),
	k.pos(k.width() - 24, 24),
	k.fixed(),
	k.scale(),
	highlight(),
])

const lose = k.add([
	k.timer(),
	k.fixed(),
])

lose.hidden = true
lose.paused = true

function reset() {
	for (const e of game.get("enemy")) {
		k.addKaboom(e.pos)
		e.destroy()
	}
	game.removeAll("heart")
	bean.setHP(bean.maxHP())
	levels.sword = 1
	levels.gun = 0
	levels.trumpet = 0
	initSwords()
	initTrumpet()
	initGuns()
	setScore(0)
	exp = 0
	isBossFighting = false
	maxExp = MAX_EXP_INIT
	bossMark = BOSS_MARK
	music.paused = true
	music = k.play("music", { loop: true })
}

k.onKeyPress("space", () => {
	if (lose.hidden) return
	lose.hidden = true
	lose.paused = true
	game.paused = false
	reset()
})

k.onMousePress(() => {
	if (lose.hidden) return
	lose.hidden = true
	lose.paused = true
	game.paused = false
	reset()
})

function makeFilter() {
	return k.make([
		k.rect(k.width(), k.height()),
		k.color(0, 0, 0),
		k.opacity(0.7),
		k.fixed(),
	])
}

lose.add(makeFilter())

lose.add([
	k.text("You Lose!", {
		size: 64,
		transform: (idx, ch) => ({
			color: k.hsl2rgb((k.time() * 0.2 + idx * 0.1) % 1, 0.7, 0.8),
			pos: k.vec2(0, k.wave(-4, 4, k.time() * 4 + idx * 0.5)),
			scale: k.wave(1, 1.2, k.time() * 3 + idx),
			angle: k.wave(-9, 9, k.time() * 3 + idx),
		}),
	}),
	k.anchor("center"),
	k.pos(k.width() / 2, k.height() / 2),
	k.fixed(),
])

const menu = k.add([
	k.fixed(),
	k.z(100),
])

menu.hidden = true
menu.paused = true
menu.add(makeFilter())

menu.add([
	k.rect(12, 48, { radius: 4 }),
	k.fixed(),
	k.pos(k.width() / 2 - 12, k.height() / 2),
	k.anchor("center"),
])

menu.add([
	k.rect(12, 48, { radius: 4 }),
	k.fixed(),
	k.pos(k.width() / 2 + 12, k.height() / 2),
	k.anchor("center"),
])

function presentUpgrades() {
	const scene = k.add([
		k.fixed(),
		k.z(100),
	])
	game.paused = true
	scene.add(makeFilter())
	scene.add([
		k.text("Choose an upgrade"),
		k.fixed(),
		k.anchor("center"),
		k.pos(k.width() / 2, 160),
	])
	function addItem(x, thing, action) {
		const box = scene.add([
			k.rect(80, 80, { radius: 4, }),
			k.outline(4),
			k.fixed(),
			k.anchor("center"),
			k.pos(x, 320),
			k.scale(2),
			k.area(),
			bounce({ to: 2 }),
		])
		box.add([
			k.sprite(thing),
			k.fixed(),
			k.anchor("center"),
		])
		box.onClick(() => {
			action()
			game.paused = false
			scene.destroy()
			k.burp()
		})
	}
	addItem(k.width() / 2, "sword", () => {
		levels.sword += 1
		initSwords()
	})
	addItem(k.width() / 2 - 200, "gun", () => {
		levels.gun += 1
		initGuns()
	})
	addItem(k.width() / 2 + 200, "trumpet", () => {
		levels.trumpet += 1
		initTrumpet()
	})
}

let lastTouchPos = null

k.onTouchStart(() => {
	if (game.paused) return
	lastTouchPos = k.mousePos()
})

k.onTouchMove(() => {
	if (game.paused) return
	const movement = k.mousePos().sub(lastTouchPos)
	bean.move(movement.scale(TOUCH_SPEED))
	lastTouchPos = k.mousePos()
})

k.onTouchEnd(() => {
	lastTouchPos = null
})
