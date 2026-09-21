// @vitest-environment jsdom
import { cleanup, fireEvent } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Collection } from "./server";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const collection: Collection = {
	starter: "fennekin",
	companion: {
		starterId: "fennekin",
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
		nextEvolution: { name: "Braixen", level: 16 },
	},
	captures: [
		{
			id: "egg-1",
			pokemonId: "dratini",
			pokemonName: "Dratini",
			pokemonNumber: 147,
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
			},
		});

		expect(await slot.findByText("Fennekin · Lv. 21")).toBeTruthy();
		expect(slot.getByText("Egg Incubator")).toBeTruthy();
		expect(slot.getByText("Ways to earn a catch")).toBeTruthy();
		expect(slot.getByText("Caught Pokemon")).toBeTruthy();
		expect(slot.getByRole("button", { name: "✨ Shiny (1)" })).toBeTruthy();
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
});
