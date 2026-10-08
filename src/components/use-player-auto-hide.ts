import { useCallback, useEffect, useState } from 'react';
import { VISUAL_CONFIG } from '../config';

export function usePlayerAutoHide(playing: boolean, held: boolean) {
  const [state, setState] = useState({ playing, held, shown: true, interaction: 0 });
  // Reset intent when the playback/interaction context changes, before painting.
  const changed = state.playing !== playing || state.held !== held;
  if (changed) setState({ ...state, playing, held, shown: true });
  const visible = !playing || held || changed || state.shown;
  const touch = useCallback(() => setState((value) => ({ ...value, shown: true, interaction: value.interaction + 1 })), []);
  const toggle = useCallback(() => {
    if (!playing || held) { touch(); return; }
    setState((value) => ({ ...value, shown: !value.shown, interaction: value.interaction + 1 }));
  }, [playing, held, touch]);
  useEffect(() => {
    if (!playing || held || !state.shown) return;
    const timer = setTimeout(() => setState((value) => ({ ...value, shown: false })), VISUAL_CONFIG.playerHideMs);
    return () => clearTimeout(timer);
  }, [playing, held, state.shown, state.interaction]);
  return { visible, touch, toggle };
}
