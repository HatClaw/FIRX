import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view, offset, value) { view.setUint16(offset, value, true); }
function u32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

async function getFiles(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...await getFiles(full, rel));
    } else {
      result.push({ name: rel, path: full });
    }
  }
  return result;
}

const distDir = path.resolve('dist');
const fileList = await getFiles(distDir);
const encoder = new TextEncoder();
const localParts = [];
const centralParts = [];
let localOffset = 0;

for (const f of fileList) {
  const data = await readFile(f.path);
  const nameBytes = encoder.encode(f.name);
  const checksum = crc32(data);

  const localHeader = new Uint8Array(30 + nameBytes.length);
  const localView = new DataView(localHeader.buffer);
  u32(localView, 0, 0x04034b50);
  u16(localView, 4, 20);
  u16(localView, 6, 0x0800);
  u16(localView, 8, 0);
  u32(localView, 14, checksum);
  u32(localView, 18, data.byteLength);
  u32(localView, 22, data.byteLength);
  u16(localView, 26, nameBytes.length);
  localHeader.set(nameBytes, 30);
  localParts.push(localHeader, data);

  const centralHeader = new Uint8Array(46 + nameBytes.length);
  const centralView = new DataView(centralHeader.buffer);
  u32(centralView, 0, 0x02014b50);
  u16(centralView, 4, 20);
  u16(centralView, 6, 20);
  u16(centralView, 8, 0x0800);
  u16(centralView, 10, 0);
  u32(centralView, 16, checksum);
  u32(centralView, 20, data.byteLength);
  u32(centralView, 24, data.byteLength);
  u16(centralView, 28, nameBytes.length);
  u32(centralView, 42, localOffset);
  centralHeader.set(nameBytes, 46);
  centralParts.push(centralHeader);
  localOffset += localHeader.byteLength + data.byteLength;
}

const centralDirectory = new Uint8Array(centralParts.reduce((sum, p) => sum + p.byteLength, 0));
let centralOffset = 0;
for (const p of centralParts) { centralDirectory.set(p, centralOffset); centralOffset += p.byteLength; }

const end = new Uint8Array(22);
const endView = new DataView(end.buffer);
u32(endView, 0, 0x06054b50);
u16(endView, 8, fileList.length);
u16(endView, 10, fileList.length);
u32(endView, 12, centralDirectory.byteLength);
u32(endView, 16, localOffset);

const archive = new Uint8Array(localOffset + centralDirectory.byteLength + end.byteLength);
let offset = 0;
for (const part of [...localParts, centralDirectory, end]) { archive.set(part, offset); offset += part.byteLength; }

await writeFile('firx-app-agenciaafrica.zip', archive);
console.log(`Generated firx-app-agenciaafrica.zip (${archive.byteLength} bytes, ${fileList.length} files).`);
