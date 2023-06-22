import kaboom, {
	Vec2,
	Key,
	GameObj,
	PosComp,
	ScaleComp,
	HealthComp,
	TimerComp,
} from "kaboom"

// TODO tip: watch out for game object count

const k = kaboom({
	width: 800,
	height: 600,
	canvas: document.querySelector("#game"),
	font: "happy",
	// TODO: bug
	// scale: 0.8,
})

const SPEED = 320
const WIDTH = 1600
const HEIGHT = 1600
const TILE_WIDTH = 64
const TILE_HEIGHT = 64
const MAX_HP = 100
const HEALTHBAR_WIDTH = 160
const HEALTHBAR_POS = k.vec2(24, 24)
const TOOLBAR_POS = k.vec2(24, k.height() - 24)
const SWORD_SPEED = 80
const MAX_SWORDS = 3
const BULLET_SPEED = 800
const BTFLY_SPEED = 300
const DINO_SPEED = 80
const BAG_SPEED = 60
const SWORD_DMG = 100
const GUN_DMG = 100
const DIZZY_SPEED = 1000

k.setBackground(0, 0, 0)
k.loadSprite("bean", "sprites/bean.png")
k.loadSprite("bag", "sprites/bag.png")
k.loadSprite("dino", "sprites/dino.png")
k.loadSprite("btfly", "sprites/btfly.png")
k.loadSprite("healthbar", "sprites/healthbar.png")
k.loadSprite("toolbar", "sprites/toolbar.png")
k.loadSprite("sword", "sprites/sword.png")
k.loadSprite("gun", "sprites/gun.png")
k.loadSprite("heart", "sprites/heart.png")
k.loadSprite("trumpet", "sprites/trumpet.png")
k.loadAseprite("field", "sprites/field.png", "sprites/field.json")
k.loadBitmapFont("happy", "sprites/happy_28x36.png", 28, 36, {
	// TODO: not working
	outline: 4,
})

const colors: Record<string, [number, number, number]> = {
	red: [204, 66, 94],
	green: [91, 166, 117],
	orange: [255, 184, 121],
	black: [31, 16, 42],
}

const game = k.add([
	k.timer(),
])

const ui = game.add([
	k.fixed(),
	k.z(100),
])

// TODO: this is slow, good use case for canvas / framebuffer
for (let i = 0; i < WIDTH / TILE_WIDTH; i++) {
	for (let j = 0; j < HEIGHT / TILE_HEIGHT; j++) {
		game.add([
			k.pos(j * TILE_WIDTH, i * TILE_HEIGHT ),
			k.sprite("field", { frame: k.randi(0, 4) }),
		])
	}
}

k.onKeyPress("p", () => {
	game.paused = !game.paused
})

const bean = game.add([
	k.pos(WIDTH / 2, HEIGHT / 2),
	k.sprite("bean"),
	k.anchor("center"),
	k.area({ scale: 0.8 }),
	k.health(100),
	k.scale(),
	highlight(),
])

function updateHealthbar() {
	healthbar.width = HEALTHBAR_WIDTH * bean.hp() / MAX_HP
}

bean.onHurt((dmg) => {
	updateHealthbar()
	const i = 10
	k.shake(5)
})

bean.onHeal((dmg) => {
	if (bean.hp() > MAX_HP) bean.setHP(MAX_HP)
	updateHealthbar()
	healthbarbg.highlight()
	bean.highlight()
})

const swords = bean.add([
	k.rotate(0),
])

const guns = bean.add([])
const trumpets = bean.add([])

swords.onUpdate(() => {
	swords.angle += k.dt() * SWORD_SPEED
})

const levels = {
	sword: 1,
	gun: 1,
	trumpet: 1,
}

const toolbar = ui.add([
	k.pos(TOOLBAR_POS),
	k.scale(),
	k.sprite("toolbar"),
	k.fixed(),
	k.anchor("botleft"),
	highlight({ scale: 1.1 }),
])

function updateToolbar() {
	toolbar.removeAll()
	let x = 48
	for (const tool in levels) {
		const level = levels[tool]
		if (level <= 0) continue
		toolbar.add([
			k.sprite(tool),
			k.pos(x, -56),
			k.fixed(),
			k.anchor("center"),
		])
		const dot = toolbar.add([
			k.circle(12),
			k.fixed(),
			k.pos(x + 22, -40),
			k.anchor("center"),
			k.color(colors.black),
		])
		dot.add([
			k.text(level + "", { size: 16 }),
			k.fixed(),
			k.anchor("center"),
		])
		x += 70
	}
}

updateToolbar()

function initSwords() {
	swords.removeAll()
	if (levels.sword <= 0) return
	const numSwords = Math.min(levels.sword, MAX_SWORDS)
	const interval = 360 / numSwords
	for (let i = 0; i < numSwords; i++) {
		const center = swords.add([
			k.rotate(i * interval),
		])
		const sword = center.add([
			k.pos(0, -70),
			k.sprite("sword"),
			k.anchor("center"),
			k.area({ shape: new k.Rect(k.vec2(0, -10), 5, 40) }),
		])
		sword.onCollide("enemy", (e) => {
			e.hurt(SWORD_DMG)
		})
	}
	updateToolbar()
}

function initGuns() {
	guns.removeAll()
	if (levels.gun <= 0) return
	const gun = guns.add([
		k.pos(60, 0),
		k.sprite("gun"),
		k.anchor("center"),
		k.timer(),
	])
	gun.loop(1, () => {
		game.add([
			k.rect(16, 6, { radius: 2 }),
			k.outline(4, k.Color.fromArray(colors.black)),
			k.pos(gun.worldPos().add(16, -8)),
			k.move(k.RIGHT, BULLET_SPEED),
			k.area(),
			"bullet",
		])
	})
	if (levels.gun >= 2) {
		const gun = guns.add([
			k.pos(-60, 0),
			k.sprite("gun", { flipX: true }),
			k.anchor("center"),
			k.timer(),
		])
		gun.loop(1, () => {
			game.add([
				k.rect(16, 6, { radius: 2 }),
				k.outline(4, k.Color.fromArray(colors.black)),
				k.pos(gun.worldPos().add(-16, -8)),
				k.move(k.LEFT, BULLET_SPEED),
				k.area(),
				"bullet",
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
		const effect = bean.add([
			k.circle(0),
			k.timer(),
			k.opacity(0.3),
			k.z(-100),
		])
		effect.tween(0, 300, 1, (r) => effect.radius = r)
		effect.tween(1, 0, 1, (o) => effect.opacity = o)
		effect.wait(1, () => effect.destroy())
	})
	updateToolbar()
}

k.onCollide("bullet", "enemy", (b, e) => {
	e.hurt(GUN_DMG)
})

initSwords()
initGuns()
initTrumpet()

// TODO: this still runs when game is paused
bean.onCollideUpdate("enemy", (e) => {
	bean.hurt(k.dt() * e.dmg)
})

bean.onCollide("enemybullet", (e) => {
	bean.hurt(e.dmg)
	e.destroy()
})

bean.onDeath(() => {
	game.paused = true
	lose.paused = false
	lose.hidden = false
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

function enemy(opts: {
	dmg?: number,
} = {}) {
	return {
		id: "enemy",
		dmg: opts.dmg ?? 100,
		add(this: GameObj<PosComp | HealthComp>) {
			this.onDeath(() => {
				this.destroy()
				k.addKaboom(this.pos)
				setScore((s) => s + 100)
				exp += 1
				if (exp >= maxExp) {
					exp = 0
					presentUpgrades()
					maxExp += maxExpStep
				}
				if (k.chance(0.2)) {
					addHeart(this.pos)
				}
			})
		},
	}
}

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
		bounce(),
		enemy({ dmg: 100 }),
	])
	bag.onStateUpdate("move", async () => {
		const dir = bean.pos.sub(bag.pos).unit()
		bag.move(dir.scale(BAG_SPEED))
	})
	bag.onStateEnter("dizzy", async () => {
		await game.wait(2)
		if (bag.state !== "dizzy") return
		bag.enterState("move")
	})
	bag.onStateUpdate("dizzy", async () => {
		bag.angle += k.dt() * DIZZY_SPEED
	})
	bag.onStateEnd("dizzy", async () => {
		bag.angle = 0
	})
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
		bounce(),
		enemy({ dmg: 100 }),
	])
	btfly.onUpdate(() => {
		btfly.pos.x += k.dt() * k.rand(-1, 1) * 100
		btfly.pos.y += k.dt() * k.rand(-1, 1) * 100
	})
	btfly.onStateEnter("idle", async () => {
		await game.wait(2)
		if (btfly.state !== "idle") return
		btfly.enterState("attack")
	})
	btfly.onStateEnter("attack", async () => {
		const dir = bean.pos.sub(btfly.pos).unit()
		const dest = bean.pos.add(dir.scale(100))
		const dis = bean.pos.dist(btfly.pos)
		const t = dis / BTFLY_SPEED
		await game.tween(btfly.pos, dest, t, (p) => btfly.pos = p, k.easings.easeOutQuad)
		btfly.enterState("idle")
	})
	btfly.onStateEnter("dizzy", async () => {
		await game.wait(2)
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
		k.health(100),
		bounce(),
		enemy({ dmg: 100 }),
	])
	dino.onUpdate(() => {
		dino.flipX = bean.pos.x < dino.pos.x
	})
	dino.onStateEnter("idle", async () => {
		await game.wait(1)
		if (dino.state !== "idle") return
		dino.enterState("attack")
	})
	dino.onStateEnter("attack", async () => {
		game.add([
			k.rect(16, 6, { radius: 2 }),
			k.outline(4, k.Color.fromArray(colors.black)),
			k.pos(dino.worldPos().add(16, -8)),
			k.move(dino.flipX ? k.LEFT : k.RIGHT, BULLET_SPEED),
			k.area(),
			"enemybullet",
			{ dmg: 20 },
		])
		await game.wait(1)
		if (dino.state !== "attack") return
		dino.enterState("move")
	})
	dino.onStateEnter("move", async () => {
		await game.wait(2)
		if (dino.state !== "move") return
		dino.enterState("idle")
	})
	dino.onStateUpdate("move", async () => {
		const dir = bean.pos.sub(dino.pos).unit()
		dino.move(dir.scale(DINO_SPEED))
	})
	dino.onStateEnter("dizzy", async () => {
		await game.wait(2)
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

game.loop(0.5, () => {
	k.choose([
		spawnBag,
		spawnBtfly,
		spawnDino,
	])()
})

bean.onCollide("heart", (h) => {
	bean.heal(10)
	updateHealthbar()
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

const healthbarbg = ui.add([
	k.pos(HEALTHBAR_POS),
	k.scale(),
	k.rect(HEALTHBAR_WIDTH, 16, { radius: 8 }),
	k.fixed(),
	k.color(colors.black),
	highlight({ scale: 1.1 }),
])

const healthbar = healthbarbg.add([
	k.rect(HEALTHBAR_WIDTH, 16, { radius: 8 }),
	k.fixed(),
	k.color(colors.green),
])

healthbar.add([
	k.sprite("healthbar"),
	k.fixed(),
])

let score = 0
let exp = 0
let maxExp = 10
let maxExpStep = 5

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
	bean.setHP(MAX_HP)
	updateHealthbar()
	levels.sword = 1
	levels.gun = 0
	initSwords()
	initTrumpet()
	initGuns()
	setScore(0)
	exp = 0
	maxExp = 10
	maxExpStep = 15
}

k.onKeyPress("space", () => {
	if (lose.hidden) return
	lose.hidden = true
	lose.paused = true
	game.paused = false
	for (const e of game.get("enemy", { recursive: true })) {
		e.hurt(100)
	}
	game.removeAll("heart")
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
