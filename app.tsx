import { type ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  definePluginApp,
  experimental_useSidebarThreads,
  useBbNavigate,
  useRealtime,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { Capture, Collection, PokemonSettings, rpcContract } from "./server";
import { starters, type StarterId } from "./pokemon";
import { Button } from "@/components/ui/button";
import "./app.css";

const milestoneLabels = {
  branch_opened: "Open a branch",
  commit_created: "Create a commit",
  pr_closed: "Close a pull request",
  ticket_completed: "Complete a ticket",
} as const;

function PokeballIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h6m6 0h6" />
    <circle cx="12" cy="12" r="3" />
  </svg>;
}

function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`relative max-h-[86vh] w-full overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`} role="dialog" aria-modal="true">
        {children}
      </section>
    </div>
  );
}

function useCollection() {
  const rpc = useRpc<typeof rpcContract>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    rpc.call("collection_get").then(setCollection, (cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, [rpc]);
  useEffect(load, [load]);
  useRealtime("collection-changed", load);
  const selectStarter = async (starter: StarterId) => {
    try {
      setCollection(await rpc.call("starter_select", { starterId: starter }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const resetCollection = async () => {
    try {
      setCollection(await rpc.call("collection_reset"));
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    }
  };
  const addDemoReward = async (kind: "egg" | "shiny") => {
    try {
      setCollection(await rpc.call("demo_reward_add", { kind }));
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    }
  };
  return { collection, error, selectStarter, resetCollection, addDemoReward };
}

const spritePatterns: Array<Array<[number, number, number, number]>> = [
  [
    [10, 2, 12, 5], [6, 6, 20, 5], [4, 11, 24, 11], [7, 22, 5, 6],
    [20, 22, 5, 6], [2, 14, 5, 6], [25, 14, 5, 6],
  ],
  [
    [10, 3, 12, 7], [7, 9, 18, 13], [8, 21, 6, 7], [19, 21, 6, 7],
    [24, 17, 5, 5], [27, 12, 3, 5],
  ],
  [
    [9, 3, 14, 7], [6, 9, 20, 14], [8, 22, 6, 6], [19, 22, 6, 6],
    [2, 12, 6, 5], [25, 12, 5, 5],
  ],
];

function spriteUrl(number: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${number}.png`;
}

function shinySpriteUrl(number: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${number}.png`;
}

function animatedSpriteUrl(number: number): string | null {
  if (number > 649) return null;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${number}.gif`;
}

let activeCry: HTMLAudioElement | null = null;

function playPokemonCry(url: string) {
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

function PixelStarter({ id, running = false, size = "large" }: { id: StarterId; running?: boolean; size?: "small" | "large" }) {
  const starter = starters.find((candidate) => candidate.id === id)!;
  const pixels = spritePatterns[starter.number % spritePatterns.length]!;
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={`pokemon-sprite ${running ? "pokemon-sprite-running" : ""} ${size === "small" ? "size-7" : "size-20"}`}
      shapeRendering="crispEdges"
    >
      {pixels.map(([x, y, width, height], index) => (
        <rect key={index} x={x} y={y} width={width} height={height} fill="currentColor" opacity={index === 0 ? 0.65 : 1} />
      ))}
      <rect x="10" y="13" width="3" height="3" className="fill-background" />
      <rect x="20" y="13" width="3" height="3" className="fill-background" />
    </svg>
  );
}

function StarterChoices({ onSelect, pending }: { onSelect: (starter: StarterId) => void; pending: boolean }) {
  return (
    <div className="starter-scroll space-y-5 overflow-y-auto pr-1">
      {Array.from({ length: 9 }, (_, index) => index + 1).map((generation) => (
        <section key={generation}>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Generation {generation}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {starters.slice((generation - 1) * 3, generation * 3).map((starter) => (
              <button
                key={starter.id}
                type="button"
                disabled={pending}
                onClick={() => onSelect(starter.id)}
                className="starter-choice group relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border border-border bg-card px-2 pb-3 pt-2 text-foreground transition hover:-translate-y-0.5 hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="absolute right-2 top-2 font-mono text-[10px] text-muted-foreground">#{String(starter.number).padStart(3, "0")}</span>
                <img src={spriteUrl(starter.number)} alt="" loading="lazy" className="size-16 object-contain [image-rendering:pixelated] transition-transform group-hover:scale-110 sm:size-20" />
                <span className="w-full truncate text-xs font-semibold sm:text-sm">{starter.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StarterSetup({ error, onClose, selectStarter }: { error: string | null; onClose: () => void; selectStarter: (starter: StarterId) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const choose = async (starter: StarterId) => {
    setPending(true);
    await selectStarter(starter);
    setPending(false);
  };
  return (
    <Modal onClose={onClose} wide>
      <Button className="absolute right-3 top-3" variant="ghost" size="sm" aria-label="Close starter selection" onClick={onClose}>Close</Button>
      <div className="mb-4 space-y-1.5">
        <h2 className="text-lg font-semibold">Choose your coding companion</h2>
        <p className="text-sm text-muted-foreground">
          Pick a partner from any generation. They will hang out in every thread and spring into action while an agent is working.
        </p>
      </div>
      <StarterChoices onSelect={(starter) => void choose(starter)} pending={pending} />
      {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
    </Modal>
  );
}

function CaptureCard({ capture }: { capture: Capture }) {
  const displaySprite = capture.isShiny
    ? (capture.shinySpriteUrl ?? shinySpriteUrl(capture.pokemonNumber))
    : (capture.spriteUrl ?? spriteUrl(capture.pokemonNumber));
  return (
    <article className={`pokemon-card group relative overflow-hidden rounded-xl border bg-card ${capture.isShiny ? "border-yellow-400 ring-1 ring-yellow-400/30" : capture.isEgg ? "border-violet-400/60 ring-1 ring-violet-400/20" : "border-border"}`}>
      <div className="pokemon-art-stage relative flex h-36 items-center justify-center overflow-hidden border-b border-border p-4">
        <span className="absolute left-4 top-3 font-mono text-xs font-semibold tracking-widest text-muted-foreground">
          {capture.isEgg ? "RARE EGG" : `#${String(capture.pokemonNumber).padStart(3, "0")}`}
        </span>
        {capture.isShiny ? <span className="absolute right-3 top-3 text-lg" title="Shiny!">✨</span> : null}
        {capture.isEgg ? (
          <div className="pokemon-egg" role="img" aria-label="Mystery Pokemon egg" />
        ) : (
          <button
            type="button"
            aria-label={`Play ${capture.pokemonName}'s cry`}
            title={`Play ${capture.pokemonName}'s cry`}
            className="h-full w-full max-w-24 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => playPokemonCry(capture.cryUrl)}
          >
            <img
              src={displaySprite}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain [image-rendering:pixelated] transition-transform duration-300 group-hover:scale-125"
            />
          </button>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight text-foreground">{capture.isShiny ? `✨ ${capture.pokemonName}` : capture.pokemonName}</h3>
          <div className="flex flex-wrap justify-end gap-1">
            <span data-rarity={capture.rarity} className="pokemon-rarity rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{capture.rarity}</span>
            {capture.types.map((type) => <span key={type} data-type={type} className="pokemon-type rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{type}</span>)}
          </div>
        </div>
        {capture.isEgg ? (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Incubation</span>
              <span>{capture.eggSteps.toLocaleString()} / {capture.eggStepsRequired.toLocaleString()} steps</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Egg incubation progress" aria-valuemin={0} aria-valuemax={capture.eggStepsRequired} aria-valuenow={capture.eggSteps}>
              <div className="pokemon-egg-progress h-full rounded-full" style={{ width: `${capture.eggStepsRequired === 0 ? 0 : capture.eggSteps / capture.eggStepsRequired * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{capture.eggStepsRequired - capture.eggSteps > 2000 ? "It looks like this Egg will take a long time to hatch." : "Sounds can be heard coming from inside!"}</p>
          </div>
        ) : null}
        {capture.heightDecimeters === null || capture.weightHectograms === null ? null : (
          <dl className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <div><dt className="inline font-semibold text-foreground">HT </dt><dd className="inline">{(capture.heightDecimeters / 10).toFixed(1)} m</dd></div>
            <div><dt className="inline font-semibold text-foreground">WT </dt><dd className="inline">{(capture.weightHectograms / 10).toFixed(1)} kg</dd></div>
          </dl>
        )}
        {capture.flavorText === null ? null : <p className="mt-3 min-h-10 text-xs italic leading-5 text-muted-foreground">{capture.flavorText}</p>}
        {capture.encounterLocation === null ? null : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {capture.encounterLocation}{capture.encounterLevel === null ? "" : ` · Lv. ${capture.encounterLevel}`}{capture.encounterMethod === null ? "" : ` · ${capture.encounterMethod}`}{capture.encounterVersion === null ? "" : ` · ${capture.encounterVersion}`}
          </p>
        )}
        <div className="mt-4 border-t border-dashed border-border pt-3">
          <p className="text-xs font-medium leading-5 text-foreground">{capture.description}</p>
          <time className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground" dateTime={capture.caughtAt}>
            {capture.isEgg ? "Found" : "Caught"} {new Date(capture.caughtAt).toLocaleDateString()}
          </time>
        </div>
      </div>
    </article>
  );
}

type ConnectionName = "github" | "shortcut" | "jira";

function ConnectionBadge({ connection }: { connection: PokemonSettings["connections"][ConnectionName] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${connection.authenticated ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted text-muted-foreground"}`}>
      <span className={`size-1.5 rounded-full ${connection.authenticated ? "bg-emerald-500" : "bg-muted-foreground"}`} />
      {connection.authenticated ? "Authenticated" : "Not authenticated"}
    </span>
  );
}

function SettingsPage() {
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();
  const [settings, setSettings] = useState<PokemonSettings | null>(null);
  const [watchedRepositories, setWatchedRepositories] = useState<string[]>([]);
  const [projectManagementTool, setProjectManagementTool] = useState<PokemonSettings["projectManagementTool"]>("shortcut");
  const [githubToken, setGithubToken] = useState("");
  const [shortcutToken, setShortcutToken] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const acceptSettings = useCallback((next: PokemonSettings) => {
    setSettings(next);
    setWatchedRepositories(next.watchedRepositories);
    setProjectManagementTool(next.projectManagementTool);
    setJiraBaseUrl(next.jiraBaseUrl);
    setJiraEmail(next.jiraEmail);
    setError(null);
  }, []);

  useEffect(() => {
    rpc.call("settings_get").then(acceptSettings, (cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [acceptSettings, rpc]);

  const connect = async (service: ConnectionName) => {
    setPending(service);
    setSaved(false);
    try {
      const next = service === "github"
        ? await rpc.call("connection_save", { service, token: githubToken })
        : service === "shortcut"
          ? await rpc.call("connection_save", { service, token: shortcutToken })
          : await rpc.call("connection_save", { service, token: jiraToken, baseUrl: jiraBaseUrl, email: jiraEmail });
      acceptSettings(next);
      if (service === "github") setGithubToken("");
      else if (service === "shortcut") setShortcutToken("");
      else setJiraToken("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
    }
  };

  const disconnect = async (service: ConnectionName) => {
    setPending(service);
    setSaved(false);
    try {
      acceptSettings(await rpc.call("connection_disconnect", { service }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
    }
  };

  const save = async () => {
    setPending("settings");
    setSaved(false);
    try {
      acceptSettings(await rpc.call("settings_update", { watchedRepositories, projectManagementTool }));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
    }
  };

  if (settings === null) return <div className="p-5 text-sm text-muted-foreground">Loading settings...</div>;
  const inputClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Pokemon Collection settings</h2><p className="mt-1 text-sm text-muted-foreground">Choose where engineering milestones come from.</p></div>
          <Button variant="outline" size="sm" onClick={() => navigate.toPluginPanel("collection")}>Back to collection</Button>
        </div>

        {error === null ? null : <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">GitHub repositories</h3><p className="mt-1 text-sm text-muted-foreground">Connect GitHub, then choose repositories from the dropdown.</p></div>
            <ConnectionBadge connection={settings.connections.github} />
          </div>
          {settings.connections.github.authenticated ? (
            <div className="mt-4 flex justify-end"><Button variant="outline" size="sm" disabled={pending === "github"} onClick={() => void disconnect("github")}>Disconnect GitHub</Button></div>
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
              <h4 className="text-sm font-semibold">Create a fine-grained personal access token</h4>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                <li>Under <strong className="text-foreground">Repository access</strong>, choose only the repositories Pokemon Collection may watch.</li>
                <li>Under <strong className="text-foreground">Repository permissions</strong>, confirm <strong className="text-foreground">Metadata: Read-only</strong>. GitHub may enable it automatically.</li>
                <li>No Contents, Issues, Pull requests, or write permissions are needed.</li>
              </ol>
              <Button className="mt-2 h-auto px-0 py-1" variant="link" size="sm" onClick={() => navigate.openUrl("https://github.com/settings/personal-access-tokens/new")}>Create token on GitHub</Button>
              <div className="mt-3 flex gap-2"><input aria-label="GitHub fine-grained personal access token" type="password" autoComplete="off" className={inputClass} value={githubToken} onChange={(event) => setGithubToken(event.target.value)} placeholder="github_pat_..." /><Button disabled={githubToken.trim() === "" || pending === "github"} onClick={() => void connect("github")}>{pending === "github" ? "Checking..." : "Connect"}</Button></div>
              <p className="mt-2 text-xs text-muted-foreground">Organization-owned repositories may require an administrator to approve the token.</p>
            </div>
          )}
          {settings.connections.github.error === null ? null : <p className="mt-2 text-xs text-destructive">{settings.connections.github.error}</p>}
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="text-sm font-semibold">Repositories to watch</h4>
            {settings.connections.github.authenticated && settings.repositories.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No repositories are available to this token.</p> : null}
            {!settings.connections.github.authenticated ? <p className="mt-2 text-sm text-muted-foreground">Connect GitHub to choose repositories.</p> : (
              <details className="group relative mt-3">
                <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span>{watchedRepositories.length === 0 ? "Select repositories" : `${watchedRepositories.length} ${watchedRepositories.length === 1 ? "repository" : "repositories"} selected`}</span>
                  <svg viewBox="0 0 24 24" className="size-4 text-muted-foreground transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-border bg-popover p-2 shadow-xl">
                  <div className="mb-2 flex items-center justify-between border-b border-border px-1 pb-2">
                    <span className="text-xs text-muted-foreground">Choose up to 100 repositories</span>
                    <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setWatchedRepositories(settings.repositories.slice(0, 100).map((repository) => repository.fullName))}>Select all</Button><Button variant="ghost" size="sm" onClick={() => setWatchedRepositories([])}>Clear</Button></div>
                  </div>
                  <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                    {settings.repositories.map((repository) => (
                      <label key={repository.fullName} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent">
                        <input type="checkbox" checked={watchedRepositories.includes(repository.fullName)} onChange={(event) => setWatchedRepositories((current) => event.target.checked ? [...current, repository.fullName] : current.filter((value) => value !== repository.fullName))} />
                        <span className="min-w-0 flex-1 truncate font-medium">{repository.fullName}</span>
                        {repository.private ? <span className="text-[10px] uppercase text-muted-foreground">Private</span> : null}
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold">Project management</h3>
          <p className="mt-1 text-sm text-muted-foreground">Choose the system that should provide completed-ticket milestones.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {([['shortcut', 'Shortcut'], ['jira', 'Jira'], ['github_issues', 'GitHub Issues']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={projectManagementTool === value} className={`rounded-lg border p-3 text-left text-sm transition ${projectManagementTool === value ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`} onClick={() => setProjectManagementTool(value)}>
                <strong className="block">{label}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">{settings.connections[value === "github_issues" ? "github" : value].authenticated ? "Authenticated" : "Not authenticated"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Shortcut connection</h3><p className="mt-1 text-sm text-muted-foreground">Use an API token from Shortcut settings.</p></div><ConnectionBadge connection={settings.connections.shortcut} /></div>
          {settings.connections.shortcut.authenticated ? <div className="mt-4 flex justify-end"><Button variant="outline" size="sm" disabled={pending === "shortcut"} onClick={() => void disconnect("shortcut")}>Disconnect Shortcut</Button></div> : <div className="mt-4 flex gap-2"><input aria-label="Shortcut API token" type="password" autoComplete="off" className={inputClass} value={shortcutToken} onChange={(event) => setShortcutToken(event.target.value)} /><Button disabled={shortcutToken.trim() === "" || pending === "shortcut"} onClick={() => void connect("shortcut")}>{pending === "shortcut" ? "Checking..." : "Connect"}</Button></div>}
          {settings.connections.shortcut.error === null ? null : <p className="mt-2 text-xs text-destructive">{settings.connections.shortcut.error}</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Jira connection</h3><p className="mt-1 text-sm text-muted-foreground">Use your Atlassian site URL, account email, and API token.</p></div><ConnectionBadge connection={settings.connections.jira} /></div>
          {settings.connections.jira.authenticated ? <div className="mt-4 flex justify-end"><Button variant="outline" size="sm" disabled={pending === "jira"} onClick={() => void disconnect("jira")}>Disconnect Jira</Button></div> : <div className="mt-4 grid gap-2 sm:grid-cols-2"><input aria-label="Jira site URL" type="url" className={inputClass} value={jiraBaseUrl} onChange={(event) => setJiraBaseUrl(event.target.value)} placeholder="https://company.atlassian.net" /><input aria-label="Jira account email" type="email" className={inputClass} value={jiraEmail} onChange={(event) => setJiraEmail(event.target.value)} placeholder="you@company.com" /><input aria-label="Jira API token" type="password" autoComplete="off" className={`${inputClass} sm:col-span-2`} value={jiraToken} onChange={(event) => setJiraToken(event.target.value)} /><div className="sm:col-span-2 flex justify-end"><Button disabled={jiraToken.trim() === "" || jiraBaseUrl.trim() === "" || jiraEmail.trim() === "" || pending === "jira"} onClick={() => void connect("jira")}>{pending === "jira" ? "Checking..." : "Connect"}</Button></div></div>}
          {settings.connections.jira.error === null ? null : <p className="mt-2 text-xs text-destructive">{settings.connections.jira.error}</p>}
        </section>

        <div className="flex items-center justify-end gap-3 pb-6">{saved ? <span className="text-sm text-emerald-600 dark:text-emerald-400">Settings saved</span> : null}<Button disabled={pending === "settings"} onClick={() => void save()}>{pending === "settings" ? "Saving..." : "Save settings"}</Button></div>
      </div>
    </div>
  );
}

function CollectionPage() {
  const { collection, error, selectStarter, resetCollection, addDemoReward } = useCollection();
  const [collectionView, setCollectionView] = useState<"all" | "shiny">("all");
  const [starterDismissed, setStarterDismissed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [demoPending, setDemoPending] = useState<"egg" | "shiny" | null>(null);
  const [lastDemoAdded, setLastDemoAdded] = useState<"egg" | "shiny" | null>(null);
  if (collection === null) {
    return <div className="p-5 text-sm text-muted-foreground">Loading your Pokedex...</div>;
  }
  const starter = starters.find((candidate) => candidate.id === collection.starter);
  const starterCapture = collection.captures.find((capture) => capture.milestone === "starter_selected");
  const companion = collection.companion;
  const levelProgress = companion === null || companion.level === 100 || companion.experienceForNextLevel === 0
    ? 100
    : Math.min(100, companion.experienceIntoLevel / companion.experienceForNextLevel * 100);
  const activeEggs = collection.captures.filter((capture) => capture.isEgg);
  const hatchedEggs = collection.captures.filter((capture) => capture.eggStepsRequired > 0 && !capture.isEgg);
  const caughtPokemon = collection.captures.filter((capture) => !capture.isEgg);
  const visibleCaptures = collectionView === "shiny"
    ? caughtPokemon.filter((capture) => capture.isShiny)
    : caughtPokemon;
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6">
        <section className="pokemon-hero relative overflow-hidden rounded-xl border border-border bg-card p-5 md:p-7">
          <div className="relative z-10 flex items-center gap-5">
            {starter === undefined ? <div className="pokemon-ball size-16" /> : (
              <div className="relative flex size-24 shrink-0 items-center justify-center">
                <div className="absolute inset-2 rounded-full border border-dashed border-border bg-background/60" />
                <img src={companion?.spriteUrl ?? starterCapture?.spriteUrl ?? spriteUrl(starter.number)} alt={companion?.pokemonName ?? starter.name} className="relative size-24 object-contain [image-rendering:pixelated]" />
              </div>
            )}
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Trainer log</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Ship code. Catch Pokemon.</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Open a branch, commit working code, close a PR, or complete a ticket. Your agent records the verified milestone and rewards it with a catch.
              </p>
              {companion === null ? null : (
                <div className="mt-4 max-w-md">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <strong className="text-foreground">{companion.pokemonName} · Lv. {companion.level}</strong>
                    <span className="text-muted-foreground">
                      {companion.level === 100 ? "Max level" : `${companion.experienceIntoLevel.toLocaleString()} / ${companion.experienceForNextLevel.toLocaleString()} EXP`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${companion.pokemonName} level progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(levelProgress)}>
                    <div className="pokemon-exp-bar h-full rounded-full" style={{ width: `${levelProgress}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {companion.nextEvolution === null ? `${companion.tokensPerExperience} tokens = 1 EXP` : `Evolves into ${companion.nextEvolution.name} at level ${companion.nextEvolution.level} · ${companion.tokensPerExperience} tokens = 1 EXP`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {error === null ? null : <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4"><strong className="block text-2xl">{collection.totalCaptures}</strong><span className="text-xs text-muted-foreground">Total catches</span></div>
          <div className="rounded-lg border border-border bg-card p-4"><strong className="block text-2xl">{collection.uniquePokemon}</strong><span className="text-xs text-muted-foreground">Unique Pokemon</span></div>
          <div className="rounded-lg border border-border bg-card p-4"><strong className="block text-2xl">{collection.shinyCaptures} ✨</strong><span className="text-xs text-muted-foreground">Shiny catches</span></div>
        </div>

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDeveloperOpen(true)}>
            Developer tools
          </Button>
          <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setResetOpen(true)}>
            Reset collection
          </Button>
        </div>

        {resetOpen ? <Modal onClose={() => setResetOpen(false)}>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold">Reset your Pokemon collection?</h2>
              <p className="text-sm text-muted-foreground">
                This permanently removes your starter, every catch and shiny, all EXP, and token progress. You will choose a new starter afterward.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" disabled={resetPending} onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={resetPending}
                onClick={() => {
                  setResetPending(true);
                  void resetCollection().then((reset) => {
                    if (reset) {
                      setCollectionView("all");
                      setStarterDismissed(false);
                      setResetOpen(false);
                    }
                  }).finally(() => setResetPending(false));
                }}
              >
                {resetPending ? "Resetting..." : "Reset everything"}
              </Button>
            </div>
        </Modal> : null}

        {developerOpen ? <Modal onClose={() => setDeveloperOpen(false)}>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold">Developer tools</h2>
              <p className="text-sm text-muted-foreground">
                Populate deterministic demo rewards without recording an engineering milestone. These controls modify only this local collection.
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col items-center rounded-lg border border-violet-400/40 bg-violet-400/5 p-5 text-center">
                <div className="pokemon-egg pokemon-egg-small" aria-hidden="true" />
                <h3 className="mt-3 font-semibold text-foreground">Mystery Egg</h3>
                <p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">Adds a rare Egg with real incubation progress to the Incubator.</p>
                <Button
                  className="mt-4 w-full"
                  size="sm"
                  disabled={collection.starter === null || demoPending !== null}
                  onClick={() => {
                    setDemoPending("egg");
                    void addDemoReward("egg").then((added) => {
                      if (added) setLastDemoAdded("egg");
                    }).finally(() => setDemoPending(null));
                  }}
                >
                  {demoPending === "egg" ? "Adding Egg..." : "Add demo Egg"}
                </Button>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-yellow-400/40 bg-yellow-400/5 p-5 text-center">
                <img src={shinySpriteUrl(77)} alt="Shiny Ponyta" className="size-16 object-contain [image-rendering:pixelated]" />
                <h3 className="mt-3 font-semibold text-foreground">Shiny Pokemon</h3>
                <p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">Adds a shiny Ponyta directly to the caught-Pokemon collection.</p>
                <Button
                  className="mt-4 w-full"
                  size="sm"
                  disabled={collection.starter === null || demoPending !== null}
                  onClick={() => {
                    setDemoPending("shiny");
                    void addDemoReward("shiny").then((added) => {
                      if (added) setLastDemoAdded("shiny");
                    }).finally(() => setDemoPending(null));
                  }}
                >
                  {demoPending === "shiny" ? "Adding Shiny..." : "Add demo Shiny"}
                </Button>
              </div>
            </div>
            {collection.starter === null ? <p className="text-sm text-destructive">Choose a starter before adding demo rewards.</p> : null}
            {lastDemoAdded === null ? null : <p className="text-sm text-muted-foreground">Added a demo {lastDemoAdded === "egg" ? "Egg to the Incubator" : "shiny Ponyta to the Pokédex"}.</p>}
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setDeveloperOpen(false)}>Done</Button>
            </div>
        </Modal> : null}

        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Field guide</p><h2 className="text-lg font-semibold">Ways to earn a catch</h2></div>
            <code className="hidden text-xs text-muted-foreground sm:block">bb pokemon collection</code>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(milestoneLabels).map(([kind, label]) => (
              <div key={kind} className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-3 text-sm">
                <span className="text-primary" aria-hidden="true">{kind === "branch_opened" ? "⑂" : kind === "pr_closed" ? "✓" : "●"}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Day care</p>
              <h2 className="text-lg font-semibold">Egg Incubator</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1"><strong className="text-foreground">{activeEggs.length}</strong> incubating</span>
              <span className="rounded-full border border-border bg-muted px-2.5 py-1"><strong className="text-foreground">{hatchedEggs.length}</strong> hatched</span>
            </div>
          </div>
          {activeEggs.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-violet-400/40 bg-violet-400/5 p-8 text-center">
              <div className="pokemon-egg pokemon-egg-small mx-auto" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium text-foreground">No Eggs are incubating.</p>
              <p className="mt-1 text-xs text-muted-foreground">Rare encounters appear here as mystery Eggs. Every 100 tokens adds one step.</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeEggs.map((capture) => <CaptureCard key={capture.id} capture={capture} />)}
            </div>
          )}
        </section>

        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Pokedex</p>
              <h2 className="text-lg font-semibold">Caught Pokemon</h2>
            </div>
            <div className="flex rounded-lg border border-border bg-muted p-1" aria-label="Filter Pokemon collection">
              <button
                type="button"
                aria-pressed={collectionView === "all"}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${collectionView === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setCollectionView("all")}
              >
                All
              </button>
              <button
                type="button"
                aria-pressed={collectionView === "shiny"}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${collectionView === "shiny" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setCollectionView("shiny")}
              >
                ✨ Shiny ({collection.shinyCaptures})
              </button>
            </div>
          </div>
          {caughtPokemon.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Choose a starter to begin your collection.</div>
          ) : visibleCaptures.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No shiny Pokemon yet. Keep shipping for another chance.</div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCaptures.map((capture) => <CaptureCard key={capture.id} capture={capture} />)}
            </div>
          )}
        </section>
      </div>
      {collection.starter === null && !starterDismissed ? <StarterSetup error={error} onClose={() => setStarterDismissed(true)} selectStarter={selectStarter} /> : null}
    </div>
  );
}

function FloatingCompanion() {
  const { collection } = useCollection();
  const { threads } = experimental_useSidebarThreads();
  const [position, setPosition] = useState({ x: 32, y: window.innerHeight - 120 });
  const [isDragging, setIsDragging] = useState(false);

  const isRunning = threads.some(
    (thread) => thread.indicator === "runtime" || Object.values(thread.activity).some((count) => count > 0)
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX - 32, y: event.clientY - 32 });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  if (collection?.starter === null || collection === null) return null;
  const starter = starters.find((candidate) => candidate.id === collection.starter)!;
  const starterCapture = collection.captures.find((capture) => capture.milestone === "starter_selected");
  const companion = collection.companion;
  const animated = companion?.animatedSpriteUrl ?? (companion === null ? starterCapture?.animatedSpriteUrl : null) ?? animatedSpriteUrl(companion?.pokemonNumber ?? starter.number);
  const fallback = companion?.spriteUrl ?? starterCapture?.spriteUrl ?? spriteUrl(companion?.pokemonNumber ?? starter.number);
  const companionName = companion?.pokemonName ?? starter.name;

  return createPortal(
    <div
      className={`pokemon-floating-companion fixed z-50 cursor-grab select-none ${isDragging ? "cursor-grabbing" : ""} ${isRunning ? "pokemon-bouncing" : ""}`}
      style={{ left: position.x, top: position.y }}
      onMouseDown={() => setIsDragging(true)}
      title={`${companionName} · Lv. ${companion?.level ?? 5}${isRunning ? " - Running with your agent!" : ""}`}
    >
      <img
        src={animated ?? fallback}
        alt={companionName}
        className="size-16 object-contain [image-rendering:pixelated] drop-shadow-lg"
        draggable={false}
      />
    </div>,
    document.body
  );
}

function ThreadCompanion({ threadId, isCompactViewport }: { threadId: string; isCompactViewport: boolean }) {
  const { collection } = useCollection();
  const { threads } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const thread = threads.find((candidate) => candidate.id === threadId);
  const running = thread !== undefined && (
    thread.indicator === "runtime" ||
    Object.values(thread.activity).some((count) => count > 0)
  );
  if (collection?.starter === null || collection === null) return null;
  const starter = starters.find((candidate) => candidate.id === collection.starter)!;
  const companion = collection.companion;
  const companionName = companion?.pokemonName ?? starter.name;
  return (
    <Button
      variant="ghost"
      size={isCompactViewport ? "icon" : "sm"}
      className="h-7 gap-1.5 px-1.5"
      aria-label={`Open Pokemon collection. ${companionName} is level ${companion?.level ?? 5} and ${running ? "running with your agent" : "resting"}.`}
      onClick={() => navigate.toPluginPanel("collection")}
    >
      {companion === null || companion.pokemonNumber === starter.number ? (
        <PixelStarter id={starter.id} running={running} size="small" />
      ) : (
        <img src={companion.spriteUrl ?? spriteUrl(companion.pokemonNumber)} alt="" className={`size-7 object-contain [image-rendering:pixelated] ${running ? "pokemon-bouncing" : ""}`} />
      )}
      {isCompactViewport ? null : <span className="max-w-28 truncate text-xs">{companionName} · Lv. {companion?.level ?? 5}</span>}
    </Button>
  );
}

function CollectionPanel({ subPath }: { subPath: string }) {
  return subPath === "settings" ? <SettingsPage /> : <CollectionPage />;
}

function CollectionHeaderActions() {
  const navigate = useBbNavigate();
  return (
    <Button variant="ghost" size="icon" aria-label="Pokemon Collection settings" onClick={() => navigate.toPluginPanel("collection", { subPath: "settings" })}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.5v-.1A1.7 1.7 0 0 0 8.4 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.5h.3A1.7 1.7 0 0 0 4 8.4a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.46 3.6l.06.06A1.7 1.7 0 0 0 8.4 4a1.7 1.7 0 0 0 1-.6A1.7 1.7 0 0 0 9.8 2.3V2h4.1v.3A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.4a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.3v4.1h-.3A1.7 1.7 0 0 0 19.4 15Z" />
      </svg>
    </Button>
  );
}

export default definePluginApp((app) => {
  app.experimental_icons.register({ name: "PokemonCatcherPokeball", component: PokeballIcon });
  app.slots.navPanel({
    id: "collection",
    title: "Pokemon collection",
    icon: "PokemonCatcherPokeball",
    path: "collection",
    component: CollectionPanel,
    headerContent: CollectionHeaderActions,
  });
  app.slots.experimental_appOverlay({
    id: "floating-companion",
    component: FloatingCompanion,
  });
  app.slots.experimental_threadHeaderAction({
    id: "companion",
    title: "Pokemon companion",
    component: ThreadCompanion,
  });
});
