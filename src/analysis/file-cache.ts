import { Directory, File, Paths } from 'expo-file-system';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { JSONStore } from './analysis-cache';

export class FileJSONStore implements JSONStore {
  private readonly directory = new Directory(Paths.document, 'music-analysis-v3');
  private sequence = 0;
  private file(key: string) { return new File(this.directory, `${bytesToHex(sha256(utf8ToBytes(key)))}.json`); }
  async read(key: string): Promise<string | null> {
    const file = this.file(key);
    return file.exists && file.size <= 24 * 1024 * 1024 ? await file.text() : null;
  }
  async write(key: string, value: string): Promise<void> {
    this.directory.create({ idempotent: true, intermediates: true });
    const file = this.file(key);
    const temporary = new File(this.directory, `${file.name}.${Date.now()}-${this.sequence++}.tmp`);
    try {
      temporary.create(); temporary.write(value);
      await temporary.move(file, { overwrite: true });
    } finally { if (temporary.exists && temporary.uri !== file.uri) temporary.delete(); }
  }
}
