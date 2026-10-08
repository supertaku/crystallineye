import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Fill, Group } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import type { VisualScore } from '../visual-score/schema';
import { ScorePlayer } from './score-player';
import { StrokeLayer } from './StrokeLayer';
import { DropLayer } from './DropLayer';
import { WashLayer } from './WashLayer';
import { TrajectoryOverlay } from './TrajectoryOverlay';

export const PaintCanvas = memo(function PaintCanvas({ score, sceneIndex, songTime, reducedMotion, diagnosticTrajectory = false }: { score: VisualScore; sceneIndex: number; songTime: SharedValue<number>; reducedMotion: boolean; diagnosticTrajectory?: boolean }) {
  const { width, height } = useWindowDimensions();
  const player = useMemo(() => new ScorePlayer(score), [score]);
  const sections = useMemo(() => player.layersAt(sceneIndex), [player, sceneIndex]);
  const simple = score.analysisKey === 'diagnostic-simple';
  return <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Fill color="#14131b" />
    {sections.map((section) => <Group key={section!.scene.index}>
      <WashLayer washes={section!.washes} scene={section!.scene} time={songTime} width={width} height={height} reducedMotion={reducedMotion} />
      <StrokeLayer strokes={section!.strokes} accents={score.accents} scene={section!.scene} time={songTime} width={width} height={height} reducedMotion={reducedMotion} simple={simple} />
      <DropLayer drops={section!.drops} scene={section!.scene} time={songTime} width={width} height={height} reducedMotion={reducedMotion} />
    </Group>)}
    {__DEV__ && diagnosticTrajectory ? <TrajectoryOverlay key={`${score.version}-${score.analysisKey}`} score={score} songTime={songTime} width={width} height={height} /> : null}
  </Canvas>;
});
