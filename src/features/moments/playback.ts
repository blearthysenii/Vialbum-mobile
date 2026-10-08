// A synchronous gate: navigation/app-state changes stop sound before React rerenders.
export type PlaybackPlayer = { pause(): void; play(): void; muted: boolean };
export function createPlaybackGate() {
  const players = new Map<string, PlaybackPlayer>();
  let allowed = false;
  let active: string | null = null;
  let paused = false;
  let muted = true;
  let silent = false;
  function sync() {
    for (const [id, player] of players) {
      player.muted = id !== active || muted || silent;
      if (allowed && !paused && id === active) player.play(); else player.pause();
    }
  }
  return {
    register(id: string, player: PlaybackPlayer) { players.set(id, player); sync(); return () => { player.pause(); if (players.get(id) === player) players.delete(id); }; },
    select(id: string | null, audioMuted = false) { active = id; silent = audioMuted; sync(); },
    allow(value: boolean) { allowed = value; sync(); },
    pause(value: boolean) { paused = value; sync(); },
    mute(value: boolean) { muted = value; sync(); },
    refresh: sync,
    intendsToPlay(id: string) { return allowed && !paused && active === id; },
    stop() { allowed = false; sync(); },
  };
}
export type PlaybackGate = ReturnType<typeof createPlaybackGate>;
