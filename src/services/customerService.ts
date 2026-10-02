import type { Customer, RecruitmentStatus } from '../types';
import { supabase } from '../lib/supabase';
import {
  createCustomer as createLocalCustomer,
  deleteCustomers as deleteLocalCustomers,
  getCustomer as getLocalCustomer,
  getCustomers as getLocalCustomers,
  importCustomers as importLocalCustomers,
  updateCustomer as updateLocalCustomer,
  updateCustomerStatus as updateLocalCustomerStatus,
} from '../storage/localStorage';

type CustomerRow = {
  id: string;
  name: string;
  contact_name: string;
  whatsapp: string | null;
  email: string;
  source_lists: string[];
  recruitment_status: RecruitmentStatus;
  notes: string;
  raw: Record<string, string>;
  created_at: string;
  updated_at: string;
};

function fromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    whatsapp: row.whatsapp ?? undefined,
    email: row.email,
    sourceLists: row.source_lists ?? [],
    recruitmentStatus: row.recruitment_status,
    notes: row.notes,
    raw: row.raw ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: Partial<Customer>) {
  return {
    ...(input.id !== undefined && { id: input.id }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.contactName !== undefined && { contact_name: input.contactName }),
    ...(input.whatsapp !== undefined && { whatsapp: input.whatsapp || null }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.sourceLists !== undefined && { source_lists: input.sourceLists }),
    ...(input.recruitmentStatus !== undefined && { recruitment_status: input.recruitmentStatus }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.raw !== undefined && { raw: input.raw }),
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
    ...(input.updatedAt !== undefined && { updated_at: input.updatedAt }),
  };
}

function normalizePhone(value?: string) {
  return (value ?? '').replace(/\D/g, '');
}

function normalizeName(value?: string) {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const customerService = {
  async getAll(): Promise<Customer[]> {
    if (!supabase) return getLocalCustomers();
    const { data, error } = await supabase.from('customers').select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as CustomerRow[]).map(fromRow);
  },

  async getById(id: string): Promise<Customer | null> {
    if (!supabase) return getLocalCustomer(id);
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as CustomerRow) : null;
  },

  async create(input: Partial<Customer>): Promise<Customer> {
    if (!supabase) return createLocalCustomer(input);
    const item = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name ?? 'Novo cliente',
      contactName: input.contactName ?? '',
      whatsapp: input.whatsapp,
      email: input.email ?? '',
      sourceLists: input.sourceLists ?? [],
      recruitmentStatus: input.recruitmentStatus ?? 'not_contacted',
      notes: input.notes ?? '',
      raw: input.raw ?? {},
      createdAt: input.createdAt ?? new Date().toISOString(),
      updatedAt: input.updatedAt ?? new Date().toISOString(),
    } satisfies Customer;
    const { data, error } = await supabase.from('customers').insert(toRow(item)).select('*').single();
    if (error) throw new Error(error.message);
    return fromRow(data as CustomerRow);
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    if (!supabase) return updateLocalCustomer(id, updates);
    const { data, error } = await supabase.from('customers').update(toRow({ ...updates, updatedAt: new Date().toISOString() })).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as CustomerRow) : null;
  },

  async deleteMany(ids: string[]): Promise<number> {
    if (!supabase) return deleteLocalCustomers(ids);
    if (!ids.length) return 0;
    const { data, error } = await supabase.from('customers').delete().in('id', ids).select('id');
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  },

  async updateStatus(id: string, nextStatus: RecruitmentStatus, note?: string): Promise<Customer | null> {
    if (!supabase) return updateLocalCustomerStatus(id, nextStatus, note);
    const customer = await this.getById(id);
    if (!customer) return null;
    const { data, error } = await supabase.rpc('update_customer_recruitment_status', {
      p_customer_id: id,
      p_next_status: nextStatus,
      p_note: note ?? '',
    });
    if (error) throw new Error(error.message);
    return data ? fromRow(data as CustomerRow) : null;
  },

  async importMany(entries: Array<{ name: string; contactName?: string; whatsapp?: string; email?: string; sourceList: string; raw?: Record<string, string> }>) {
    if (!supabase) return importLocalCustomers(entries);
    const existing = await this.getAll();
    const possibleDuplicates: string[] = [];
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const name = entry.name.trim();
      if (!name) continue;
      const phone = normalizePhone(entry.whatsapp);
      const match = existing.find((customer) => {
        const customerPhone = normalizePhone(customer.whatsapp);
        if (phone && customerPhone) return phone === customerPhone;
        return normalizeName(customer.name) === normalizeName(name) && !customer.whatsapp && !phone;
      });

      if (match) {
        const updatedCustomer = await this.update(match.id, {
          contactName: entry.contactName?.trim() || match.contactName || '',
          email: entry.email?.trim() || match.email || '',
          whatsapp: entry.whatsapp || match.whatsapp,
          sourceLists: [...new Set([...match.sourceLists, entry.sourceList])],
          raw: { ...(match.raw ?? {}), ...(entry.raw ?? {}) },
        });
        if (updatedCustomer) {
          const existingIndex = existing.findIndex((customer) => customer.id === updatedCustomer.id);
          existing[existingIndex] = updatedCustomer;
        }
        updated += 1;
        continue;
      }

      const possibleNameMatch = existing.some((customer) => normalizeName(customer.name) === normalizeName(name) && !phone);
      if (possibleNameMatch) {
        possibleDuplicates.push(name);
        continue;
      }

      const item = await this.create({ ...entry, name, recruitmentStatus: 'not_contacted' });
      existing.push(item);
      created += 1;
    }

    return { created, updated, possibleDuplicates: possibleDuplicates.length };
  },
};
