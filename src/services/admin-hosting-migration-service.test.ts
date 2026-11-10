import { describe, expect, it } from 'vitest';
import { createZipArchive } from './admin-hosting-migration-service';

describe('createZipArchive', () => {
  it('creates a valid ZIP structure with UTF-8 file names and CRC32', () => {
    const archive = createZipArchive([{ name: 'dados/Leia-me.txt', data: new TextEncoder().encode('hello') }]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(6, true)).toBe(0x0800);
    expect(view.getUint32(14, true)).toBe(0x3610a686);
    expect(new TextDecoder().decode(archive)).toContain('dados/Leia-me.txt');
    expect(view.getUint32(archive.byteLength - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(archive.byteLength - 12, true)).toBe(1);
  });

  it('rejects unsafe archive paths', () => {
    expect(() => createZipArchive([{ name: '../.env', data: new Uint8Array() }])).toThrow('Caminho inválido');
  });
});
