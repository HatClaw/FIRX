import { requirePlatformAdmin } from '@/services/admin-resource-service';
import type { SystemBackup } from '@/services/admin-system-backup-service';

const MANIFEST_FORMAT = 'growmoney-cpanel-migration';
const MAX_PACKAGE_BYTES = 180 * 1024 * 1024;
const MAX_FILES = 1_000;

type MigrationManifest = {
  format: typeof MANIFEST_FORMAT;
  version: 1;
  base: string;
  files: string[];
  extraFiles: Array<{ name: string; base64: string }>;
};

type ZipEntry = { name: string; data: Uint8Array };

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isSafeArchivePath(path: string) {
  return path.length > 0 && !path.startsWith('/') && !path.includes('\\') &&
    path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..') &&
    !/(^|\/)\.env(?:\.|$)/i.test(path);
}

/** Creates a ZIP archive using the standard store method, without an extra runtime dependency. */
export function createZipArchive(entries: ZipEntry[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    if (!isSafeArchivePath(entry.name)) throw new Error(`Caminho inválido no pacote: ${entry.name}`);
    const fileName = encoder.encode(entry.name);
    const data = entry.data;
    if (fileName.length > 0xffff || data.byteLength > 0xffffffff) throw new Error('Um arquivo excede o limite suportado pelo formato ZIP.');
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + fileName.length);
    const localView = new DataView(localHeader.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 6, 0x0800);
    u16(localView, 8, 0);
    u32(localView, 14, checksum);
    u32(localView, 18, data.byteLength);
    u32(localView, 22, data.byteLength);
    u16(localView, 26, fileName.length);
    localHeader.set(fileName, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u16(centralView, 8, 0x0800);
    u16(centralView, 10, 0);
    u32(centralView, 16, checksum);
    u32(centralView, 20, data.byteLength);
    u32(centralView, 24, data.byteLength);
    u16(centralView, 28, fileName.length);
    u32(centralView, 42, localOffset);
    centralHeader.set(fileName, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.byteLength + data.byteLength;
  }

  if (entries.length > 0xffff || localOffset > 0xffffffff) throw new Error('O pacote excede os limites do formato ZIP.');
  const centralDirectory = new Uint8Array(centralParts.reduce((sum, part) => sum + part.byteLength, 0));
  let centralOffset = 0;
  for (const part of centralParts) { centralDirectory.set(part, centralOffset); centralOffset += part.byteLength; }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, entries.length);
  u16(endView, 10, entries.length);
  u32(endView, 12, centralDirectory.byteLength);
  u32(endView, 16, localOffset);

  const archive = new Uint8Array(localOffset + centralDirectory.byteLength + end.byteLength);
  let offset = 0;
  for (const part of [...localParts, centralDirectory, end]) { archive.set(part, offset); offset += part.byteLength; }
  return archive;
}

function parseManifest(value: unknown): MigrationManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifesto do pacote não encontrado. Gere e publique uma nova build antes de exportar.');
  const manifest = value as Partial<MigrationManifest>;
  if (manifest.format !== MANIFEST_FORMAT || manifest.version !== 1 || typeof manifest.base !== 'string' ||
    !Array.isArray(manifest.files) || !Array.isArray(manifest.extraFiles)) {
    throw new Error('Manifesto do pacote inválido. Gere e publique uma nova build antes de exportar.');
  }
  if (manifest.files.length + manifest.extraFiles.length > MAX_FILES) throw new Error('A build excede o limite de arquivos do pacote.');
  return manifest as MigrationManifest;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function migrationInstructions(base: string, backupCreatedAt: string) {
  const normalizedBase = `/${base.split('/').filter(Boolean).join('/')}${base.split('/').filter(Boolean).length ? '/' : ''}`;
  const targetPath = normalizedBase === '/' ? 'public_html' : `public_html/${normalizedBase.slice(1, -1)}`;
  return `GROWMONEY — PACOTE DE MIGRAÇÃO PARA CPANEL\n\n` +
    `Pacote gerado em: ${new Date().toLocaleString('pt-BR')}\n` +
    `Base usada nesta build: ${base}\n` +
    `Backup operacional gerado em: ${backupCreatedAt}\n\n` +
    `INSTALAÇÃO DA APLICAÇÃO\n` +
    `1. Extraia o ZIP no computador.\n` +
    `2. No cPanel do novo servidor, abra o Gerenciador de Arquivos e envie o conteúdo da pasta para ${targetPath}.\n` +
    `3. Mantenha o caminho ${normalizedBase}, pois esta build foi compilada para essa localização. Para usar outro caminho, gere uma build com VITE_BASE configurado para ele.\n` +
    `4. Ative SSL/HTTPS para o domínio no cPanel e teste login, rotas, arquivos e PWA.\n` +
    `5. O Apache precisa permitir mod_rewrite para as rotas internas; o .htaccess incluído configura o fallback da SPA.\n\n` +
    `SERVIÇOS E DADOS\n` +
    `Esta transferência leva a aplicação web estática para o cPanel. Autenticação, banco, arquivos armazenados e funções continuam no projeto Supabase atualmente configurado na build. Não exclua nem encerre esse projeto.\n` +
    `No Supabase, adicione o novo domínio HTTPS à lista de Redirect URLs e atualize Site URL. Atualize também APP_ORIGIN da função smtp-mailer para a nova origem da aplicação.\n` +
    `O arquivo dados/growmoney-backup-operacional.json contém somente os datasets permitidos para backup. Ele não contém usuários/autenticação, permissões, auditoria, segredos SMTP, envelopes e tokens privados de assinatura, nem arquivos binários do Storage.\n` +
    `O backup serve para restauração compatível pelo painel administrativo. Uma migração para outro projeto Supabase requer configurar o novo backend, aplicar migrations, recriar autenticação/permissões, copiar arquivos do Storage e planejar a restauração dos dados.\n\n` +
    `SMTP DA HOSPEDAGEM\n` +
    `A pasta api inclui smtp.php e a proteção .htaccess. Por segurança, o arquivo smtp-config.php não é incluído. Se for usar a ponte SMTP neste cPanel, crie public_html/grow/api/smtp-config.php com uma chave aleatória de pelo menos 32 caracteres, proteja-a e configure a mesma chave no segredo SMTP_HOSTING_API_KEY da função smtp-mailer no Supabase.\n` +
    `Configure SMTP_HOSTING_API_URL como https://SEU-DOMINIO/grow/api/smtp.php e mantenha SMTP_ENCRYPTION_KEY atual no Supabase para preservar a leitura da senha SMTP armazenada. Não publique nem compartilhe essas chaves.\n\n` +
    `CONTEÚDO\n` +
    `- Aplicação compilada e arquivos públicos atuais\n` +
    `- Regras .htaccess para subpasta /grow e proteção de configuração SMTP\n` +
    `- Ponte PHP SMTP sem chaves privadas\n` +
    `- Backup operacional JSON com exclusões descritas acima\n`;
}

export const AdminHostingMigrationService = {
  async createCpanelPackage(backup: SystemBackup, onProgress?: (message: string) => void) {
    await requirePlatformAdmin();
    onProgress?.('Lendo arquivos da build publicada…');
    const manifestUrl = new URL('migration-manifest.json', new URL(import.meta.env.BASE_URL, window.location.origin));
    const manifestResponse = await fetch(manifestUrl, { cache: 'no-store', credentials: 'same-origin' });
    if (!manifestResponse.ok) throw new Error('O manifesto de migração não foi encontrado nesta publicação. Gere e publique uma nova build antes de exportar.');
    const manifest = parseManifest(await manifestResponse.json());
    const baseUrl = new URL(manifest.base, window.location.origin);
    const excludedPaths = new Set(['.htaccess', 'api/.htaccess', 'api/smtp.php']);
    const entries: ZipEntry[] = [];
    let totalBytes = 0;

    for (let index = 0; index < manifest.files.length; index += 1) {
      const fileName = manifest.files[index];
      if (!isSafeArchivePath(fileName) || excludedPaths.has(fileName)) throw new Error(`Arquivo inválido no manifesto: ${fileName}`);
      const fileUrl = new URL(fileName.split('/').map(encodeURIComponent).join('/'), baseUrl);
      if (fileUrl.origin !== window.location.origin) throw new Error('O manifesto aponta para um domínio externo; exportação cancelada por segurança.');
      const response = await fetch(fileUrl, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Falha ao obter ${fileName} da build publicada.`);
      const data = new Uint8Array(await response.arrayBuffer());
      totalBytes += data.byteLength;
      if (totalBytes > MAX_PACKAGE_BYTES) throw new Error('O pacote excede o limite seguro de 180 MB.');
      entries.push({ name: fileName, data });
      onProgress?.(`Preparando arquivos ${index + 1} de ${manifest.files.length}…`);
    }

    for (const extra of manifest.extraFiles) {
      if (!isSafeArchivePath(extra.name) || !/^[A-Za-z0-9+/]*={0,2}$/.test(extra.base64)) throw new Error('Arquivo auxiliar inválido no manifesto.');
      const data = base64ToBytes(extra.base64);
      totalBytes += data.byteLength;
      if (totalBytes > MAX_PACKAGE_BYTES) throw new Error('O pacote excede o limite seguro de 180 MB.');
      entries.push({ name: extra.name, data });
    }

    const encoder = new TextEncoder();
    const backupText = JSON.stringify(backup, null, 2);
    const date = backup.createdAt.slice(0, 10);
    entries.push(
      { name: 'README-MIGRACAO-CPANEL.txt', data: encoder.encode(migrationInstructions(manifest.base, backup.createdAt)) },
      { name: `dados/growmoney-backup-operacional-${date}.json`, data: encoder.encode(backupText) },
    );
    totalBytes += entries.slice(-2).reduce((sum, entry) => sum + entry.data.byteLength, 0);
    if (totalBytes > MAX_PACKAGE_BYTES) throw new Error('O pacote excede o limite seguro de 180 MB.');

    onProgress?.('Compactando o pacote de hospedagem…');
    const archive = createZipArchive(entries);
    return { blob: new Blob([archive], { type: 'application/zip' }), createdAt: backup.createdAt, fileCount: entries.length };
  },
};
