import * as DocumentPicker from 'expo-document-picker';

export type ImportedAudio = { uri: string; name: string; mimeType?: string };

export async function importAudio(): Promise<ImportedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*', 'application/ogg'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri || asset.size === 0) throw new Error('This file is empty or unavailable. Try another audio file.');
  return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType };
}
