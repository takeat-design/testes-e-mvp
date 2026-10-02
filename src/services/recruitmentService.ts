import type { RecruitmentHistory, RecruitmentStatus } from '../types';
import { supabase } from '../lib/supabase';
import { createRecruitmentHistory, getCustomers, getRecruitmentHistory } from '../storage/localStorage';

type RecruitmentHistoryRow = {
  id: string;
  customer_id: string;
  from_status: RecruitmentStatus | null;
  to_status: RecruitmentStatus;
  note: string;
  created_at: string;
};

function fromRow(row: RecruitmentHistoryRow): RecruitmentHistory {
  return {
    id: row.id,
    customerId: row.customer_id,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status,
    note: row.note,
    createdAt: row.created_at,
  };
}

export const recruitmentService = {
  async getAll(): Promise<RecruitmentHistory[]> {
    if (!supabase) return getCustomers().flatMap((customer) => getRecruitmentHistory(customer.id));
    const { data, error } = await supabase.from('recruitment_history').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as RecruitmentHistoryRow[]).map(fromRow);
  },

  async create(input: Partial<RecruitmentHistory>): Promise<RecruitmentHistory> {
    if (!supabase) return createRecruitmentHistory(input);
    const { data, error } = await supabase.from('recruitment_history').insert({
      id: input.id ?? crypto.randomUUID(),
      customer_id: input.customerId ?? '',
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? 'not_contacted',
      note: input.note ?? '',
      created_at: input.createdAt ?? new Date().toISOString(),
    }).select('*').single();
    if (error) throw new Error(error.message);
    return fromRow(data as RecruitmentHistoryRow);
  },
};
