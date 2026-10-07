import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { Alert, Linking, Platform } from 'react-native';

export async function ensureSamplingPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const existing = await getRecordingPermissionsAsync();
  if (existing.granted) return true;
  const proceed = await new Promise<boolean>((resolve) => {
    Alert.alert('Audio permission for music colors',
      'Android requires audio permission for the playback-sampling API used to analyze the music playing inside this app. Music in Color processes the audio locally and does not upload it.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: existing.canAskAgain ? 'Continue' : 'Open Settings', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) });
  });
  if (!proceed) return false;
  if (!existing.canAskAgain) { await Linking.openSettings(); return false; }
  return (await requestRecordingPermissionsAsync()).granted;
}
