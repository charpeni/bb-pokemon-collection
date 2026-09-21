import { createHash, randomUUID } from "node:crypto";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { hostContract } from "./host-contract";
import { diffGitSnapshots, type GitRepoSnapshot, type GitSnapshotEvent } from "./git-detector";
import {
	animatedSpriteUrl, cryUrl, milestoneKinds, pokemon, spriteUrl, starterEvolutionChains, starters,
	type MilestoneKind, type StarterId,
} from "./pokemon";

const starterIdSchema = z.enum(starters.map((starter) => starter.id));
const milestoneSchema = z.enum(milestoneKinds);
const captureSchema = z.object({
	id: z.string(), pokemonId: z.string(), pokemonName: z.string(), pokemonNumber: z.number().int(),
	spriteUrl: z.string().nullable(), shinySpriteUrl: z.string().nullable(), animatedSpriteUrl: z.string().nullable(),
	cryUrl: z.string(),
	isShiny: z.boolean(), heightDecimeters: z.number().int(), weightHectograms: z.number().int(),
	types: z.array(z.string()), flavorText: z.string().nullable(), rarity: z.string(), isEgg: z.boolean(),
	eggSteps: z.number().int(), eggStepsRequired: z.number().int(), hatchedAt: z.string().nullable(),
	encounterLocation: z.string().nullable(), encounterVersion: z.string().nullable(), encounterMethod: z.string().nullable(),
	encounterChance: z.number().int().nullable(), encounterLevel: z.number().int().nullable(), milestone: z.string(),
	source: z.string(), reference: z.string(), title: z.string(), description: z.string(), url: z.string().nullable(), caughtAt: z.string(),
});
const companionSchema = z.object({
	starterId: starterIdSchema, pokemonId: z.string(), pokemonName: z.string(), pokemonNumber: z.number().int(),
	spriteUrl: z.string(), animatedSpriteUrl: z.string().nullable(), level: z.number().int(), experience: z.number().int(),
	experienceIntoLevel: z.number().int(), experienceForNextLevel: z.number().int(), totalTokens: z.number().int(),
	tokensPerExperience: z.number().int(), nextEvolution: z.object({ name: z.string(), level: z.number().int() }).nullable(),
});
const collectionSchema = z.object({
	starter: starterIdSchema.nullable(), companion: companionSchema.nullable(), captures: z.array(captureSchema),
	uniquePokemon: z.number().int(), totalCaptures: z.number().int(), shinyCaptures: z.number().int(),
});

export type Collection = z.infer<typeof collectionSchema>;
export type Capture = z.infer<typeof captureSchema>;
export const rpcContract = defineRpcContract({
	collection_get: { input: z.null(), output: collectionSchema },
	collection_reset: { input: z.null(), output: collectionSchema },
	demo_reward_add: { input: z.object({ kind: z.enum(["egg", "shiny"]) }).strict(), output: collectionSchema },
	starter_select: { input: z.object({ starterId: starterIdSchema }), output: collectionSchema },
});
const recordInputSchema = z.object({
	milestone: milestoneSchema, source: z.string().trim().min(1).max(200), reference: z.string().trim().min(1).max(500),
	title: z.string().trim().min(1).max(500), url: z.url().max(1000).optional(),
});
const COLLECTION_CHANGED = "collection-changed";
const TOKENS_PER_EXPERIENCE = 5000;
const TOKENS_PER_EGG_STEP = 100;
const STARTER_EXPERIENCE = 5 ** 3;
const NATIONAL_DEX_SIZE = 1025;
type Database = ReturnType<BbPluginApi["storage"]["database"]>;
type PokemonCandidate = { id: string; name: string; number: number };

function formatPokemonName(name: string) {
	return name.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

export function chooseFallbackPokemonNumber(eventKey: string) {
	return createHash("sha256").update(eventKey).digest().readUInt32BE(0) % NATIONAL_DEX_SIZE + 1;
}

export function rarityForEncounterChance(chance: number): "common" | "uncommon" | "rare" {
	if (chance >= 20) return "common";
	if (chance >= 10) return "uncommon";
	return "rare";
}

function ensureTables(db: Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS pokemon_details (
			pokemon_number INTEGER PRIMARY KEY, pokemon_id TEXT NOT NULL, pokemon_name TEXT NOT NULL,
			artwork_url TEXT, height_decimeters INTEGER NOT NULL, weight_hectograms INTEGER NOT NULL,
			types_json TEXT NOT NULL, flavor_text TEXT, fetched_at TEXT NOT NULL, sprite_url TEXT,
			shiny_sprite_url TEXT, animated_sprite_url TEXT, cry_url TEXT, hatch_counter INTEGER NOT NULL DEFAULT 0,
			is_legendary INTEGER NOT NULL DEFAULT 0, is_mythical INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS captures (
			id TEXT PRIMARY KEY, event_key TEXT, pokemon_id TEXT NOT NULL, pokemon_name TEXT NOT NULL,
			pokemon_number INTEGER NOT NULL, milestone TEXT NOT NULL, source TEXT NOT NULL,
			reference TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, url TEXT,
			thread_id TEXT, project_id TEXT, caught_at TEXT NOT NULL, is_shiny INTEGER NOT NULL DEFAULT 0,
			rarity TEXT NOT NULL DEFAULT 'common', egg_steps INTEGER NOT NULL DEFAULT 0,
			egg_steps_required INTEGER NOT NULL DEFAULT 0, hatched_at TEXT, encounter_location TEXT,
			encounter_version TEXT, encounter_method TEXT, encounter_chance INTEGER, encounter_level INTEGER
		);
		CREATE TABLE IF NOT EXISTS companion_progress (id INTEGER PRIMARY KEY CHECK (id = 1), total_tokens INTEGER NOT NULL DEFAULT 0);
		CREATE TABLE IF NOT EXISTS thread_token_usage (thread_id TEXT PRIMARY KEY, total_tokens INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS incubator_state (id INTEGER PRIMARY KEY CHECK (id = 1), token_remainder INTEGER NOT NULL DEFAULT 0);
		CREATE TABLE IF NOT EXISTS git_detector_snapshots (
			host_id TEXT NOT NULL, repo_id TEXT NOT NULL, snapshot_json TEXT NOT NULL,
			updated_at TEXT NOT NULL, PRIMARY KEY (host_id, repo_id)
		);
		CREATE UNIQUE INDEX IF NOT EXISTS captures_event_key_unique
			ON captures(event_key) WHERE event_key IS NOT NULL;
	`);
	const detailColumns = db.prepare("PRAGMA table_info(pokemon_details)").all() as Array<{ name: string }>;
	if (!detailColumns.some((column) => column.name === "cry_url")) db.exec("ALTER TABLE pokemon_details ADD COLUMN cry_url TEXT");
}

function nullableString(value: unknown) {
	return typeof value === "string" && value !== "" ? value : null;
}

function rowToCapture(row: Record<string, unknown>): Capture {
	const number = Number(row.pokemon_number);
	return {
		id: String(row.id), pokemonId: String(row.pokemon_id), pokemonName: String(row.pokemon_name), pokemonNumber: number,
		spriteUrl: nullableString(row.sprite_url) ?? spriteUrl(number), shinySpriteUrl: nullableString(row.shiny_sprite_url) ?? spriteUrl(number, true),
		animatedSpriteUrl: nullableString(row.animated_sprite_url) ?? animatedSpriteUrl(number), isShiny: Boolean(row.is_shiny),
		cryUrl: nullableString(row.cry_url) ?? cryUrl(number),
		heightDecimeters: Number(row.height_decimeters ?? 0), weightHectograms: Number(row.weight_hectograms ?? 0),
		types: JSON.parse(String(row.types_json ?? "[]")) as string[], flavorText: nullableString(row.flavor_text),
		rarity: String(row.rarity ?? "common"), isEgg: Number(row.egg_steps_required ?? 0) > 0 && row.hatched_at === null,
		eggSteps: Number(row.egg_steps ?? 0), eggStepsRequired: Number(row.egg_steps_required ?? 0), hatchedAt: nullableString(row.hatched_at),
		encounterLocation: nullableString(row.encounter_location), encounterVersion: nullableString(row.encounter_version),
		encounterMethod: nullableString(row.encounter_method), encounterChance: row.encounter_chance === null ? null : Number(row.encounter_chance),
		encounterLevel: row.encounter_level === null ? null : Number(row.encounter_level), milestone: String(row.milestone),
		source: String(row.source), reference: String(row.reference), title: String(row.title), description: String(row.description),
		url: nullableString(row.url), caughtAt: String(row.caught_at),
	};
}

function readCaptures(db: Database) {
	return db.prepare(`
		SELECT c.*, d.sprite_url, d.shiny_sprite_url, d.animated_sprite_url, d.cry_url,
			d.height_decimeters, d.weight_hectograms, d.types_json, d.flavor_text
		FROM captures c LEFT JOIN pokemon_details d ON d.pokemon_number = c.pokemon_number ORDER BY c.caught_at DESC
	`).all().map((row) => rowToCapture(row as Record<string, unknown>));
}

async function fetchPokemonDetails(candidate: PokemonCandidate) {
	let height = 0; let weight = 0; let types: string[] = []; let flavorText: string | null = null;
	let hatchCounter = 0; let isLegendary = false; let isMythical = false;
	let id = candidate.id; let name = candidate.name;
	let resolvedCryUrl = cryUrl(candidate.number);
	try {
		const [pokemonResponse, speciesResponse] = await Promise.all([
			fetch(`https://pokeapi.co/api/v2/pokemon/${candidate.number}`, { signal: AbortSignal.timeout(5000) }),
			fetch(`https://pokeapi.co/api/v2/pokemon-species/${candidate.number}`, { signal: AbortSignal.timeout(5000) }),
		]);
		if (pokemonResponse.ok) {
			const data = await pokemonResponse.json() as { id?: number; name?: string; height?: number; weight?: number; types?: Array<{ type?: { name?: string } }>; cries?: { latest?: string; legacy?: string } };
			id = data.name ?? candidate.id; name = data.name === undefined ? candidate.name : formatPokemonName(data.name);
			height = data.height ?? 0; weight = data.weight ?? 0;
			types = data.types?.flatMap((entry) => entry.type?.name === undefined ? [] : [entry.type.name]) ?? [];
			resolvedCryUrl = data.cries?.latest ?? data.cries?.legacy ?? resolvedCryUrl;
		}
		if (speciesResponse.ok) {
			const data = await speciesResponse.json() as { hatch_counter?: number; is_legendary?: boolean; is_mythical?: boolean; flavor_text_entries?: Array<{ flavor_text?: string; language?: { name?: string } }> };
			flavorText = data.flavor_text_entries?.find((entry) => entry.language?.name === "en")?.flavor_text?.replace(/\s+/gu, " ") ?? null;
			hatchCounter = data.hatch_counter ?? 0; isLegendary = data.is_legendary ?? false; isMythical = data.is_mythical ?? false;
		}
	} catch {}
	return { id, name, height, weight, types, flavorText, hatchCounter, isLegendary, isMythical, cryUrl: resolvedCryUrl };
}

async function ensurePokemonDetails(db: Database, candidate: PokemonCandidate) {
	if (db.prepare("SELECT 1 FROM pokemon_details WHERE pokemon_number = ?").get(candidate.number) !== undefined) return;
	const details = await fetchPokemonDetails(candidate);
	db.prepare(`
		INSERT OR IGNORE INTO pokemon_details (
			pokemon_number, pokemon_id, pokemon_name, artwork_url, height_decimeters, weight_hectograms,
			types_json, flavor_text, fetched_at, sprite_url, shiny_sprite_url, animated_sprite_url, cry_url,
			hatch_counter, is_legendary, is_mythical
		) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(candidate.number, details.id, details.name, details.height, details.weight, JSON.stringify(details.types),
		details.flavorText, new Date().toISOString(), spriteUrl(candidate.number), spriteUrl(candidate.number, true), animatedSpriteUrl(candidate.number),
		details.cryUrl, details.hatchCounter, details.isLegendary ? 1 : 0, details.isMythical ? 1 : 0);
}

async function fetchEncounter(number: number, eventKey: string) {
	try {
		const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${number}/encounters`, { signal: AbortSignal.timeout(5000) });
		if (!response.ok) return null;
		const locations = await response.json() as Array<{
			location_area: { name: string };
			version_details: Array<{
				version: { name: string };
				encounter_details: Array<{ chance: number; min_level: number; max_level: number; method: { name: string } }>;
			}>;
		}>;
		const choices = locations.flatMap((location) => location.version_details.flatMap((version) => version.encounter_details.map((detail) => ({
			location: formatPokemonName(location.location_area.name.replace(/-area$/u, "")),
			version: formatPokemonName(version.version.name), method: formatPokemonName(detail.method.name),
			chance: detail.chance, minLevel: detail.min_level, maxLevel: detail.max_level,
		}))));
		if (choices.length === 0) return null;
		const digest = createHash("sha256").update(`${eventKey}:encounter`).digest();
		const total = choices.reduce((sum, choice) => sum + Math.max(1, choice.chance), 0);
		let roll = digest.readUInt32BE(0) % total;
		const choice = choices.find((candidate) => (roll -= Math.max(1, candidate.chance)) < 0) ?? choices[0]!;
		const range = Math.max(1, choice.maxLevel - choice.minLevel + 1);
		return { ...choice, level: choice.minLevel + digest.readUInt32BE(4) % range };
	} catch {
		return null;
	}
}

function milestoneDescription(input: z.infer<typeof recordInputSchema>) {
	const action = input.milestone === "branch_opened" ? "opening" : input.milestone === "commit_created" ? "committing" : input.milestone === "pr_closed" ? "closing" : "finishing";
	return `Caught by ${action} ${input.source} ${input.reference} - ${input.title}`;
}

async function recordMilestone(db: Database, bb: BbPluginApi, input: z.infer<typeof recordInputSchema>, eventKey?: string) {
	const key = eventKey ?? createHash("sha256").update(JSON.stringify(input)).digest("hex");
	if (db.prepare("SELECT id FROM captures WHERE event_key = ? LIMIT 1").get(key) !== undefined) {
		return { caught: false as const, message: "This milestone was already rewarded." };
	}
	const number = chooseFallbackPokemonNumber(key);
	const candidate = { id: `pokemon-${number}`, name: `Pokémon #${number}`, number };
	await ensurePokemonDetails(db, candidate);
	const shiny = Math.floor(Math.random() * 4096) === 0;
	const encounter = await fetchEncounter(number, key);
	const detailRow = db.prepare(`SELECT pokemon_id, pokemon_name, hatch_counter, is_legendary, is_mythical
		FROM pokemon_details WHERE pokemon_number = ?`).get(number) as {
		pokemon_id?: string; pokemon_name?: string; hatch_counter?: number; is_legendary?: number; is_mythical?: number;
	} | undefined;
	const resolved = { id: detailRow?.pokemon_id ?? candidate.id, name: detailRow?.pokemon_name ?? candidate.name, number };
	const rarity = detailRow?.is_legendary === 1 || detailRow?.is_mythical === 1
		? "legendary"
		: encounter === null ? "common" : rarityForEncounterChance(encounter.chance);
	const isEgg = rarity === "rare";
	const eggStepsRequired = isEgg ? 255 * (Number(detailRow?.hatch_counter ?? 20) + 1) : 0;
	const insertion = db.prepare(`
		INSERT OR IGNORE INTO captures (id, event_key, pokemon_id, pokemon_name, pokemon_number, milestone, source,
			reference, title, description, url, caught_at, is_shiny, rarity, egg_steps, egg_steps_required,
			encounter_location, encounter_version, encounter_method, encounter_chance, encounter_level)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
	`).run(randomUUID(), key, resolved.id, resolved.name, resolved.number, input.milestone, input.source, input.reference,
		input.title, `${isEgg ? "Found" : "Caught"}${milestoneDescription(input).slice("Caught".length)}`, input.url ?? null,
		new Date().toISOString(), shiny ? 1 : 0, rarity, eggStepsRequired, encounter?.location ?? null,
		encounter?.version ?? null, encounter?.method ?? null, encounter?.chance ?? null, encounter?.level ?? null);
	if (insertion.changes === 0) {
		return { caught: false as const, message: "This milestone was already rewarded." };
	}
	bb.realtime.publish(COLLECTION_CHANGED, { reason: input.milestone });
	return { caught: true as const, message: isEgg ? "A mysterious rare Egg appeared!" : `${shiny ? "Shiny " : ""}${resolved.name} was caught!` };
}

function companionFor(starterId: StarterId, totalTokens: number) {
	const starter = starters.find((entry) => entry.id === starterId)!;
	const experience = Math.min(100 ** 3, Math.floor(totalTokens / TOKENS_PER_EXPERIENCE) + STARTER_EXPERIENCE);
	const level = Math.min(100, Math.max(1, Math.floor(Math.cbrt(experience))));
	const chain = starterEvolutionChains[starterId];
	const current = [...chain].reverse().find((entry) => level >= entry.level) ?? starter;
	const nextEvolution = chain.find((entry) => level < entry.level) ?? null;
	return {
		starterId, pokemonId: current.id, pokemonName: current.name, pokemonNumber: current.number,
		spriteUrl: spriteUrl(current.number), animatedSpriteUrl: animatedSpriteUrl(current.number), level, experience,
		experienceIntoLevel: experience - level ** 3, experienceForNextLevel: level === 100 ? 0 : (level + 1) ** 3 - level ** 3,
		totalTokens, tokensPerExperience: TOKENS_PER_EXPERIENCE,
		nextEvolution: nextEvolution === null ? null : { name: nextEvolution.name, level: nextEvolution.level },
	};
}

async function readCollection(db: Database, bb: BbPluginApi): Promise<Collection> {
	const starter = await bb.storage.kv.get<StarterId>("starter") ?? null;
	const captures = readCaptures(db);
	const tokenRow = db.prepare("SELECT total_tokens FROM companion_progress WHERE id = 1").get() as { total_tokens?: number } | undefined;
	return { starter, companion: starter === null ? null : companionFor(starter, Number(tokenRow?.total_tokens ?? 0)), captures,
		uniquePokemon: new Set(captures.map((capture) => capture.pokemonNumber)).size, totalCaptures: captures.length,
		shinyCaptures: captures.filter((capture) => capture.isShiny).length };
}

async function selectStarter(db: Database, bb: BbPluginApi, starterId: StarterId) {
	const current = await bb.storage.kv.get<StarterId>("starter");
	await bb.storage.kv.set("starter", starterId);
	if (current === undefined) {
		const starter = starters.find((entry) => entry.id === starterId)!;
		await ensurePokemonDetails(db, starter);
		db.prepare(`
			INSERT INTO captures (id, event_key, pokemon_id, pokemon_name, pokemon_number, milestone, source,
				reference, title, description, url, caught_at, is_shiny, rarity)
			VALUES (?, ?, ?, ?, ?, 'starter_selected', 'Pokemon Catcher', 'starter', ?, ?, NULL, ?, 0, 'common')
		`).run(randomUUID(), `starter:${starterId}`, starter.id, starter.name, starter.number, `${starter.name} joined your journey`,
			`Chose ${starter.name} as your starter companion`, new Date().toISOString());
	}
	bb.realtime.publish(COLLECTION_CHANGED, { reason: "starter_selected" });
	return readCollection(db, bb);
}

async function resetCollection(db: Database, bb: BbPluginApi) {
	await bb.storage.kv.delete("starter");
	db.transaction(() => {
		db.prepare("DELETE FROM captures").run();
		db.prepare("DELETE FROM pokemon_details").run();
		db.prepare("DELETE FROM companion_progress").run();
		db.prepare("DELETE FROM thread_token_usage").run();
		db.prepare("DELETE FROM incubator_state").run();
	})();
	bb.realtime.publish(COLLECTION_CHANGED, { reason: "reset" });
	return readCollection(db, bb);
}

async function addDemoReward(db: Database, bb: BbPluginApi, kind: "egg" | "shiny") {
	if (await bb.storage.kv.get<StarterId>("starter") === undefined) throw new Error("Choose a starter before adding demo rewards.");
	const candidate: PokemonCandidate = kind === "egg"
		? { id: "dratini", name: "Dratini", number: 147 }
		: { id: "ponyta", name: "Ponyta", number: 77 };
	await ensurePokemonDetails(db, candidate);
	const row = db.prepare("SELECT hatch_counter FROM pokemon_details WHERE pokemon_number = ?").get(candidate.number) as { hatch_counter?: number } | undefined;
	const isEgg = kind === "egg";
	db.prepare(`
		INSERT INTO captures (id, event_key, pokemon_id, pokemon_name, pokemon_number, milestone, source,
			reference, title, description, url, caught_at, is_shiny, rarity, egg_steps, egg_steps_required,
			encounter_location, encounter_version, encounter_method, encounter_chance, encounter_level)
		VALUES (?, NULL, ?, ?, ?, 'demo_reward', 'Developer Tools', ?, ?, ?, NULL, ?, ?, ?, 0, ?,
			'Developer Tools', 'Demo', 'Demo', ?, ?)
	`).run(randomUUID(), candidate.id, candidate.name, candidate.number, `demo-${kind}-${randomUUID()}`,
		isEgg ? "Demo mystery Egg" : "Demo shiny Ponyta",
		isEgg ? "Added a mystery Egg for demo purposes" : "Added a shiny Pokemon for demo purposes",
		new Date().toISOString(), kind === "shiny" ? 1 : 0, isEgg ? "rare" : "uncommon",
		isEgg ? 255 * (Number(row?.hatch_counter ?? 40) + 1) : 0, isEgg ? 5 : 15, isEgg ? 10 : 12);
	bb.realtime.publish(COLLECTION_CHANGED, { reason: `demo-${kind}` });
	return readCollection(db, bb);
}

function sleep(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
	});
}


function milestoneInput(event: GitSnapshotEvent): z.infer<typeof recordInputSchema> {
	const branch = event.branch ?? "detached worktree";
	const source = event.kind === "worktree_opened" ? "Git worktree" : event.kind === "branch_checked_out" ? "Git checkout" : "Git branch";
	const title = event.kind === "worktree_opened" ? `Created worktree at ${event.path}` : event.kind === "branch_checked_out" ? `Checked out ${branch}` : `Opened ${branch}`;
	return { milestone: "branch_opened", source, reference: branch, title };
}

export default async function plugin(bb: BbPluginApi) {
	const db = bb.storage.database();
	ensureTables(db);
	const host = bb.hosts.experimental_client({ contract: hostContract });
	const lifecycle = new AbortController();
	bb.onDispose(() => lifecycle.abort());
	bb.rpc.register(rpcContract, {
		collection_get: () => readCollection(db, bb),
		collection_reset: () => resetCollection(db, bb),
		demo_reward_add: ({ kind }) => addDemoReward(db, bb, kind),
		starter_select: ({ starterId }) => selectStarter(db, bb, starterId),
	});

	bb.events.on("experimental_thread.events", async ({ thread }) => {
		if (await bb.storage.kv.get<StarterId>("starter") === undefined) return;
		const events = await bb.sdk.threads.events.list({
			threadId: thread.id,
			types: ["thread/tokenUsage/updated"],
			order: "desc",
			limit: "1",
		});
		const event = events[0];
		if (event === undefined || event.type !== "thread/tokenUsage/updated") return;
		const reportedTotal = Math.max(0, Math.floor(event.data.tokenUsage.total.totalTokens));
		const reportedLast = Math.max(0, Math.floor(event.data.tokenUsage.last.totalTokens));
		const progress = db.transaction(() => {
			const previous = db.prepare("SELECT total_tokens FROM thread_token_usage WHERE thread_id = ?").get(thread.id) as { total_tokens: number } | undefined;
			const delta = previous === undefined ? reportedLast : reportedTotal >= previous.total_tokens ? reportedTotal - previous.total_tokens : reportedLast;
			db.prepare(`INSERT INTO thread_token_usage (thread_id, total_tokens) VALUES (?, ?)
				ON CONFLICT(thread_id) DO UPDATE SET total_tokens = excluded.total_tokens`).run(thread.id, reportedTotal);
			if (delta > 0) {
				db.prepare(`INSERT INTO companion_progress (id, total_tokens) VALUES (1, ?)
					ON CONFLICT(id) DO UPDATE SET total_tokens = total_tokens + excluded.total_tokens`).run(delta);
			}
			db.prepare("INSERT OR IGNORE INTO incubator_state (id, token_remainder) VALUES (1, 0)").run();
			const incubator = db.prepare("SELECT token_remainder FROM incubator_state WHERE id = 1").get() as { token_remainder: number };
			const availableTokens = incubator.token_remainder + delta;
			const eggSteps = Math.floor(availableTokens / TOKENS_PER_EGG_STEP);
			db.prepare("UPDATE incubator_state SET token_remainder = ? WHERE id = 1").run(availableTokens % TOKENS_PER_EGG_STEP);
			if (eggSteps > 0) {
				db.prepare(`UPDATE captures
					SET egg_steps = MIN(egg_steps_required, egg_steps + ?),
						hatched_at = CASE WHEN egg_steps + ? >= egg_steps_required THEN COALESCE(hatched_at, ?) ELSE hatched_at END
					WHERE egg_steps_required > 0 AND hatched_at IS NULL`).run(eggSteps, eggSteps, new Date().toISOString());
			}
			return { addedTokens: delta, eggSteps };
		})();
		if (progress.addedTokens > 0) bb.realtime.publish(COLLECTION_CHANGED, progress);
	});

	bb.agents.registerTool({
		name: "pokemon_record_milestone", description: "Record a verified engineering milestone and catch a Pokemon reward.",
		parameters: recordInputSchema,
		presentation: { label: { pending: "Catching a Pokemon", completed: "Caught a Pokemon" }, icon: { glyph: "Sparkles" }, tint: { light: "#fff7d6", dark: "#4a3900" } },
		execute: async (input) => (await recordMilestone(db, bb, input)).message,
	});
	bb.agents.configure(() => ({ tools: ["pokemon_record_milestone"], skills: ["pokemon-catcher"],
		instructions: "After personally verifying a successful commit, closed pull request, or completed ticket, call pokemon_record_milestone exactly once with the real source, reference, and title. Branches and BB worktrees are detected automatically." }));

	const usage = ["Usage:", "  bb pokemon collection [--json]", `  bb pokemon starter <${starters.map((starter) => starter.id).join("|")}> [--json]`,
		"  bb pokemon catch <branch_opened|commit_created|pr_closed|ticket_completed> --source <system> --reference <id> --title <title> [--url <url>] [--json]"].join("\n");
	bb.cli.register({
		name: "pokemon", summary: "Catch Pokemon for verified engineering milestones",
		commands: [
			{ name: "collection", summary: "Show caught Pokemon", usage: "bb pokemon collection [--json]" },
			{ name: "starter", summary: "Choose a starter", usage: "bb pokemon starter <name> [--json]" },
			{ name: "catch", summary: "Reward a completed milestone", usage: usage.split("\n").at(-1)! },
		],
		async run(argv) {
			const json = argv.includes("--json"); const args = argv.filter((arg) => arg !== "--json");
			if (args[0] === "collection") {
				const collection = await readCollection(db, bb);
				const captures = collection.captures.slice(0, 100);
				return { exitCode: 0, stdout: json ? JSON.stringify({ ...collection, captures, capturesTruncated: captures.length < collection.captures.length }) : `${collection.totalCaptures} Pokemon caught (${collection.uniquePokemon} unique).` };
			}
			if (args[0] === "starter" && args[1] !== undefined && starters.some((starter) => starter.id === args[1])) {
				const collection = await selectStarter(db, bb, args[1] as StarterId);
				return { exitCode: 0, stdout: json ? JSON.stringify(collection) : `${collection.companion?.pokemonName ?? "Starter"} is now your companion.` };
			}
			if (args[0] === "catch" && milestoneKinds.includes(args[1] as MilestoneKind)) {
				const value = (flag: string) => { const index = args.indexOf(flag); return index === -1 ? undefined : args[index + 1]; };
				const parsed = recordInputSchema.safeParse({ milestone: args[1], source: value("--source"), reference: value("--reference"), title: value("--title"), url: value("--url") });
				if (parsed.success) {
					const result = await recordMilestone(db, bb, parsed.data);
					return { exitCode: 0, stdout: json ? JSON.stringify(result) : result.message };
				}
			}
			return { exitCode: args[0] === undefined || args[0] === "--help" || args[0] === "help" ? 0 : 1, stdout: usage };
		},
	});

	async function reconcile(signal: AbortSignal) {
		const [projects, environments] = await Promise.all([
			bb.sdk.projects.list({ signal }), bb.sdk.environments.list({ status: "ready", signal, limit: 500 }),
		]);
		const rootsByHost = new Map<string, Set<string>>();
		for (const project of projects) for (const source of project.sources) {
			const roots = rootsByHost.get(source.hostId) ?? new Set<string>(); roots.add(source.path); rootsByHost.set(source.hostId, roots);
		}
		for (const environment of environments) if (environment.path !== null) {
			const roots = rootsByHost.get(environment.hostId) ?? new Set<string>(); roots.add(environment.path); rootsByHost.set(environment.hostId, roots);
		}
		for (const [hostId, roots] of rootsByHost) {
			const { repositories } = await host.call("scanGitRoots", { roots: [...roots] }, { hostId, signal });
			for (const snapshot of repositories) {
				const row = db.prepare("SELECT snapshot_json FROM git_detector_snapshots WHERE host_id = ? AND repo_id = ?").get(hostId, snapshot.repoId) as { snapshot_json: string } | undefined;
				const previous = row === undefined ? [] : [JSON.parse(row.snapshot_json) as GitRepoSnapshot];
				for (const event of diffGitSnapshots(previous, [snapshot])) {
					const path = "path" in event ? event.path : "";
					const eventKey = createHash("sha256").update(`${hostId}:${snapshot.repoId}:${event.kind}:${event.branch ?? ""}:${path}`).digest("hex");
					await recordMilestone(db, bb, milestoneInput(event), eventKey);
				}
				db.prepare(`INSERT INTO git_detector_snapshots (host_id, repo_id, snapshot_json, updated_at) VALUES (?, ?, ?, ?)
					ON CONFLICT(host_id, repo_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`)
					.run(hostId, snapshot.repoId, JSON.stringify(snapshot), new Date().toISOString());
			}
		}
	}
	let reconciliation: Promise<void> | null = null;
	function runReconcile(signal?: AbortSignal) {
		if (reconciliation !== null) return reconciliation;
		const combinedSignal = signal === undefined ? lifecycle.signal : AbortSignal.any([lifecycle.signal, signal]);
		reconciliation = reconcile(combinedSignal).finally(() => { reconciliation = null; });
		return reconciliation;
	}

	bb.background.service("git-milestone-detector", {
		async start(signal) {
			while (!signal.aborted) {
				try { await runReconcile(signal); } catch (error) { if (!signal.aborted) bb.log.warn(`Git milestone scan failed: ${error instanceof Error ? error.message : String(error)}`); }
				await sleep(15_000, signal);
			}
		},
	});
	bb.events.on("thread.active", () => {
		void runReconcile().catch((error) => { if (!lifecycle.signal.aborted) bb.log.warn(`Immediate Git milestone scan failed: ${error instanceof Error ? error.message : String(error)}`); });
	});
}
