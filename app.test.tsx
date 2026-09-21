// @vitest-environment jsdom
import { cleanup, fireEvent } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Collection, PokemonSettings } from "./server";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const collection: Collection = {
	starter: "fennekin",
	companion: {
		captureId: "shiny-1",
		pokemonId: "fennekin",
		pokemonName: "Fennekin",
		pokemonNumber: 653,
		spriteUrl: "https://example.invalid/fennekin.png",
		animatedSpriteUrl: "https://example.invalid/fennekin.gif",
		level: 21,
		experience: 10_463,
		experienceIntoLevel: 1_202,
		experienceForNextLevel: 1_387,
		totalTokens: 51_690_109,
		tokensPerExperience: 5_000,
		nextEvolution: { name: "Braixen", method: "Reach level 16", level: 16, tokenTarget: null },
	},
	captures: [
		{
			id: "egg-1",
			pokemonId: "dratini",
			pokemonName: "Dratini",
			pokemonNumber: 147,
			generation: 1,
			spriteUrl: "https://example.invalid/dratini.png",
			shinySpriteUrl: "https://example.invalid/dratini-shiny.png",
			animatedSpriteUrl: "https://example.invalid/dratini.gif",
			cryUrl: "https://example.invalid/dratini.ogg",
			isShiny: false,
			heightDecimeters: 18,
			weightHectograms: 33,
			types: ["dragon"],
			flavorText: "Long considered a mythical Pokémon until recently.",
			rarity: "rare",
			isEgg: true,
			eggSteps: 300,
			eggStepsRequired: 1_000,
			hatchedAt: null,
			encounterLocation: "Mt. Coronet",
			encounterVersion: "platinum",
			encounterMethod: "walk",
			encounterChance: 5,
			encounterLevel: 15,
			milestone: "commit_created",
			source: "git",
			reference: "abc123",
			title: "Restore collection",
			description: "Found by committing git abc123 - Restore collection",
			url: null,
			caughtAt: "2026-09-18T12:00:00.000Z",
		},
		{
			id: "shiny-1",
			pokemonId: "ponyta",
			pokemonName: "Ponyta",
			pokemonNumber: 77,
			generation: 1,
			spriteUrl: "https://example.invalid/ponyta.png",
			shinySpriteUrl: "https://example.invalid/ponyta-shiny.png",
			animatedSpriteUrl: "https://example.invalid/ponyta.gif",
			cryUrl: "https://example.invalid/ponyta.ogg",
			isShiny: true,
			heightDecimeters: 10,
			weightHectograms: 300,
			types: ["fire"],
			flavorText: "Its hooves are ten times harder than diamonds.",
			rarity: "uncommon",
			isEgg: false,
			eggSteps: 0,
			eggStepsRequired: 0,
			hatchedAt: null,
			encounterLocation: "Route 206",
			encounterVersion: "platinum",
			encounterMethod: "walk",
			encounterChance: 10,
			encounterLevel: 14,
			milestone: "branch_opened",
			source: "Git branch",
			reference: "feature/ux",
			title: "Opened feature/ux",
			description: "Caught by opening Git branch feature/ux - Opened feature/ux",
			url: null,
			caughtAt: "2026-09-18T13:00:00.000Z",
		},
	],
	uniquePokemon: 2,
	totalCaptures: 2,
	shinyCaptures: 1,
};

const pokemonSettings: PokemonSettings = {
	repositories: [
		{ fullName: "acme/pokedex", htmlUrl: "https://github.com/acme/pokedex", private: false },
		{ fullName: "acme/secret-lab", htmlUrl: "https://github.com/acme/secret-lab", private: true },
	],
	watchedRepositories: ["acme/pokedex"],
	projectManagementTool: "shortcut",
	showEvolutionAnimations: true,
	connections: {
		github: { authenticated: true, account: "misty", error: null },
		shortcut: { authenticated: false, account: null, error: null },
		jira: { authenticated: false, account: null, error: null },
	},
	jiraBaseUrl: "",
	jiraEmail: "",
};

describe("Pokemon collection app", () => {
	it("keeps starter selection inside the collection panel and lets users dismiss it", async () => {
		const app = await loadPluginApp(() => import("./app"));
		expect(app.appOverlays.map(({ id }) => id)).not.toContain("starter-setup");
		const slot = renderSlot(app.navPanels[0]!, { subPath: "" }, {
			rpc: {
				collection_get: () => ({
					...collection,
					starter: null,
					companion: null,
					captures: [],
					uniquePokemon: 0,
					totalCaptures: 0,
					shinyCaptures: 0,
				}),
				collection_reset: () => collection,
				demo_reward_add: () => collection,
				starter_select: () => collection,
				companion_select: () => collection,
			},
		});

		expect(await slot.findByRole("dialog")).toBeTruthy();
		fireEvent.click(slot.getByRole("button", { name: "Close starter selection" }));
		await vi.waitFor(() => expect(slot.queryByRole("dialog")).toBeNull());

		slot.lifecycle.unmount();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	it("preserves the original trainer-log collection UX", async () => {
		const play = vi.fn(() => Promise.resolve());
		class MockAudio {
			play = play;
			pause = vi.fn();
			addEventListener = vi.fn();
			constructor(readonly src: string) {}
		}
		vi.stubGlobal("Audio", MockAudio);
		const app = await loadPluginApp(() => import("./app"));
		const demoRewards: string[] = [];
		let resets = 0;
		const slot = renderSlot(app.navPanels[0]!, { subPath: "" }, {
			rpc: {
				collection_get: () => collection,
				collection_reset: () => { resets += 1; return { ...collection, starter: null, companion: null, captures: [], uniquePokemon: 0, totalCaptures: 0, shinyCaptures: 0 }; },
				demo_reward_add: ({ kind }: { kind: "egg" | "shiny" }) => { demoRewards.push(kind); return collection; },
				starter_select: () => collection,
				companion_select: () => collection,
			},
		});

		expect(await slot.findByText("Fennekin · Lv. 21")).toBeTruthy();
		expect(slot.getByText("Egg Incubator")).toBeTruthy();
		expect(slot.getByText("Ways to earn a catch")).toBeTruthy();
		expect(slot.getByText("Caught Pokemon")).toBeTruthy();
		expect(slot.getByRole("button", { name: "✨ Shiny" })).toBeTruthy();
		expect(slot.getByLabelText("Filter by type")).toBeTruthy();
		expect(slot.getByLabelText("Filter by rarity")).toBeTruthy();
		expect(slot.getByLabelText("Filter by generation")).toBeTruthy();
		expect(slot.getAllByText("Gen 1", { selector: "span" })).toHaveLength(2);
		fireEvent.change(slot.getByLabelText("Filter by type"), { target: { value: "fire" } });
		expect(slot.getByText(/Ponyta$/)).toBeTruthy();
		fireEvent.change(slot.getByLabelText("Filter by generation"), { target: { value: "2" } });
		expect(slot.getByText("No Pokemon match these filters.")).toBeTruthy();
		fireEvent.click(slot.getByRole("button", { name: "Clear filters" }));
		fireEvent.change(slot.getByLabelText("Filter by rarity"), { target: { value: "rare" } });
		expect(slot.getByText("No Pokemon match these filters.")).toBeTruthy();
		fireEvent.click(slot.getByRole("button", { name: "Clear filters" }));
		expect(slot.getByText(/Ponyta$/)).toBeTruthy();
		expect(slot.getByRole("button", { name: "Developer tools" })).toBeTruthy();
		expect(slot.getByText("Mt. Coronet · Lv. 15 · walk · platinum")).toBeTruthy();
		fireEvent.click(slot.getByRole("button", { name: "Play Ponyta's cry" }));
		expect(play).toHaveBeenCalledOnce();

		fireEvent.click(slot.getByRole("button", { name: "Developer tools" }));
		fireEvent.click(slot.getByRole("button", { name: "Add demo Egg" }));
		await vi.waitFor(() => expect(demoRewards).toEqual(["egg"]));
		fireEvent.click(slot.getByRole("button", { name: "Done" }));
		const reset = slot.getByRole<HTMLButtonElement>("button", { name: "Reset collection" });
		await vi.waitFor(() => expect(reset.disabled).toBe(false));
		fireEvent.click(reset);
		fireEvent.click(slot.getByRole("button", { name: "Reset everything" }));
		await vi.waitFor(() => expect(resets).toBe(1));

		slot.lifecycle.unmount();
	});

	it("shows an evolution transition when the active companion changes form", async () => {
		const app = await loadPluginApp(() => import("./app"));
		let currentCollection = collection;
		const slot = renderSlot(app.navPanels[0]!, { subPath: "" }, {
			rpc: {
				collection_get: () => currentCollection,
				collection_reset: () => currentCollection,
				demo_reward_add: () => currentCollection,
				starter_select: () => currentCollection,
				companion_select: () => currentCollection,
			},
		});

		expect(await slot.findByText("Fennekin · Lv. 21")).toBeTruthy();
		currentCollection = {
			...collection,
			companion: {
				...collection.companion!,
				pokemonId: "braixen",
				pokemonName: "Braixen",
				pokemonNumber: 654,
				spriteUrl: "https://example.invalid/braixen.png",
				animatedSpriteUrl: "https://example.invalid/braixen.gif",
			},
		};
		await slot.behavior.emitRealtime("collection-changed", { reason: "companion_evolved" });

		expect((await slot.findByRole("status")).textContent).toBe("Fennekin evolved into Braixen!");
		expect(slot.container.querySelector('[data-evolving="true"]')).toBeTruthy();
		slot.lifecycle.unmount();
	});

	it("shows a skippable classic evolution experience and honors the saved preference", async () => {
		const app = await loadPluginApp(() => import("./app"));
		const overlay = app.appOverlays.find(({ id }) => id === "evolution-experience")!;
		const evolutionSignal = {
			reason: "companion_evolved",
			captureId: "shiny-1",
			evolutions: [{
				fromName: "Fennekin",
				fromSpriteUrl: "https://example.invalid/fennekin.png",
				toName: "Braixen",
				toSpriteUrl: "https://example.invalid/braixen.png",
				toNumber: 654,
			}],
		};
		let preferenceReads = 0;
		const slot = renderSlot(overlay, {}, {
			rpc: {
				preferences_get: () => { preferenceReads += 1; return { showEvolutionAnimations: true }; },
			},
		});

		await vi.waitFor(() => expect(preferenceReads).toBe(1));
		await slot.behavior.emitRealtime("collection-changed", evolutionSignal);

		const dialog = await slot.findByRole("dialog");
		expect(dialog.textContent).toContain("Fennekin is evolving!");
		fireEvent.click(slot.getByRole("button", { name: "Skip" }));
		await vi.waitFor(() => expect(slot.queryByRole("dialog")).toBeNull());
		slot.lifecycle.unmount();

		let showEvolutionAnimations = true;
		preferenceReads = 0;
		const disabledSlot = renderSlot(overlay, {}, {
			rpc: {
				preferences_get: () => { preferenceReads += 1; return { showEvolutionAnimations }; },
			},
		});
		await vi.waitFor(() => expect(preferenceReads).toBe(1));
		showEvolutionAnimations = false;
		await disabledSlot.behavior.emitRealtime("preferences-changed", { showEvolutionAnimations: false });
		await vi.waitFor(() => expect(preferenceReads).toBe(2));
		await disabledSlot.behavior.emitRealtime("collection-changed", evolutionSignal);
		expect(disabledSlot.queryByRole("dialog")).toBeNull();
		disabledSlot.lifecycle.unmount();
	});

	it("paginates filtered Pokedex entries and returns to the first page when filters change", async () => {
		const template = collection.captures[1]!;
		const paginatedCollection: Collection = {
			...collection,
			captures: [
				collection.captures[0]!,
				...Array.from({ length: 11 }, (_, index) => ({
					...template,
					id: `caught-${index + 1}`,
					pokemonName: `Pokemon ${index + 1}`,
					pokemonNumber: 77 + index,
					description: `Caught Pokemon ${index + 1}`,
				})),
			],
			totalCaptures: 12,
			uniquePokemon: 12,
		};
		const app = await loadPluginApp(() => import("./app"));
		const slot = renderSlot(app.navPanels[0]!, { subPath: "" }, {
			rpc: {
				collection_get: () => paginatedCollection,
				collection_reset: () => paginatedCollection,
				demo_reward_add: () => paginatedCollection,
				starter_select: () => paginatedCollection,
				companion_select: () => paginatedCollection,
			},
		});

		expect(await slot.findByText("Showing 1–9 of 11")).toBeTruthy();
		expect(slot.getByText("Page 1 of 2")).toBeTruthy();
		expect(slot.getByText("✨ Pokemon 1")).toBeTruthy();
		expect(slot.queryByText("✨ Pokemon 10")).toBeNull();
		fireEvent.click(slot.getByRole("button", { name: "Next" }));
		expect(slot.getByText("Showing 10–11 of 11")).toBeTruthy();
		expect(slot.getByText("Page 2 of 2")).toBeTruthy();
		expect(slot.queryByText("✨ Pokemon 1")).toBeNull();
		expect(slot.getByText("✨ Pokemon 10")).toBeTruthy();

		fireEvent.change(slot.getByLabelText("Filter by generation"), { target: { value: "2" } });
		expect(slot.getByText("No Pokemon match these filters.")).toBeTruthy();
		expect(slot.queryByRole("navigation", { name: "Pokedex pagination" })).toBeNull();
		fireEvent.click(slot.getByRole("button", { name: "Clear filters" }));
		expect(slot.getByText("Page 1 of 2")).toBeTruthy();
		expect(slot.getByText("✨ Pokemon 1")).toBeTruthy();

		slot.lifecycle.unmount();
	});

	it("opens a settings route with repository and project-management controls", async () => {
		const app = await loadPluginApp(() => import("./app"));
		const updates: Array<{ watchedRepositories: string[]; projectManagementTool: string; showEvolutionAnimations: boolean }> = [];
		const slot = renderSlot(app.navPanels[0]!, { subPath: "settings" }, {
			rpc: {
				settings_get: () => pokemonSettings,
				settings_update: (input: { watchedRepositories: string[]; projectManagementTool: "shortcut" | "jira" | "github_issues"; showEvolutionAnimations: boolean }) => {
					updates.push(input);
					return { ...pokemonSettings, ...input };
				},
				connection_save: () => pokemonSettings,
				connection_disconnect: () => pokemonSettings,
			},
		});

		expect(await slot.findByText("Pokemon Collection settings")).toBeTruthy();
		expect(slot.getByRole("button", { name: "Disconnect GitHub" })).toBeTruthy();
		fireEvent.click(slot.getByText("1 repository selected"));
		fireEvent.click(slot.getByRole("checkbox", { name: /acme\/secret-lab/i }));
		fireEvent.click(slot.getByRole("checkbox", { name: "Show evolution animations" }));
		fireEvent.click(slot.getByRole("button", { name: /Jira/ }));
		fireEvent.click(slot.getByRole("button", { name: "Save settings" }));
		await vi.waitFor(() => expect(updates).toEqual([{
			watchedRepositories: ["acme/pokedex", "acme/secret-lab"],
			projectManagementTool: "jira",
			showEvolutionAnimations: false,
		}]));

		slot.lifecycle.unmount();
	});
});
