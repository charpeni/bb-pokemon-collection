# Pokemon Catcher

A BB plugin that rewards engineering milestones with Pokémon catches.

## Collection experience

The Pokémon collection panel includes all 27 starters from generations 1–9,
random encounters spanning the National Pokédex, an evolving companion,
animated sprites, grouped duplicate counts, encounter details, rarity and type
badges, shiny and type filters, and an egg incubator. The companion also appears
in the thread header and as a draggable overlay that becomes more active while
agents are working.

Agent usage awards one experience point per 5,000 tokens. Incubating eggs gain
one step per 100 tokens. Developer tools in the collection panel can add a demo
Egg or shiny Pokémon and reset local collection progress.

## Automatic Git detection

The plugin scans repositories registered as BB project sources or active environments every 15 seconds. Existing branches and worktrees are baselined without rewards. New branches and worktrees created in BB or a terminal receive one idempotent reward.

Only repositories known to BB are monitored. Arbitrary repositories elsewhere on the machine are intentionally excluded.

## Commands

```sh
bb pokemon collection --json
bb pokemon starter fennekin
bb pokemon catch commit_created --source git --reference abc123 --title "Save progress"
```

## Development

```sh
npm install --include=dev
npm run typecheck
npm test
bb plugin build
```
