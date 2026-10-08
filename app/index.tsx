import { useState } from 'react';
import Constants from 'expo-constants';

// Do not initialize the custom audio JSI module when comparing V2 in Expo Go.
/* eslint-disable @typescript-eslint/no-require-imports -- Conditional native-module initialization is required for the Expo Go baseline. */
const expoGo = Constants.appOwnership === 'expo';
const V2Screen = __DEV__ ? (require('../src/legacy-v2/V2Screen') as typeof import('../src/legacy-v2/V2Screen')).default : null;
const V3Screen = expoGo ? null : (require('../src/components/V3MusicScreen') as typeof import('../src/components/V3MusicScreen')).V3MusicScreen;

export default function MusicScreen() {
  const [mode, setMode] = useState<'v2' | 'v3'>(expoGo ? 'v2' : 'v3');
  if (__DEV__ && mode === 'v2' && V2Screen) return <V2Screen onV3={expoGo ? undefined : () => setMode('v3')} />;
  return V3Screen ? <V3Screen onLegacy={__DEV__ ? () => setMode('v2') : undefined} /> : null;
}
