import type { GroupAssignment, Test, TestNote, TestRound, TestStatus, RoundStatus } from '../types';
import { supabase } from '../lib/supabase';
import {
  createAssignment as createLocalAssignment,
  createNote as createLocalNote,
  createRound as createLocalRound,
  createTest as createLocalTest,
  deleteTest as deleteLocalTest,
  getAssignments as getLocalAssignments,
  getNotes as getLocalNotes,
  getRounds as getLocalRounds,
  getTests as getLocalTests,
  updateAssignment as updateLocalAssignment,
  updateRound as updateLocalRound,
  updateTest as updateLocalTest,
} from '../storage/localStorage';

type TestRow = {
  id: string; name: string; description: string; objective: string; hypothesis: string; product: string; responsible: string;
  status: TestStatus; created_at: string; updated_at: string; started_at: string | null; expected_end_at: string | null;
  resource_url: string; completed_at: string | null; final_result: string; learnings: string; next_steps: string;
};

type RoundRow = {
  id: string; test_id: string; name: string; objective: string; status: RoundStatus; started_at: string | null;
  completed_at: string | null; notes: string; result: string; learnings: string; next_steps: string; created_at: string; updated_at: string;
};

type AssignmentRow = {
  id: string; round_id: string; group_id: string; version: string; experience_name: string; started_at: string | null;
  completed_at: string | null; notes: string; result: string; created_at: string; updated_at: string;
};

type NoteRow = {
  id: string; test_id: string | null; round_id: string | null; group_assignment_id: string | null; content: string; created_at: string;
};

function fromTestRow(row: TestRow): Test {
  return {
    id: row.id, name: row.name, description: row.description, objective: row.objective, hypothesis: row.hypothesis,
    product: row.product, responsible: row.responsible, status: row.status, createdAt: row.created_at, startedAt: row.started_at ?? undefined,
    expectedEndAt: row.expected_end_at ?? undefined, resourceUrl: row.resource_url, completedAt: row.completed_at ?? undefined,
    finalResult: row.final_result, learnings: row.learnings, nextSteps: row.next_steps,
  };
}

function toTestRow(input: Partial<Test>) {
  return {
    ...(input.id !== undefined && { id: input.id }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.objective !== undefined && { objective: input.objective }),
    ...(input.hypothesis !== undefined && { hypothesis: input.hypothesis }),
    ...(input.product !== undefined && { product: input.product }),
    ...(input.responsible !== undefined && { responsible: input.responsible }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
    ...(input.startedAt !== undefined && { started_at: input.startedAt }),
    ...(input.expectedEndAt !== undefined && { expected_end_at: input.expectedEndAt }),
    ...(input.resourceUrl !== undefined && { resource_url: input.resourceUrl }),
    ...(input.completedAt !== undefined && { completed_at: input.completedAt }),
    ...(input.finalResult !== undefined && { final_result: input.finalResult }),
    ...(input.learnings !== undefined && { learnings: input.learnings }),
    ...(input.nextSteps !== undefined && { next_steps: input.nextSteps }),
  };
}

function fromRoundRow(row: RoundRow): TestRound {
  return {
    id: row.id, testId: row.test_id, name: row.name, objective: row.objective, status: row.status,
    startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined, notes: row.notes,
    result: row.result, learnings: row.learnings, nextSteps: row.next_steps,
  };
}

function toRoundRow(input: Partial<TestRound>) {
  return {
    ...(input.id !== undefined && { id: input.id }),
    ...(input.testId !== undefined && { test_id: input.testId }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.objective !== undefined && { objective: input.objective }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.startedAt !== undefined && { started_at: input.startedAt }),
    ...(input.completedAt !== undefined && { completed_at: input.completedAt }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.result !== undefined && { result: input.result }),
    ...(input.learnings !== undefined && { learnings: input.learnings }),
    ...(input.nextSteps !== undefined && { next_steps: input.nextSteps }),
  };
}

function fromAssignmentRow(row: AssignmentRow): GroupAssignment {
  return {
    id: row.id, roundId: row.round_id, groupId: row.group_id, variant: row.version,
    experienceName: row.experience_name, startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined, notes: row.notes, result: row.result,
  };
}

function toAssignmentRow(input: Partial<GroupAssignment>) {
  return {
    ...(input.id !== undefined && { id: input.id }),
    ...(input.roundId !== undefined && { round_id: input.roundId }),
    ...(input.groupId !== undefined && { group_id: input.groupId }),
    ...(input.variant !== undefined && { version: input.variant }),
    ...(input.experienceName !== undefined && { experience_name: input.experienceName }),
    ...(input.startedAt !== undefined && { started_at: input.startedAt }),
    ...(input.completedAt !== undefined && { completed_at: input.completedAt }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.result !== undefined && { result: input.result }),
  };
}

function fromNoteRow(row: NoteRow): TestNote {
  return {
    id: row.id, testId: row.test_id ?? undefined, roundId: row.round_id ?? undefined,
    groupAssignmentId: row.group_assignment_id ?? undefined, content: row.content, createdAt: row.created_at,
  };
}

export const testingService = {
  async getTests(): Promise<Test[]> {
    if (!supabase) return getLocalTests();
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as TestRow[]).map(fromTestRow);
  },

  async createTest(input: Partial<Test>): Promise<Test> {
    if (!supabase) return createLocalTest(input);
    const { data, error } = await supabase.from('tests').insert(toTestRow({ ...input, id: input.id ?? crypto.randomUUID() })).select('*').single();
    if (error) throw new Error(error.message);
    return fromTestRow(data as TestRow);
  },

  async updateTest(id: string, updates: Partial<Test>): Promise<Test | null> {
    if (!supabase) return updateLocalTest(id, updates);
    const { data, error } = await supabase.from('tests').update(toTestRow(updates)).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromTestRow(data as TestRow) : null;
  },

  async deleteTest(id: string): Promise<boolean> {
    if (!supabase) return deleteLocalTest(id);
    const { data, error } = await supabase.from('tests').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    return Boolean(data?.length);
  },

  async getRounds(): Promise<TestRound[]> {
    if (!supabase) return getLocalRounds();
    const { data, error } = await supabase.from('test_rounds').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as RoundRow[]).map(fromRoundRow);
  },

  async createRound(input: Partial<TestRound>): Promise<TestRound> {
    if (!supabase) return createLocalRound(input);
    const { data, error } = await supabase.from('test_rounds').insert(toRoundRow({ ...input, id: input.id ?? crypto.randomUUID() })).select('*').single();
    if (error) throw new Error(error.message);
    return fromRoundRow(data as RoundRow);
  },

  async updateRound(id: string, updates: Partial<TestRound>): Promise<TestRound | null> {
    if (!supabase) return updateLocalRound(id, updates);
    const { data, error } = await supabase.from('test_rounds').update(toRoundRow(updates)).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRoundRow(data as RoundRow) : null;
  },

  async getAssignments(): Promise<GroupAssignment[]> {
    if (!supabase) return getLocalAssignments();
    const { data, error } = await supabase.from('test_assignments').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as AssignmentRow[]).map(fromAssignmentRow);
  },

  async createAssignment(input: Partial<GroupAssignment>): Promise<GroupAssignment> {
    if (!supabase) return createLocalAssignment(input);
    const { data, error } = await supabase.from('test_assignments').insert(toAssignmentRow({ ...input, id: input.id ?? crypto.randomUUID() })).select('*').single();
    if (error) throw new Error(error.message);
    return fromAssignmentRow(data as AssignmentRow);
  },

  async updateAssignment(id: string, updates: Partial<GroupAssignment>): Promise<GroupAssignment | null> {
    if (!supabase) return updateLocalAssignment(id, updates);
    const { data, error } = await supabase.from('test_assignments').update(toAssignmentRow(updates)).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromAssignmentRow(data as AssignmentRow) : null;
  },

  async getNotes(): Promise<TestNote[]> {
    if (!supabase) return getLocalNotes();
    const { data, error } = await supabase.from('test_notes').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as NoteRow[]).map(fromNoteRow);
  },

  async createNote(input: Partial<TestNote>): Promise<TestNote> {
    if (!supabase) return createLocalNote(input);
    const { data, error } = await supabase.from('test_notes').insert({
      id: input.id ?? crypto.randomUUID(),
      test_id: input.testId ?? null,
      round_id: input.roundId ?? null,
      group_assignment_id: input.groupAssignmentId ?? null,
      content: input.content ?? '',
      created_at: input.createdAt ?? new Date().toISOString(),
    }).select('*').single();
    if (error) throw new Error(error.message);
    return fromNoteRow(data as NoteRow);
  },
};
