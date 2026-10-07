import { Pressable, StyleSheet, Text } from 'react-native';

export function ImportButton({ onPress, disabled = false, label = 'Import Music' }: { onPress: () => void; disabled?: boolean; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dim]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, paddingHorizontal: 30, paddingVertical: 15, backgroundColor: '#f7f4ff', borderRadius: 28, alignItems: 'center' },
  label: { color: '#211c30', fontSize: 16, fontWeight: '600' },
  dim: { opacity: 0.6 },
});
