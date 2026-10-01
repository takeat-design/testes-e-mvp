import { seedInitialData } from '../data/seed';
import type { Customer, GroupAssignment, GroupMember, RecruitmentHistory, RecruitmentStatus, Test, TestNote, TestRound, WhatsAppGroup } from '../types';

const STORAGE_KEYS = {
  tests: 'takeat-tests-v1',
  groups: 'takeat-groups-v1',
  rounds: 'takeat-rounds-v1',
  assignments: 'takeat-assignments-v1',
  notes: 'takeat-notes-v1',
  customers: 'takeat-customers-v1',
  recruitmentHistory: 'takeat-recruitment-history-v1',
  groupMembers: 'takeat-group-members-v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizePhone(value?: string) {
  return (value ?? '').replace(/\D/g, '');
}

function formatPhone(value?: string) {
  const source = (value ?? '').trim();
  const digits = normalizePhone(source);
  if (!digits) return '';
  return source.startsWith('+') ? `+${digits}` : digits;
}

function getImportedCustomerPhone(customer: Customer) {
  const raw = customer.raw ?? {};
  return raw.whatsapp || raw.numero_whatsapp || raw.telefone || raw.celular || raw.phone || '';
}

function normalizeName(value?: string) {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ensureSeeded() {
  const hasTests = Boolean(localStorage.getItem(STORAGE_KEYS.tests));
  if (!hasTests) {
    const seed = seedInitialData();
    writeStorage(STORAGE_KEYS.tests, seed.tests);
    writeStorage(STORAGE_KEYS.groups, seed.groups);
    writeStorage(STORAGE_KEYS.rounds, seed.rounds);
    writeStorage(STORAGE_KEYS.assignments, seed.assignments);
    writeStorage(STORAGE_KEYS.notes, seed.notes);
  }

  if (!localStorage.getItem(STORAGE_KEYS.customers)) writeStorage(STORAGE_KEYS.customers, []);
  if (!localStorage.getItem(STORAGE_KEYS.recruitmentHistory)) writeStorage(STORAGE_KEYS.recruitmentHistory, []);
  if (!localStorage.getItem(STORAGE_KEYS.groupMembers)) writeStorage(STORAGE_KEYS.groupMembers, []);
}

export function getTests(): Test[] {
  ensureSeeded();
  return readStorage<Test[]>(STORAGE_KEYS.tests, []);
}

export function getTest(id: string): Test | null {
  return getTests().find((item) => item.id === id) ?? null;
}

export function saveTests(items: Test[]) {
  writeStorage(STORAGE_KEYS.tests, items);
}

export function deleteTest(id: string): boolean {
  const tests = getTests();
  const current = tests.some((item) => item.id === id);
  if (!current) return false;

  const rounds = getRounds();
  const roundIds = rounds.filter((item) => item.testId === id).map((item) => item.id);
  const assignments = getAssignments();
  const assignmentIds = assignments.filter((assignment) => roundIds.includes(assignment.roundId)).map((assignment) => assignment.id);
  const notes = getNotes();

  saveTests(tests.filter((item) => item.id !== id));
  saveRounds(rounds.filter((item) => item.testId !== id));
  saveAssignments(assignments.filter((assignment) => !roundIds.includes(assignment.roundId)));
  saveNotes(notes.filter((note) => {
    if (note.testId === id) return false;
    if (note.roundId && roundIds.includes(note.roundId)) return false;
    if (note.groupAssignmentId && assignmentIds.includes(note.groupAssignmentId)) return false;
    return true;
  }));

  return true;
}

export function createTest(input: Partial<Test>): Test {
  const item: Test = {
    id: crypto.randomUUID(),
    name: input.name ?? 'Novo teste',
    description: input.description ?? '',
    objective: input.objective ?? '',
    hypothesis: input.hypothesis ?? '',
    product: input.product ?? '',
    responsible: input.responsible ?? '',
    status: input.status ?? 'planned',
    createdAt: input.createdAt ?? new Date().toISOString(),
    startedAt: input.startedAt,
    expectedEndAt: input.expectedEndAt,
    resourceUrl: input.resourceUrl,
    completedAt: input.completedAt,
    finalResult: input.finalResult ?? '',
    learnings: input.learnings ?? '',
    nextSteps: input.nextSteps ?? '',
  };
  const next = [...getTests(), item];
  saveTests(next);
  return item;
}

export function updateTest(id: string, updates: Partial<Test>): Test | null {
  const next = getTests().map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveTests(next);
  return next.find((item) => item.id === id) ?? null;
}

export function getGroups(): WhatsAppGroup[] {
  ensureSeeded();
  return readStorage<WhatsAppGroup[]>(STORAGE_KEYS.groups, []);
}

export function getGroup(id: string): WhatsAppGroup | null {
  return getGroups().find((item) => item.id === id) ?? null;
}

export function saveGroups(items: WhatsAppGroup[]) {
  writeStorage(STORAGE_KEYS.groups, items);
}

export function createGroup(input: Partial<WhatsAppGroup>): WhatsAppGroup {
  const item: WhatsAppGroup = {
    id: crypto.randomUUID(),
    name: input.name ?? 'Novo grupo',
    description: input.description ?? '',
    segmentation: input.segmentation ?? '',
    whatsappLink: input.whatsappLink ?? '',
    memberCount: input.memberCount ?? 0,
    status: input.status ?? 'active',
    notes: input.notes ?? '',
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const next = [...getGroups(), item];
  saveGroups(next);
  return item;
}

export function updateGroup(id: string, updates: Partial<WhatsAppGroup>): WhatsAppGroup | null {
  const next = getGroups().map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveGroups(next);
  return next.find((item) => item.id === id) ?? null;
}

export function deleteGroup(id: string): boolean {
  const groups = getGroups();
  const current = groups.some((item) => item.id === id);
  if (!current) return false;

  const assignments = getAssignments();
  const assignmentIdsToRemove = assignments
    .filter((assignment) => assignment.groupId === id)
    .map((assignment) => assignment.id);

  saveGroups(groups.filter((item) => item.id !== id));
  saveAssignments(assignments.filter((assignment) => assignment.groupId !== id));
  saveGroupMembers(getGroupMembers().filter((member) => member.groupId !== id));

  if (assignmentIdsToRemove.length > 0) {
    const notes = getNotes();
    saveNotes(notes.filter((note) => !note.groupAssignmentId || !assignmentIdsToRemove.includes(note.groupAssignmentId)));
  }

  return true;
}

export function getRounds(): TestRound[] {
  ensureSeeded();
  return readStorage<TestRound[]>(STORAGE_KEYS.rounds, []);
}

export function getRound(id: string): TestRound | null {
  return getRounds().find((item) => item.id === id) ?? null;
}

export function saveRounds(items: TestRound[]) {
  writeStorage(STORAGE_KEYS.rounds, items);
}

export function createRound(input: Partial<TestRound>): TestRound {
  const item: TestRound = {
    id: crypto.randomUUID(),
    testId: input.testId ?? '',
    name: input.name ?? 'Nova rodada',
    objective: input.objective ?? '',
    status: input.status ?? 'planned',
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    notes: input.notes ?? '',
    result: input.result ?? '',
    learnings: input.learnings ?? '',
    nextSteps: input.nextSteps ?? '',
  };
  const next = [...getRounds(), item];
  saveRounds(next);
  return item;
}

export function updateRound(id: string, updates: Partial<TestRound>): TestRound | null {
  const next = getRounds().map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveRounds(next);
  return next.find((item) => item.id === id) ?? null;
}

export function getAssignments(): GroupAssignment[] {
  ensureSeeded();
  return readStorage<GroupAssignment[]>(STORAGE_KEYS.assignments, []);
}

export function getAssignment(id: string): GroupAssignment | null {
  return getAssignments().find((item) => item.id === id) ?? null;
}

export function saveAssignments(items: GroupAssignment[]) {
  writeStorage(STORAGE_KEYS.assignments, items);
}

export function createAssignment(input: Partial<GroupAssignment>): GroupAssignment {
  const item: GroupAssignment = {
    id: crypto.randomUUID(),
    roundId: input.roundId ?? '',
    groupId: input.groupId ?? '',
    variant: input.variant ?? '',
    experienceName: input.experienceName ?? '',
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    notes: input.notes ?? '',
    result: input.result ?? '',
  };
  const next = [...getAssignments(), item];
  saveAssignments(next);
  return item;
}

export function updateAssignment(id: string, updates: Partial<GroupAssignment>): GroupAssignment | null {
  const next = getAssignments().map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveAssignments(next);
  return next.find((item) => item.id === id) ?? null;
}

export function getNotes(): TestNote[] {
  ensureSeeded();
  return readStorage<TestNote[]>(STORAGE_KEYS.notes, []);
}

export function saveNotes(items: TestNote[]) {
  writeStorage(STORAGE_KEYS.notes, items);
}

export function createNote(input: Partial<TestNote>): TestNote {
  const item: TestNote = {
    id: crypto.randomUUID(),
    testId: input.testId,
    roundId: input.roundId,
    groupAssignmentId: input.groupAssignmentId,
    content: input.content ?? '',
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const next = [...getNotes(), item];
  saveNotes(next);
  return item;
}

export function getCustomers(): Customer[] {
  ensureSeeded();
  const customers = readStorage<Customer[]>(STORAGE_KEYS.customers, []);
  let changed = false;
  const migrated = customers.map((customer) => {
    const storedPhone = normalizePhone(customer.whatsapp);
    const importedPhone = getImportedCustomerPhone(customer);
    const originalPhone = normalizePhone(importedPhone);
    if (originalPhone.length <= storedPhone.length || !originalPhone.endsWith(storedPhone)) return customer;

    changed = true;
    return { ...customer, whatsapp: formatPhone(importedPhone) };
  });

  if (changed) saveCustomers(migrated);
  return migrated;
}

export function getCustomer(id: string): Customer | null {
  return getCustomers().find((item) => item.id === id) ?? null;
}

export function saveCustomers(items: Customer[]) {
  writeStorage(STORAGE_KEYS.customers, items);
}

export function createCustomer(input: Partial<Customer>): Customer {
  const item: Customer = {
    id: crypto.randomUUID(),
    name: input.name ?? 'Novo cliente',
    contactName: input.contactName ?? '',
    whatsapp: input.whatsapp ?? '',
    email: input.email ?? '',
    sourceLists: input.sourceLists ?? [],
    recruitmentStatus: input.recruitmentStatus ?? 'not_contacted',
    notes: input.notes ?? '',
    raw: input.raw ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  const next = [...getCustomers(), item];
  saveCustomers(next);
  return item;
}

export function updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
  const next = getCustomers().map((item) => (item.id === id ? { ...item, ...updates, updatedAt: updates.updatedAt ?? new Date().toISOString() } : item));
  saveCustomers(next);
  return next.find((item) => item.id === id) ?? null;
}

export function deleteCustomers(ids: string[]): number {
  const customerIds = new Set(ids);
  if (!customerIds.size) return 0;

  const customers = getCustomers();
  const remainingCustomers = customers.filter((customer) => !customerIds.has(customer.id));
  const deletedCount = customers.length - remainingCustomers.length;
  if (!deletedCount) return 0;

  saveCustomers(remainingCustomers);
  saveRecruitmentHistory(readStorage<RecruitmentHistory[]>(STORAGE_KEYS.recruitmentHistory, []).filter((item) => !customerIds.has(item.customerId)));
  saveGroupMembers(getGroupMembers().filter((member) => !customerIds.has(member.customerId)));
  return deletedCount;
}

export function updateCustomerStatus(id: string, nextStatus: RecruitmentStatus, note?: string): Customer | null {
  const customer = getCustomer(id);
  if (!customer) return null;
  const previousStatus = customer.recruitmentStatus;

  const updated = updateCustomer(id, {
    recruitmentStatus: nextStatus,
    updatedAt: new Date().toISOString(),
  });

  if (updated && previousStatus !== nextStatus) {
    createRecruitmentHistory({
      customerId: id,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      note,
      createdAt: new Date().toISOString(),
    });
  }

  return updated;
}

export function getRecruitmentHistory(customerId: string): RecruitmentHistory[] {
  ensureSeeded();
  return readStorage<RecruitmentHistory[]>(STORAGE_KEYS.recruitmentHistory, [])
    .filter((item) => item.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveRecruitmentHistory(items: RecruitmentHistory[]) {
  writeStorage(STORAGE_KEYS.recruitmentHistory, items);
}

export function createRecruitmentHistory(input: Partial<RecruitmentHistory>): RecruitmentHistory {
  const item: RecruitmentHistory = {
    id: crypto.randomUUID(),
    customerId: input.customerId ?? '',
    fromStatus: input.fromStatus,
    toStatus: input.toStatus ?? 'not_contacted',
    createdAt: input.createdAt ?? new Date().toISOString(),
    note: input.note ?? '',
  };
  const next = [...getRecruitmentHistory(item.customerId), item].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const history = readStorage<RecruitmentHistory[]>(STORAGE_KEYS.recruitmentHistory, []);
  saveRecruitmentHistory([...history.filter((entry) => entry.customerId !== item.customerId), ...next]);
  return item;
}

export function getGroupMembers(groupId?: string): GroupMember[] {
  ensureSeeded();
  const members = readStorage<GroupMember[]>(STORAGE_KEYS.groupMembers, []);
  return typeof groupId === 'string' ? members.filter((item) => item.groupId === groupId) : members;
}

export function saveGroupMembers(items: GroupMember[]) {
  writeStorage(STORAGE_KEYS.groupMembers, items);
}

export function addGroupMember(groupId: string, customerId: string): GroupMember | null {
  const members = getGroupMembers();
  const exists = members.some((member) => member.groupId === groupId && member.customerId === customerId);
  if (exists) return null;

  const item: GroupMember = {
    id: crypto.randomUUID(),
    groupId,
    customerId,
    addedAt: new Date().toISOString(),
  };

  saveGroupMembers([...members, item]);
  return item;
}

export function removeGroupMember(groupId: string, customerId: string): boolean {
  const members = getGroupMembers();
  const next = members.filter((member) => !(member.groupId === groupId && member.customerId === customerId));
  saveGroupMembers(next);
  return next.length !== members.length;
}

export function importCustomers(entries: Array<{ name: string; contactName?: string; whatsapp?: string; email?: string; sourceList: string; raw?: Record<string, string> }>) {
  const existing = getCustomers();
  const nextCustomers = [...existing];
  const possibleDuplicates: string[] = [];
  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    const name = (entry.name ?? '').trim();
    if (!name) continue;

    const whatsapp = normalizePhone(entry.whatsapp ?? '');
    const exactMatch = nextCustomers.find((customer) => {
      if (whatsapp && normalizePhone(customer.whatsapp ?? '')) return normalizePhone(customer.whatsapp ?? '') === whatsapp;
      return normalizeName(customer.name) === normalizeName(name) && !customer.whatsapp && !whatsapp;
    });

    if (exactMatch) {
      const sourceLists = new Set(exactMatch.sourceLists ?? []);
      sourceLists.add(entry.sourceList);
      const normalized = {
        ...exactMatch,
        contactName: entry.contactName?.trim() || exactMatch.contactName || '',
        email: entry.email?.trim() || exactMatch.email || '',
        whatsapp: formatPhone(entry.whatsapp) || exactMatch.whatsapp,
        sourceLists: [...sourceLists],
        updatedAt: new Date().toISOString(),
        raw: { ...(exactMatch.raw ?? {}), ...((entry.raw ?? {}) as Record<string, string>) },
      };
      const index = nextCustomers.findIndex((customer) => customer.id === exactMatch.id);
      nextCustomers[index] = normalized;
      updated += 1;
      continue;
    }

    const nameMatch = nextCustomers.find((customer) => normalizeName(customer.name) === normalizeName(name) && !whatsapp);
    if (nameMatch) {
      possibleDuplicates.push(name);
      continue;
    }

    const item: Customer = {
      id: crypto.randomUUID(),
      name,
      contactName: entry.contactName || '',
      whatsapp: formatPhone(entry.whatsapp) || undefined,
      email: entry.email || '',
      sourceLists: [entry.sourceList],
      recruitmentStatus: 'not_contacted',
      raw: entry.raw ?? {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    nextCustomers.push(item);
    created += 1;
  }

  saveCustomers(nextCustomers);
  return { created, updated, possibleDuplicates: possibleDuplicates.length };
}
