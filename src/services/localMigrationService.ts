import { supabase } from '../lib/supabase';
import { getLegacyLocalDataSnapshot } from '../storage/localStorage';

const remoteTables = ['customers', 'recruitment_history', 'groups', 'group_members', 'tests', 'test_rounds', 'test_assignments', 'test_notes'] as const;
const migrationMarkerKey = 'takeat-supabase-migration-v1';
const migrationStartedKey = 'takeat-supabase-migration-started-v1';

export type LocalMigrationOverview = {
  localCounts: Record<(typeof remoteTables)[number], number>;
  localTotal: number;
  remoteCounts: Record<(typeof remoteTables)[number], number>;
  remoteTotal: number;
  alreadyMigrated: boolean;
  canResume: boolean;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

export async function inspectLocalMigration(): Promise<LocalMigrationOverview> {
  const legacy = getLegacyLocalDataSnapshot();
  const localCounts = {
    customers: legacy.customers.length,
    recruitment_history: legacy.recruitmentHistory.length,
    groups: legacy.groups.length,
    group_members: legacy.groupMembers.length,
    tests: legacy.tests.length,
    test_rounds: legacy.rounds.length,
    test_assignments: legacy.assignments.length,
    test_notes: legacy.notes.length,
  };
  const client = requireClient();
  const remoteResults = await Promise.all(remoteTables.map(async (table) => {
    const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return [table, count ?? 0] as const;
  }));
  const remoteCounts = Object.fromEntries(remoteResults) as Record<(typeof remoteTables)[number], number>;

  return {
    localCounts,
    localTotal: Object.values(localCounts).reduce((total, count) => total + count, 0),
    remoteCounts,
    remoteTotal: Object.values(remoteCounts).reduce((total, count) => total + count, 0),
    alreadyMigrated: localStorage.getItem(migrationMarkerKey) !== null,
    canResume: localStorage.getItem(migrationStartedKey) !== null,
  };
}

export async function migrateLocalDataToSupabase(): Promise<LocalMigrationOverview> {
  const overview = await inspectLocalMigration();
  if (overview.alreadyMigrated) throw new Error('Este navegador já marcou a migração local como concluída.');
  if (overview.localTotal === 0) throw new Error('Não há dados legados neste navegador para migrar.');
  if (overview.remoteTotal > 0 && !overview.canResume) throw new Error('O Supabase já contém dados. A migração automática foi bloqueada para evitar mesclagem ou duplicação silenciosa.');

  const client = requireClient();
  const legacy = getLegacyLocalDataSnapshot();
  localStorage.setItem(migrationStartedKey, new Date().toISOString());

  async function upsert(table: (typeof remoteTables)[number], rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Falha ao migrar ${table}: ${error.message}`);
  }

  await upsert('customers', legacy.customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    contact_name: customer.contactName ?? '',
    whatsapp: customer.whatsapp ?? null,
    email: customer.email ?? '',
    source_lists: customer.sourceLists ?? [],
    recruitment_status: customer.recruitmentStatus,
    notes: customer.notes ?? '',
    raw: customer.raw ?? {},
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  })));

  await upsert('groups', legacy.groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description ?? '',
    segmentation: group.segmentation ?? '',
    whatsapp_link: group.whatsappLink ?? '',
    status: group.status,
    notes: group.notes ?? '',
    created_at: group.createdAt,
  })));

  await upsert('tests', legacy.tests.map((test) => ({
    id: test.id,
    name: test.name,
    description: test.description ?? '',
    objective: test.objective ?? '',
    hypothesis: test.hypothesis ?? '',
    product: test.product ?? '',
    responsible: test.responsible ?? '',
    status: test.status,
    created_at: test.createdAt,
    started_at: test.startedAt ?? null,
    expected_end_at: test.expectedEndAt ?? null,
    resource_url: test.resourceUrl ?? '',
    completed_at: test.completedAt ?? null,
    final_result: test.finalResult ?? '',
    learnings: test.learnings ?? '',
    next_steps: test.nextSteps ?? '',
  })));

  await upsert('test_rounds', legacy.rounds.map((round) => ({
    id: round.id,
    test_id: round.testId,
    name: round.name,
    objective: round.objective ?? '',
    status: round.status,
    started_at: round.startedAt ?? null,
    completed_at: round.completedAt ?? null,
    notes: round.notes ?? '',
    result: round.result ?? '',
    learnings: round.learnings ?? '',
    next_steps: round.nextSteps ?? '',
  })));

  await upsert('test_assignments', legacy.assignments.map((assignment) => ({
    id: assignment.id,
    round_id: assignment.roundId,
    group_id: assignment.groupId,
    version: assignment.variant ?? '',
    experience_name: assignment.experienceName ?? '',
    started_at: assignment.startedAt ?? null,
    completed_at: assignment.completedAt ?? null,
    notes: assignment.notes ?? '',
    result: assignment.result ?? '',
  })));

  await upsert('group_members', legacy.groupMembers.map((member) => ({
    id: member.id,
    group_id: member.groupId,
    customer_id: member.customerId,
    added_at: member.addedAt,
  })));

  await upsert('recruitment_history', legacy.recruitmentHistory.map((history) => ({
    id: history.id,
    customer_id: history.customerId,
    from_status: history.fromStatus ?? null,
    to_status: history.toStatus,
    note: history.note ?? '',
    created_at: history.createdAt,
  })));

  await upsert('test_notes', legacy.notes.map((note) => ({
    id: note.id,
    test_id: note.testId ?? null,
    round_id: note.roundId ?? null,
    group_assignment_id: note.groupAssignmentId ?? null,
    content: note.content,
    created_at: note.createdAt,
  })));

  localStorage.setItem(migrationMarkerKey, new Date().toISOString());
  localStorage.removeItem(migrationStartedKey);
  return inspectLocalMigration();
}
