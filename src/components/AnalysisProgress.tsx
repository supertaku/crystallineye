import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AnalysisProgress as Progress } from '../analysis/analysis-schema';

const stages: Record<Progress['stage'], string> = { decode: 'Preparing audio', transcription: 'Understanding your music', rhythm: 'Finding beats', harmony: 'Finding harmony', structure: 'Finding musical sections', 'visual-score': 'Painting the visual score' };
export function AnalysisProgress({ progress, cancelling, onCancel }: { progress: Progress; cancelling: boolean; onCancel: () => void }) {
  const percentage = Math.round(progress.overallProgress * 100);
  return <View style={styles.root}>
    <Text style={styles.brand}>crystallineye</Text><Text style={styles.title}>Analyzing your music</Text>
    <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityLabel="Music analysis" accessibilityValue={{ min: 0, max: 100, now: percentage }}>
      <View style={[styles.fill, { width: `${percentage}%` }]} />
    </View>
    <Text style={styles.stage} accessibilityLiveRegion="polite">{cancelling ? 'Cancelling…' : `${stages[progress.stage]}…`}</Text>
    <Pressable onPress={onCancel} disabled={cancelling} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel music analysis"><Text style={styles.stage}>Cancel</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#14131b', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 },
  brand: { color: '#cbc1db', fontSize: 14, letterSpacing: 3 }, title: { color: '#f4eef9', fontSize: 24 },
  track: { width: '100%', maxWidth: 320, height: 4, backgroundColor: '#37303f', overflow: 'hidden' }, fill: { height: 4, backgroundColor: '#b5a2c8' },
  stage: { color: '#cbc1db', fontSize: 14 }, cancel: { minHeight: 48, minWidth: 80, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
