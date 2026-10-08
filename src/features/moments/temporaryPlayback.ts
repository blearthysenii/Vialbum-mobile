type RatePlayer = { playing: boolean; playbackRate: number };
// Own exactly one temporary rate; never seek, toggle audio, or start playback.
export function createTemporaryPlayback() {
  let held: RatePlayer | null = null;
  let previousRate = 1;
  return {
    begin(player: RatePlayer) {
      if (held || !player.playing) return false;
      previousRate = player.playbackRate;
      held = player; player.playbackRate = 2;
      return true;
    },
    reset() {
      if (!held) return;
      held.playbackRate = 1; held = null;
    },
    get previousRate() { return previousRate; },
  };
}
