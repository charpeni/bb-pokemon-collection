let activeCry: HTMLAudioElement | null = null;

export function spriteUrl(number: number): string {
	return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${number}.png`;
}

export function shinySpriteUrl(number: number): string {
	return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${number}.png`;
}

export function animatedSpriteUrl(number: number): string | null {
	if (number > 649) return null;
	return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${number}.gif`;
}

export function playPokemonCry(url: string) {
	activeCry?.pause();
	const audio = new Audio(url);
	activeCry = audio;
	audio.addEventListener("ended", () => {
		if (activeCry === audio) activeCry = null;
	}, { once: true });
	void audio.play().catch(() => {
		if (activeCry === audio) activeCry = null;
	});
}
