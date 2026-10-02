import type { LegacyLocalDataSnapshot } from '../storage/localStorage';
import { replaceLegacyLocalDataSnapshot } from '../storage/localStorage';

export type AppBackup = {
  format: 'testes-e-mvp-backup';
  version: 1;
  exportedAt: string;
  data: LegacyLocalDataSnapshot;
};

const requiredCollections = [
  'tests',
  'groups',
  'rounds',
  'assignments',
  'notes',
  'customers',
  'recruitmentHistory',
  'groupMembers',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function downloadBackup(data: LegacyLocalDataSnapshot) {
  const backup: AppBackup = {
    format: 'testes-e-mvp-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `testes-e-mvp-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readBackupFile(file: File): Promise<AppBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo selecionado não contém um JSON válido.');
  }

  if (!isRecord(parsed) || parsed.format !== 'testes-e-mvp-backup' || parsed.version !== 1) {
    throw new Error('O arquivo não é um backup compatível do Testes e MVP.');
  }
  const backupData = parsed.data;
  if (!isRecord(backupData)) throw new Error('O arquivo não contém os dados do backup.');

  const validCollections = requiredCollections.every((collection) => {
    const items: unknown = backupData[collection];
    return Array.isArray(items) && items.every(isRecord);
  });
  if (!validCollections) throw new Error('O backup está incompleto ou contém listas inválidas.');

  return parsed as unknown as AppBackup;
}

export function restoreLocalBackup(backup: AppBackup) {
  replaceLegacyLocalDataSnapshot(backup.data);
}
