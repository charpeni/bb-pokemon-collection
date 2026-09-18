export const starters = [
	{ id: "bulbasaur", name: "Bulbasaur", number: 1 },
	{ id: "charmander", name: "Charmander", number: 4 },
	{ id: "squirtle", name: "Squirtle", number: 7 },
	{ id: "chikorita", name: "Chikorita", number: 152 },
	{ id: "cyndaquil", name: "Cyndaquil", number: 155 },
	{ id: "totodile", name: "Totodile", number: 158 },
	{ id: "treecko", name: "Treecko", number: 252 },
	{ id: "torchic", name: "Torchic", number: 255 },
	{ id: "mudkip", name: "Mudkip", number: 258 },
	{ id: "turtwig", name: "Turtwig", number: 387 },
	{ id: "chimchar", name: "Chimchar", number: 390 },
	{ id: "piplup", name: "Piplup", number: 393 },
	{ id: "snivy", name: "Snivy", number: 495 },
	{ id: "tepig", name: "Tepig", number: 498 },
	{ id: "oshawott", name: "Oshawott", number: 501 },
	{ id: "chespin", name: "Chespin", number: 650 },
	{ id: "fennekin", name: "Fennekin", number: 653 },
	{ id: "froakie", name: "Froakie", number: 656 },
	{ id: "rowlet", name: "Rowlet", number: 722 },
	{ id: "litten", name: "Litten", number: 725 },
	{ id: "popplio", name: "Popplio", number: 728 },
	{ id: "grookey", name: "Grookey", number: 810 },
	{ id: "scorbunny", name: "Scorbunny", number: 813 },
	{ id: "sobble", name: "Sobble", number: 816 },
	{ id: "sprigatito", name: "Sprigatito", number: 906 },
	{ id: "fuecoco", name: "Fuecoco", number: 909 },
	{ id: "quaxly", name: "Quaxly", number: 912 },
] as const;

export const pokemon = [
	...starters,
	{ id: "caterpie", name: "Caterpie", number: 10 },
	{ id: "pidgey", name: "Pidgey", number: 16 },
	{ id: "pikachu", name: "Pikachu", number: 25 },
	{ id: "vulpix", name: "Vulpix", number: 37 },
	{ id: "psyduck", name: "Psyduck", number: 54 },
	{ id: "growlithe", name: "Growlithe", number: 58 },
	{ id: "abra", name: "Abra", number: 63 },
	{ id: "machop", name: "Machop", number: 66 },
	{ id: "geodude", name: "Geodude", number: 74 },
	{ id: "gastly", name: "Gastly", number: 92 },
	{ id: "cubone", name: "Cubone", number: 104 },
	{ id: "eevee", name: "Eevee", number: 133 },
	{ id: "dratini", name: "Dratini", number: 147 },
] as const;

export const milestoneKinds = ["branch_opened", "commit_created", "pr_closed", "ticket_completed"] as const;
export type MilestoneKind = (typeof milestoneKinds)[number];
export type StarterId = (typeof starters)[number]["id"];

export type Evolution = { id: string; name: string; number: number; level: number };

export const starterEvolutionChains: Record<StarterId, readonly Evolution[]> = {
	bulbasaur: [{ id: "ivysaur", name: "Ivysaur", number: 2, level: 16 }, { id: "venusaur", name: "Venusaur", number: 3, level: 32 }],
	charmander: [{ id: "charmeleon", name: "Charmeleon", number: 5, level: 16 }, { id: "charizard", name: "Charizard", number: 6, level: 36 }],
	squirtle: [{ id: "wartortle", name: "Wartortle", number: 8, level: 16 }, { id: "blastoise", name: "Blastoise", number: 9, level: 36 }],
	chikorita: [{ id: "bayleef", name: "Bayleef", number: 153, level: 16 }, { id: "meganium", name: "Meganium", number: 154, level: 32 }],
	cyndaquil: [{ id: "quilava", name: "Quilava", number: 156, level: 14 }, { id: "typhlosion", name: "Typhlosion", number: 157, level: 36 }],
	totodile: [{ id: "croconaw", name: "Croconaw", number: 159, level: 18 }, { id: "feraligatr", name: "Feraligatr", number: 160, level: 30 }],
	treecko: [{ id: "grovyle", name: "Grovyle", number: 253, level: 16 }, { id: "sceptile", name: "Sceptile", number: 254, level: 36 }],
	torchic: [{ id: "combusken", name: "Combusken", number: 256, level: 16 }, { id: "blaziken", name: "Blaziken", number: 257, level: 36 }],
	mudkip: [{ id: "marshtomp", name: "Marshtomp", number: 259, level: 16 }, { id: "swampert", name: "Swampert", number: 260, level: 36 }],
	turtwig: [{ id: "grotle", name: "Grotle", number: 388, level: 18 }, { id: "torterra", name: "Torterra", number: 389, level: 32 }],
	chimchar: [{ id: "monferno", name: "Monferno", number: 391, level: 14 }, { id: "infernape", name: "Infernape", number: 392, level: 36 }],
	piplup: [{ id: "prinplup", name: "Prinplup", number: 394, level: 16 }, { id: "empoleon", name: "Empoleon", number: 395, level: 36 }],
	snivy: [{ id: "servine", name: "Servine", number: 496, level: 17 }, { id: "serperior", name: "Serperior", number: 497, level: 36 }],
	tepig: [{ id: "pignite", name: "Pignite", number: 499, level: 17 }, { id: "emboar", name: "Emboar", number: 500, level: 36 }],
	oshawott: [{ id: "dewott", name: "Dewott", number: 502, level: 17 }, { id: "samurott", name: "Samurott", number: 503, level: 36 }],
	chespin: [{ id: "quilladin", name: "Quilladin", number: 651, level: 16 }, { id: "chesnaught", name: "Chesnaught", number: 652, level: 36 }],
	fennekin: [{ id: "braixen", name: "Braixen", number: 654, level: 16 }, { id: "delphox", name: "Delphox", number: 655, level: 36 }],
	froakie: [{ id: "frogadier", name: "Frogadier", number: 657, level: 16 }, { id: "greninja", name: "Greninja", number: 658, level: 36 }],
	rowlet: [{ id: "dartrix", name: "Dartrix", number: 723, level: 17 }, { id: "decidueye", name: "Decidueye", number: 724, level: 34 }],
	litten: [{ id: "torracat", name: "Torracat", number: 726, level: 17 }, { id: "incineroar", name: "Incineroar", number: 727, level: 34 }],
	popplio: [{ id: "brionne", name: "Brionne", number: 729, level: 17 }, { id: "primarina", name: "Primarina", number: 730, level: 34 }],
	grookey: [{ id: "thwackey", name: "Thwackey", number: 811, level: 16 }, { id: "rillaboom", name: "Rillaboom", number: 812, level: 35 }],
	scorbunny: [{ id: "raboot", name: "Raboot", number: 814, level: 16 }, { id: "cinderace", name: "Cinderace", number: 815, level: 35 }],
	sobble: [{ id: "drizzile", name: "Drizzile", number: 817, level: 16 }, { id: "inteleon", name: "Inteleon", number: 818, level: 35 }],
	sprigatito: [{ id: "floragato", name: "Floragato", number: 907, level: 16 }, { id: "meowscarada", name: "Meowscarada", number: 908, level: 36 }],
	fuecoco: [{ id: "crocalor", name: "Crocalor", number: 910, level: 16 }, { id: "skeledirge", name: "Skeledirge", number: 911, level: 36 }],
	quaxly: [{ id: "quaxwell", name: "Quaxwell", number: 913, level: 16 }, { id: "quaquaval", name: "Quaquaval", number: 914, level: 36 }],
};

export function spriteUrl(number: number, shiny = false) {
	return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? "shiny/" : ""}${number}.png`;
}

export function animatedSpriteUrl(number: number) {
	return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${number}.gif`;
}
