import type { GroupMember, GroupStatus, WhatsAppGroup } from '../types';
import { supabase } from '../lib/supabase';
import {
  addGroupMember as addLocalGroupMember,
  createGroup as createLocalGroup,
  deleteGroup as deleteLocalGroup,
  getGroupMembers as getLocalGroupMembers,
  getGroups as getLocalGroups,
  removeGroupMember as removeLocalGroupMember,
  updateGroup as updateLocalGroup,
} from '../storage/localStorage';

type GroupRow = {
  id: string;
  name: string;
  description: string;
  segmentation: string;
  whatsapp_link: string;
  status: GroupStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

type GroupMemberRow = {
  id: string;
  group_id: string;
  customer_id: string;
  added_at: string;
};

function fromGroupRow(row: GroupRow): WhatsAppGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    segmentation: row.segmentation,
    whatsappLink: row.whatsapp_link,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function toGroupRow(input: Partial<WhatsAppGroup>) {
  return {
    ...(input.id !== undefined && { id: input.id }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.segmentation !== undefined && { segmentation: input.segmentation }),
    ...(input.whatsappLink !== undefined && { whatsapp_link: input.whatsappLink }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.createdAt !== undefined && { created_at: input.createdAt }),
  };
}

function fromMemberRow(row: GroupMemberRow): GroupMember {
  return { id: row.id, groupId: row.group_id, customerId: row.customer_id, addedAt: row.added_at };
}

export const groupService = {
  async getAll(): Promise<WhatsAppGroup[]> {
    if (!supabase) return getLocalGroups();
    const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as GroupRow[]).map(fromGroupRow);
  },

  async create(input: Partial<WhatsAppGroup>): Promise<WhatsAppGroup> {
    if (!supabase) return createLocalGroup(input);
    const { data, error } = await supabase.from('groups').insert(toGroupRow({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      name: input.name ?? 'Novo grupo',
      status: input.status ?? 'active',
      createdAt: input.createdAt ?? new Date().toISOString(),
    })).select('*').single();
    if (error) throw new Error(error.message);
    return fromGroupRow(data as GroupRow);
  },

  async update(id: string, updates: Partial<WhatsAppGroup>): Promise<WhatsAppGroup | null> {
    if (!supabase) return updateLocalGroup(id, updates);
    const { data, error } = await supabase.from('groups').update(toGroupRow(updates)).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromGroupRow(data as GroupRow) : null;
  },

  async delete(id: string): Promise<boolean> {
    if (!supabase) return deleteLocalGroup(id);
    const { data, error } = await supabase.from('groups').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    return Boolean(data?.length);
  },

  async getMembers(groupId?: string): Promise<GroupMember[]> {
    if (!supabase) return getLocalGroupMembers(groupId);
    let query = supabase.from('group_members').select('*').order('added_at', { ascending: true });
    if (groupId) query = query.eq('group_id', groupId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as GroupMemberRow[]).map(fromMemberRow);
  },

  async addMember(groupId: string, customerId: string): Promise<GroupMember | null> {
    if (!supabase) return addLocalGroupMember(groupId, customerId);
    const { data, error } = await supabase.from('group_members').insert({
      id: crypto.randomUUID(),
      group_id: groupId,
      customer_id: customerId,
    }).select('*').single();
    if (error) {
      if (error.code === '23505') return null;
      throw new Error(error.message);
    }
    return fromMemberRow(data as GroupMemberRow);
  },

  async removeMember(groupId: string, customerId: string): Promise<boolean> {
    if (!supabase) return removeLocalGroupMember(groupId, customerId);
    const { data, error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('customer_id', customerId).select('id');
    if (error) throw new Error(error.message);
    return Boolean(data?.length);
  },
};
