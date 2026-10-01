import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { DateTimePicker } from './DateTimePicker';
const takeatLogo = new URL('../img/takeat logo.png', import.meta.url).href;
import {
  ArrowLeft,
  Copy,
  Clock3,
  FileText,
  FlaskConical,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
  MessageCircleMore,
  CheckCircle2,
  FolderOpen,
  LayoutDashboard,
} from 'lucide-react';
import {
  addGroupMember,
  createAssignment,
  createGroup,
  createNote,
  createRecruitmentHistory,
  createRound,
  createTest,
  deleteCustomers,
  deleteGroup,
  deleteTest,
  getAssignments,
  getCustomers,
  getGroupMembers,
  getGroups,
  getNotes,
  getRecruitmentHistory,
  getRounds,
  getTests,
  importCustomers,
  updateCustomer,
  updateCustomerStatus,
  updateGroup,
  updateRound,
  updateTest,
} from './storage/localStorage';
import type {
  Customer,
  GroupAssignment,
  GroupStatus,
  RecruitmentStatus,
  RoundStatus,
  Test,
  TestNote,
  TestRound,
  TestStatus,
  WhatsAppGroup,
} from './types';

type Page = 'home' | 'customers' | 'tests' | 'groups';
type ModalType = 'newTest' | 'newGroup' | 'editGroup' | 'editTest' | 'newRound' | 'newAssignment' | 'newNote' | 'finalizeRound' | 'finalizeTest' | 'importCustomers' | 'addParticipantsToGroup' | null;
type CustomerImportSource = { id: string; label: string; file: File | null };

const testStatusOrder: TestStatus[] = ['planned', 'active', 'completed', 'archived'];
const roundStatusOrder: RoundStatus[] = ['planned', 'active', 'completed'];
const groupStatusOrder: GroupStatus[] = ['active', 'paused', 'closed'];
const recruitmentStatusOrder: RecruitmentStatus[] = ['not_contacted', 'contacted', 'no_response', 'interested', 'accepted', 'declined'];
const testResponsibleOptions = ['Jonas', 'João', 'Vinicius', 'Nicolas'];
const testDeadlineWarningWindow = 24 * 60 * 60 * 1000;
const kanbanColumns = [
  { id: 'not_contacted', label: 'Não contatado', tone: 'todo' },
  { id: 'contacted', label: 'Contatado', tone: 'sprint' },
  { id: 'no_response', label: 'Sem resposta', tone: 'paused' },
  { id: 'interested', label: 'Interessado', tone: 'doing' },
  { id: 'accepted', label: 'Aceitou', tone: 'review' },
  { id: 'declined', label: 'Recusou', tone: 'delivered' },
] as const;
const recruitmentStageMap: Record<RecruitmentStatus, (typeof kanbanColumns)[number]['id']> = {
  not_contacted: 'not_contacted',
  contacted: 'contacted',
  no_response: 'no_response',
  interested: 'interested',
  accepted: 'accepted',
  declined: 'declined',
};
const kanbanStageToRecruitmentStatus: Record<(typeof kanbanColumns)[number]['id'], RecruitmentStatus> = {
  not_contacted: 'not_contacted',
  contacted: 'contacted',
  no_response: 'no_response',
  interested: 'interested',
  accepted: 'accepted',
  declined: 'declined',
};

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function toDateTimeLocalInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function normalizeImportFieldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatDuration(start?: string, end?: string) {
  if (!start) return 'Sem início';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const totalHours = diffMs / (1000 * 60 * 60);
  const days = Math.floor(totalHours / 24);
  const remainingHours = Math.round(totalHours % 24);

  if (days === 0) {
    if (remainingHours === 0) return 'Hoje';
    return `${remainingHours} hora${remainingHours === 1 ? '' : 's'}`;
  }

  if (remainingHours === 0) {
    return `${days} dia${days === 1 ? '' : 's'}`;
  }

  return `${days} dia${days === 1 ? '' : 's'} e ${remainingHours} hora${remainingHours === 1 ? '' : 's'}`;
}

function getStatusLabel(status: string, kind: 'test' | 'round' | 'group' | 'customer') {
  const map: Record<string, Record<string, string>> = {
    test: {
      planned: 'Planejado',
      active: 'Em andamento',
      completed: 'Finalizado',
      archived: 'Arquivado',
    },
    round: {
      planned: 'Planejada',
      active: 'Em andamento',
      completed: 'Finalizada',
    },
    group: {
      active: 'Ativo',
      paused: 'Pausado',
      closed: 'Encerrado',
    },
    customer: {
      not_contacted: 'Não contatado',
      contacted: 'Contatado',
      no_response: 'Sem resposta',
      interested: 'Interessado',
      accepted: 'Aceitou',
      declined: 'Recusou',
    },
  };

  return map[kind][status] ?? status;
}

function getStatusClass(status: string, kind: 'test' | 'round' | 'group' | 'customer') {
  const map: Record<string, Record<string, string>> = {
    test: {
      planned: 'status-planning',
      active: 'status-active',
      completed: 'status-done',
      archived: 'status-archived',
    },
    round: {
      planned: 'status-planning',
      active: 'status-active',
      completed: 'status-done',
    },
    group: {
      active: 'status-active',
      paused: 'status-paused',
      closed: 'status-archived',
    },
    customer: {
      not_contacted: 'status-planning',
      contacted: 'status-active',
      no_response: 'status-paused',
      interested: 'status-active',
      accepted: 'status-done',
      declined: 'status-archived',
    },
  };

  return map[kind][status] ?? 'status-planning';
}

function getRecruitmentLabel(status: RecruitmentStatus) {
  return getStatusLabel(status, 'customer');
}

function getCustomerKanbanStage(customer: Customer) {
  return recruitmentStageMap[customer.recruitmentStatus] ?? 'todo';
}

function getRoundName(round: TestRound) {
  return round.name || 'Rodada sem nome';
}

function getAssignmentGroupName(groupId: string, groups: WhatsAppGroup[]) {
  return groups.find((group) => group.id === groupId)?.name ?? 'Grupo removido';
}

function getGroupMemberCountLabel(groupId: string) {
  const count = getGroupMembers(groupId).length;
  return `${count} ${count === 1 ? 'cliente' : 'clientes'}`;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tests, setTests] = useState<Test[]>(() => getTests());
  const [groups, setGroups] = useState<WhatsAppGroup[]>(() => getGroups());
  const [rounds, setRounds] = useState<TestRound[]>(() => getRounds());
  const [assignments, setAssignments] = useState<GroupAssignment[]>(() => getAssignments());
  const [notes, setNotes] = useState<TestNote[]>(() => getNotes());
  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers());
  const [customerImportSources, setCustomerImportSources] = useState<CustomerImportSource[]>(() => [{ id: crypto.randomUUID(), label: '', file: null }]);
  const [modal, setModalState] = useState<ModalType>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const modalCloseTimerRef = useRef<number | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(getTests()[0]?.id ?? null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(() => new Set());
  const [bulkActionMessage, setBulkActionMessage] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testStatusFilter, setTestStatusFilter] = useState<'all' | TestStatus>('all');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | GroupStatus>('all');
  const [groupMemberQuery, setGroupMemberQuery] = useState('');
  const [groupMemberStatusFilter, setGroupMemberStatusFilter] = useState<'all' | RecruitmentStatus>('all');
  const [groupMemberSourceFilter, setGroupMemberSourceFilter] = useState('all');
  const [selectedGroupCustomerIds, setSelectedGroupCustomerIds] = useState<Set<string>>(() => new Set());
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | RecruitmentStatus>('all');
  const [customerSourceFilter, setCustomerSourceFilter] = useState<string>('all');
  const [customerImportPreview, setCustomerImportPreview] = useState<{ source: string; count: number }[]>([]);
  const [customerImportStatus, setCustomerImportStatus] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  function setModal(nextModal: ModalType) {
    if (nextModal === null) {
      if (!modal || modalCloseTimerRef.current !== null) return;
      setIsModalClosing(true);
      const closeDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
      modalCloseTimerRef.current = window.setTimeout(() => {
        setModalState(null);
        setIsModalClosing(false);
        modalCloseTimerRef.current = null;
      }, closeDelay);
      return;
    }

    if (modalCloseTimerRef.current !== null) {
      window.clearTimeout(modalCloseTimerRef.current);
      modalCloseTimerRef.current = null;
    }
    setIsModalClosing(false);
    setModalState(nextModal);
  }

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedTest = tests.find((test) => test.id === selectedTestId) ?? null;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedRound = rounds.find((round) => round.id === selectedRoundId) ?? null;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const customerSourceOptions = [...new Set(customers.flatMap((customer) => customer.sourceLists))]
    .sort((firstSource, secondSource) => firstSource.localeCompare(secondSource, 'pt-BR'));

  const filteredTests = useMemo(() => {
    const query = testQuery.trim().toLowerCase();
    return [...tests]
      .filter((test) => (testStatusFilter === 'all' ? true : test.status === testStatusFilter))
      .filter((test) => {
        if (!query) return true;
        const haystack = `${test.name} ${test.product ?? ''} ${test.responsible ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt));
  }, [tests, testQuery, testStatusFilter]);

  const filteredGroups = useMemo(() => {
    const query = groupQuery.trim().toLowerCase();
    return [...groups]
      .filter((group) => (groupStatusFilter === 'all' ? true : group.status === groupStatusFilter))
      .filter((group) => {
        if (!query) return true;
        const haystack = `${group.name} ${group.segmentation ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [groups, groupQuery, groupStatusFilter]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    return [...customers]
      .filter((customer) => (customerStatusFilter === 'all' ? true : customer.recruitmentStatus === customerStatusFilter))
      .filter((customer) => (customerSourceFilter === 'all' ? true : customer.sourceLists.includes(customerSourceFilter)))
      .filter((customer) => {
        if (!query) return true;
        const haystack = `${customer.name} ${customer.whatsapp ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [customers, customerQuery, customerStatusFilter, customerSourceFilter]);

  const activeTestCount = tests.filter((test) => test.status === 'active').length;
  const activeRoundCount = rounds.filter((round) => round.status === 'active').length;
  const groupParticipationCount = new Set(assignments.map((assignment) => assignment.groupId)).size;
  const finishedTestCount = tests.filter((test) => test.status === 'completed').length;
  const recruitmentTotals = {
    total: customers.length,
    notContacted: customers.filter((customer) => customer.recruitmentStatus === 'not_contacted').length,
    inContact: customers.filter((customer) => ['contacted', 'no_response'].includes(customer.recruitmentStatus)).length,
    interested: customers.filter((customer) => customer.recruitmentStatus === 'interested').length,
    accepted: customers.filter((customer) => customer.recruitmentStatus === 'accepted').length,
    declined: customers.filter((customer) => customer.recruitmentStatus === 'declined').length,
  };
  const testsNearDeadline = tests
    .filter((test) => test.status !== 'completed' && test.status !== 'archived' && test.expectedEndAt)
    .filter((test) => new Date(test.expectedEndAt as string).getTime() - currentTime <= testDeadlineWarningWindow)
    .sort((first, second) => (first.expectedEndAt ?? '').localeCompare(second.expectedEndAt ?? ''));
  const dashboardTrackedTests = tests
    .filter((test) => test.status === 'active' || test.status === 'planned')
    .sort((first, second) => (first.expectedEndAt ?? '9999').localeCompare(second.expectedEndAt ?? '9999'))
    .slice(0, 5);
  const activeGroupCount = groups.filter((group) => group.status === 'active').length;
  const groupMembershipCount = getGroupMembers().length;
  const dashboardGroups = groups
    .map((group) => ({ group, memberCount: getGroupMembers(group.id).length }))
    .sort((first, second) => second.memberCount - first.memberCount)
    .slice(0, 5);
  const recruitmentPipeline = recruitmentStatusOrder.map((status) => ({
    status,
    count: customers.filter((customer) => customer.recruitmentStatus === status).length,
  }));

  function refreshFromStorage() {
    setTests(getTests());
    setGroups(getGroups());
    setRounds(getRounds());
    setAssignments(getAssignments());
    setNotes(getNotes());
    setCustomers(getCustomers());
  }

  async function handleImportCustomers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourcesWithFiles = customerImportSources.filter((source) => source.file);
    if (!sourcesWithFiles.length) {
      setCustomerImportStatus('Adicione pelo menos uma planilha para importar.');
      return;
    }
    if (sourcesWithFiles.some((source) => !source.label.trim())) {
      setCustomerImportStatus('Informe um nome para cada base que será importada.');
      return;
    }

    const entries: Array<{ name: string; contactName?: string; whatsapp?: string; email?: string; sourceList: string; raw?: Record<string, string> }> = [];

    for (const source of sourcesWithFiles) {
      const file = source.file;
      if (!file) continue;
      const sourceName = source.label.trim();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' });

      for (const row of rows) {
        const normalized = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [normalizeImportFieldKey(key), String(value ?? '').trim()]),
        );
        const candidateName =
          normalized.name ||
          normalized.cliente ||
          normalized.restaurante ||
          normalized.loja ||
          normalized.nome ||
          normalized.nome_do_cliente ||
          normalized.nome_do_restaurante ||
          normalized.nome_da_loja ||
          Object.values(normalized).find((value) => value && !['whatsapp', 'telefone', 'celular', 'phone', 'email', 'cnpj', 'cpf'].includes(value)) ||
          'Cliente sem nome';

        const whatsapp =
          normalized.whatsapp ||
          normalized.telefone ||
          normalized.celular ||
          normalized.phone ||
          normalized.numero_whatsapp ||
          '';

        const contactName =
          normalized.contato ||
          normalized.nome_contato ||
          normalized.nome_do_contato ||
          normalized.contact_name ||
          normalized.nome_do_contato ||
          normalized.responsavel ||
          normalized.contato_nome ||
          '';

        const email =
          normalized.email ||
          normalized.e_mail ||
          normalized.email_cliente ||
          normalized.e_mail ||
          normalized.mail ||
          normalized.email_contato ||
          '';

        if (candidateName && candidateName !== 'Cliente sem nome') {
          entries.push({ name: candidateName, contactName, whatsapp, email, sourceList: sourceName, raw: normalized });
        }
      }
    }

    const summary = importCustomers(entries);
    setCustomerImportPreview([...new Set(entries.map((entry) => entry.sourceList))].map((source) => ({
      source,
      count: entries.filter((entry) => entry.sourceList === source).length,
    })));
    setCustomerImportStatus(`Importação concluída: ${summary.created} novos, ${summary.updated} atualizados, ${summary.possibleDuplicates} possíveis duplicidades.`);
    refreshFromStorage();
    setModal(null);
  }

  function handleCustomerStatusChange(customerId: string, nextStatus: RecruitmentStatus) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer || customer.recruitmentStatus === nextStatus) return;
    updateCustomerStatus(customerId, nextStatus, `Status alterado para ${getRecruitmentLabel(nextStatus)}.`);
    refreshFromStorage();
  }

  function toggleCustomerSelection(customerId: string) {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  function toggleFilteredCustomerSelection() {
    const filteredIds = filteredCustomers.map((customer) => customer.id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedCustomerIds.has(id));
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      filteredIds.forEach((id) => allFilteredSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function toggleFilteredGroupMemberSelection() {
    const filteredIds = filteredAvailableGroupMembers.map((customer) => customer.id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedGroupCustomerIds.has(id));
    setSelectedGroupCustomerIds((current) => {
      const next = new Set(current);
      filteredIds.forEach((id) => allFilteredSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function handleBulkCustomerStatusChange(nextStatus: RecruitmentStatus) {
    selectedCustomerIds.forEach((customerId) => {
      updateCustomerStatus(customerId, nextStatus, `Status alterado para ${getRecruitmentLabel(nextStatus)}.`);
    });
    setBulkActionMessage(`Status atualizado para ${selectedCustomerIds.size} ${selectedCustomerIds.size === 1 ? 'cliente' : 'clientes'}.`);
    refreshFromStorage();
  }

  function handleBulkCustomerDelete() {
    const selectedCount = customers.filter((customer) => selectedCustomerIds.has(customer.id)).length;
    const customerLabel = selectedCount === 1 ? 'cliente selecionado' : 'clientes selecionados';
    if (!selectedCount || !window.confirm(`Excluir ${selectedCount} ${customerLabel}? Esta ação não pode ser desfeita.`)) return;

    deleteCustomers([...selectedCustomerIds]);
    if (selectedCustomerId && selectedCustomerIds.has(selectedCustomerId)) setSelectedCustomerId(null);
    setSelectedCustomerIds(new Set());
    setBulkActionMessage(`${selectedCount} ${selectedCount === 1 ? 'cliente excluído' : 'clientes excluídos'}.`);
    refreshFromStorage();
  }

  async function handleCopySelectedCustomerEmails() {
    const emails = [...new Set(customers
      .filter((customer) => selectedCustomerIds.has(customer.id))
      .map((customer) => customer.email?.trim() ?? '')
      .filter(Boolean))];
    if (!emails.length) {
      setBulkActionMessage('Nenhum email nos clientes selecionados.');
      return;
    }

    try {
      await navigator.clipboard.writeText(emails.join('; '));
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = emails.join('; ');
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      if (!copied) {
        setBulkActionMessage('Não foi possível acessar a área de transferência.');
        return;
      }
    }

    if (emails.length > 0) {
      setBulkActionMessage(`${emails.length} ${emails.length === 1 ? 'email copiado' : 'emails copiados'}.`);
    } else {
      setBulkActionMessage('Não foi possível acessar a área de transferência.');
    }
  }

  function handleAddCustomerNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomer) return;
    const data = new FormData(event.currentTarget);
    const note = String(data.get('note') ?? '').trim();
    if (!note) return;

    const nextNotes = selectedCustomer.notes ? `${selectedCustomer.notes}\n\n${new Date().toLocaleDateString('pt-BR')}\n${note}` : `${new Date().toLocaleDateString('pt-BR')}\n${note}`;
    updateCustomer(selectedCustomer.id, {
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    });
    createRecruitmentHistory({
      customerId: selectedCustomer.id,
      toStatus: selectedCustomer.recruitmentStatus,
      note,
      createdAt: new Date().toISOString(),
    });
    refreshFromStorage();
    setModal(null);
  }

  function handleCreateTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const objective = String(data.get('objective') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const product = String(data.get('product') ?? '').trim();
    const responsible = String(data.get('responsible') ?? '').trim();
    const status = (String(data.get('status') ?? 'planned') as TestStatus) || 'planned';
    const startedAt = String(data.get('startedAt') ?? '');
    const expectedEndAt = String(data.get('expectedEndAt') ?? '');
    const resourceUrl = String(data.get('resourceUrl') ?? '').trim();
    if (!name || !startedAt || !expectedEndAt) return;

    const test = createTest({
      name,
      objective,
      description,
      product,
      responsible,
      status,
      startedAt: new Date(startedAt).toISOString(),
      expectedEndAt: new Date(expectedEndAt).toISOString(),
      resourceUrl,
    });

    refreshFromStorage();
    setSelectedTestId(test.id);
    setModal(null);
    setPage('tests');
  }

  function handleEditTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTest) return;

    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const startedAt = String(data.get('startedAt') ?? '');
    const expectedEndAt = String(data.get('expectedEndAt') ?? '');
    if (!name || !startedAt || !expectedEndAt) return;

    updateTest(selectedTest.id, {
      name,
      objective: String(data.get('objective') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
      product: String(data.get('product') ?? '').trim(),
      responsible: String(data.get('responsible') ?? '').trim(),
      status: (String(data.get('status') ?? 'planned') as TestStatus) || 'planned',
      startedAt: new Date(startedAt).toISOString(),
      expectedEndAt: new Date(expectedEndAt).toISOString(),
      resourceUrl: String(data.get('resourceUrl') ?? '').trim(),
    });

    refreshFromStorage();
    setSelectedTestId(selectedTest.id);
    setModal(null);
  }

  function handleDeleteTest(testId: string) {
    const confirmed = window.confirm('Deseja excluir este teste? Esta ação também removerá rodadas, associações e anotações relacionadas.');
    if (!confirmed) return;

    deleteTest(testId);
    refreshFromStorage();
    setSelectedTestId(null);
    setModal(null);
  }

  function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    if (!name) return;

    const group = createGroup({
      name,
      description: String(data.get('description') ?? '').trim(),
      segmentation: String(data.get('segmentation') ?? '').trim(),
      whatsappLink: String(data.get('whatsappLink') ?? '').trim(),
      status: (String(data.get('status') ?? 'active') as GroupStatus) || 'active',
    });

    refreshFromStorage();
    setSelectedGroupId(group.id);
    setModal(null);
    setPage('groups');
  }

  function handleEditGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup) return;

    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    if (!name) return;

    updateGroup(selectedGroup.id, {
      name,
      description: String(data.get('description') ?? '').trim(),
      segmentation: String(data.get('segmentation') ?? '').trim(),
      whatsappLink: String(data.get('whatsappLink') ?? '').trim(),
      status: (String(data.get('status') ?? 'active') as GroupStatus) || 'active',
    });

    refreshFromStorage();
    setSelectedGroupId(selectedGroup.id);
    setModal(null);
  }

  function handleDeleteGroup(groupId: string) {
    const confirmed = window.confirm('Deseja excluir este grupo? Esta ação também removerá as associações e anotações relacionadas.');
    if (!confirmed) return;

    deleteGroup(groupId);
    refreshFromStorage();
    setSelectedGroupId(null);
    setModal(null);
  }

  function handleAddParticipantsToGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup) return;

    selectedGroupCustomerIds.forEach((customerId) => addGroupMember(selectedGroup.id, customerId));

    refreshFromStorage();
    setSelectedGroupCustomerIds(new Set());
    setModal(null);
  }

  function handleCreateRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const objective = String(data.get('objective') ?? '').trim();
    if (!selectedTestId || !name) return;

    const round = createRound({
      testId: selectedTestId,
      name,
      objective,
      status: 'active',
      startedAt: new Date().toISOString(),
    });

    refreshFromStorage();
    setSelectedRoundId(round.id);
    setModal(null);
  }

  function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const roundId = String(data.get('roundId') ?? '').trim();
    const groupId = String(data.get('groupId') ?? '').trim();
    const experienceName = String(data.get('experienceName') ?? '').trim();
    const variant = String(data.get('variant') ?? '').trim();
    if (!roundId || !groupId) return;

    const assignment = createAssignment({
      roundId,
      groupId,
      experienceName,
      variant,
      startedAt: String(data.get('startedAt') ?? new Date().toISOString()),
      notes: String(data.get('notes') ?? '').trim(),
    });

    refreshFromStorage();
    setSelectedRoundId(roundId);
    setSelectedTestId(rounds.find((item) => item.id === roundId)?.testId ?? selectedTestId);
    setModal(null);
    setPage('tests');
    if (assignment) {
      setTimeout(() => setSelectedRoundId(roundId), 0);
    }
  }

  function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const content = String(data.get('content') ?? data.get('note') ?? '').trim();
    if (!content) return;

    const note = createNote({
      testId: selectedTestId ?? undefined,
      roundId: selectedRoundId ?? undefined,
      content,
    });

    const nextNotes = [...getNotes(), note];
    setNotes(nextNotes);
    setModal(null);
  }

  function advanceTestStatus(test: Test) {
    const nextStatus = testStatusOrder[(testStatusOrder.indexOf(test.status) + 1) % testStatusOrder.length];
    const updated = updateTest(test.id, {
      status: nextStatus,
      startedAt: test.startedAt ?? new Date().toISOString(),
    });
    if (updated) {
      refreshFromStorage();
    }
  }

  function advanceRoundStatus(round: TestRound) {
    const nextStatus = roundStatusOrder[(roundStatusOrder.indexOf(round.status) + 1) % roundStatusOrder.length];
    const updated = updateRound(round.id, {
      status: nextStatus,
      startedAt: round.startedAt ?? new Date().toISOString(),
    });
    if (updated) {
      refreshFromStorage();
    }
  }

  function finishRound(roundId: string, values: FormData) {
    const round = rounds.find((item) => item.id === roundId);
    if (!round) return;

    const result = String(values.get('result') ?? '').trim();
    const learnings = String(values.get('learnings') ?? '').trim();
    const problems = String(values.get('problems') ?? '').trim();
    const nextSteps = String(values.get('nextSteps') ?? '').trim();
    const updated = updateRound(roundId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      result,
      learnings,
      notes: problems || round.notes,
      nextSteps,
    });

    if (updated) {
      refreshFromStorage();
      setSelectedRoundId(roundId);
      setModal(null);
    }
  }

  function finishTest(testId: string, values: FormData) {
    const test = tests.find((item) => item.id === testId);
    if (!test) return;

    const finalResult = String(values.get('finalResult') ?? '').trim();
    const learnings = String(values.get('learnings') ?? '').trim();
    const nextSteps = String(values.get('nextSteps') ?? '').trim();
    const updated = updateTest(testId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      finalResult,
      learnings,
      nextSteps,
    });

    if (updated) {
      refreshFromStorage();
      setSelectedTestId(testId);
      setModal(null);
    }
  }

  const selectedTestRounds = selectedTest ? rounds.filter((round) => round.testId === selectedTest.id) : [];
  const selectedRoundAssignments = selectedRound ? assignments.filter((assignment) => assignment.roundId === selectedRound.id) : [];
  const selectedGroupMembers = selectedGroup
    ? getGroupMembers(selectedGroup.id)
        .map((member) => customers.find((customer) => customer.id === member.customerId))
        .filter(Boolean) as Customer[]
    : [];
  const availableGroupMembers = selectedGroup
    ? customers.filter((customer) => !selectedGroupMembers.some((member) => member.id === customer.id))
    : [];
  const groupMemberSourceOptions = [...new Set(availableGroupMembers.flatMap((customer) => customer.sourceLists))]
    .sort((firstSource, secondSource) => firstSource.localeCompare(secondSource, 'pt-BR'));
  const normalizedGroupMemberQuery = groupMemberQuery.trim().toLowerCase();
  const filteredAvailableGroupMembers = availableGroupMembers.filter((customer) => {
    if (groupMemberStatusFilter !== 'all' && customer.recruitmentStatus !== groupMemberStatusFilter) return false;
    if (groupMemberSourceFilter !== 'all' && !customer.sourceLists.includes(groupMemberSourceFilter)) return false;
    if (!normalizedGroupMemberQuery) return true;
    const haystack = `${customer.name} ${customer.contactName ?? ''} ${customer.whatsapp ?? ''} ${customer.email ?? ''} ${customer.sourceLists.join(' ')}`.toLowerCase();
    return haystack.includes(normalizedGroupMemberQuery);
  });

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${isModalClosing ? 'modal-is-closing' : ''}`}>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brand-block">
          <img className="brand-logo" src={takeatLogo} alt="Takeat" />
          <button type="button" className="sidebar-toggle" onClick={() => setSidebarCollapsed((current) => !current)} aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="nav" aria-label="Navegação principal">
          <button type="button" className={`nav-item ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')} aria-label="Visão geral">
            <LayoutDashboard size={17} />
            {!sidebarCollapsed && <span>Visão geral</span>}
          </button>
          <button type="button" className={`nav-item ${page === 'customers' ? 'active' : ''}`} onClick={() => setPage('customers')} aria-label="Clientes">
            <Users size={17} />
            {!sidebarCollapsed && <span>Clientes</span>}
          </button>
          <button type="button" className={`nav-item ${page === 'tests' ? 'active' : ''}`} onClick={() => setPage('tests')} aria-label="Testes">
            <FileText size={17} />
            {!sidebarCollapsed && <span>Testes</span>}
          </button>
          <button type="button" className={`nav-item ${page === 'groups' ? 'active' : ''}`} onClick={() => setPage('groups')} aria-label="Grupos">
            <Users size={17} />
            {!sidebarCollapsed && <span>Grupos</span>}
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="mini-card">
            <span className="dot" />
            {!sidebarCollapsed && (
              <div>
                <strong>Dados locais</strong>
                <small>Salvo no navegador</small>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <div key={page} className="content-wrap page-transition">
          {page === 'home' && (
            <>
              <section className="page-header dashboard-page-header">
                <div>
                  <p className="eyebrow">SISTEMA DE TESTES</p>
                  <h1>Visão geral</h1>
                  <p className="subtitle">Acompanhamento de testes, participantes e grupos em um só lugar.</p>
                </div>
                <button type="button" className="button primary" onClick={() => {
                  setPage('tests');
                  setModal('newTest');
                }}>
                  <Plus size={16} />
                  Novo teste
                </button>
              </section>

              <section className="metric-grid dashboard-metric-grid" aria-label="Indicadores gerais">
                <MetricCard label="Total de testes" value={tests.length} icon={<FlaskConical size={18} />} tone="slate" />
                <MetricCard label="Testes em andamento" value={activeTestCount} icon={<CheckCircle2 size={18} />} tone="teal" />
                <MetricCard label="Próximos do prazo" value={testsNearDeadline.length} icon={<Clock3 size={18} />} tone="amber" />
                <MetricCard label="Testes finalizados" value={finishedTestCount} icon={<FolderOpen size={18} />} tone="rose" />
                <MetricCard label="Clientes na base" value={recruitmentTotals.total} icon={<Users size={18} />} tone="slate" />
                <MetricCard label="Aceitaram participar" value={recruitmentTotals.accepted} icon={<MessageCircleMore size={18} />} tone="teal" />
                <MetricCard label="Grupos ativos" value={activeGroupCount} icon={<Users size={18} />} tone="rose" />
                <MetricCard label="Participações em grupos" value={groupMembershipCount} icon={<FolderOpen size={18} />} tone="amber" />
              </section>

              {testsNearDeadline.length > 0 && (
                <section className="deadline-alert" aria-label="Avisos de prazo dos testes">
                  <div className="deadline-alert-heading">
                    <Clock3 size={18} />
                    <div>
                      <strong>Atenção aos prazos dos testes</strong>
                      <span>{testsNearDeadline.length} {testsNearDeadline.length === 1 ? 'teste precisa de atenção' : 'testes precisam de atenção'}: prazo próximo ou vencido.</span>
                    </div>
                  </div>
                  <div className="deadline-alert-list">
                    {testsNearDeadline.map((test) => {
                      const overdue = new Date(test.expectedEndAt ?? '').getTime() < currentTime;
                      return (
                        <div key={test.id} className="deadline-alert-item">
                          <div>
                            <strong>{test.name}</strong>
                            <span>{overdue ? 'Prazo vencido' : 'Previsão de término'} · {formatDateTime(test.expectedEndAt)}</span>
                          </div>
                          <div className="deadline-alert-actions">
                            <button type="button" className="button outline small" onClick={() => {
                              setPage('tests');
                              setSelectedTestId(test.id);
                            }}>Ver teste</button>
                            {test.resourceUrl && <a className="button outline small" href={test.resourceUrl} target="_blank" rel="noreferrer">Abrir link</a>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <div className="dashboard-section-grid">
                <section className="panel dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Testes em acompanhamento</h2>
                      <p>Planejados e em andamento, ordenados pela previsão de término</p>
                    </div>
                    <button type="button" className="button outline small" onClick={() => setPage('tests')}>Ver testes</button>
                  </div>
                  {dashboardTrackedTests.length ? (
                    <div className="dashboard-list">
                      {dashboardTrackedTests.map((test) => (
                        <button key={test.id} type="button" className="dashboard-list-row" onClick={() => {
                          setPage('tests');
                          setSelectedTestId(test.id);
                        }}>
                          <span className="dashboard-list-copy">
                            <strong>{test.name}</strong>
                            <small>{test.responsible || 'Responsável não informado'} · Início {formatDate(test.startedAt ?? test.createdAt)}</small>
                          </span>
                          <span className="dashboard-list-end">
                            <StatusBadge status={test.status} kind="test" />
                            <small>{formatDateTime(test.expectedEndAt)}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="dashboard-empty">Nenhum teste planejado ou em andamento.</p>
                  )}
                </section>

                <section className="panel dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Recrutamento</h2>
                      <p>{recruitmentTotals.total} clientes na base</p>
                    </div>
                    <button type="button" className="button outline small" onClick={() => setPage('customers')}>Ver clientes</button>
                  </div>
                  <div className="dashboard-pipeline">
                    {recruitmentPipeline.map(({ status, count }) => (
                      <div key={status} className="dashboard-pipeline-row">
                        <div className="dashboard-pipeline-label">
                          <span>{getRecruitmentLabel(status)}</span>
                          <strong>{count}</strong>
                        </div>
                        <div className="dashboard-pipeline-track">
                          <span style={{ width: `${recruitmentTotals.total ? (count / recruitmentTotals.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="panel dashboard-panel dashboard-groups-panel">
                <div className="panel-header">
                  <div>
                    <h2>Grupos de clientes</h2>
                    <p>{groups.length} grupos · {activeGroupCount} ativos · {activeRoundCount} rodadas em andamento</p>
                  </div>
                  <button type="button" className="button outline small" onClick={() => setPage('groups')}>Ver grupos</button>
                </div>
                {dashboardGroups.length ? (
                  <div className="dashboard-group-grid">
                    {dashboardGroups.map(({ group, memberCount }) => (
                      <button key={group.id} type="button" className="dashboard-group-row" onClick={() => {
                        setPage('groups');
                        setSelectedGroupId(group.id);
                      }}>
                        <span className="dashboard-list-copy">
                          <strong>{group.name}</strong>
                          <small>{group.segmentation || group.description || 'Sem segmentação informada'}</small>
                        </span>
                        <span className="dashboard-group-count">{memberCount} {memberCount === 1 ? 'cliente' : 'clientes'}</span>
                        <StatusBadge status={group.status} kind="group" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="dashboard-empty">Nenhum grupo cadastrado.</p>
                )}
              </section>
            </>
          )}

          {page === 'customers' && (
            <>
              <section className="page-header">
                <div>
                  <p className="eyebrow">BASE DE CLIENTES</p>
                  <h1>Clientes</h1>
                  <p className="subtitle">Importe, consolide e acompanhe o recrutamento dos clientes participantes dos testes.</p>
                </div>
                <button type="button" className="button primary" onClick={() => {
                  setCustomerImportSources([{ id: crypto.randomUUID(), label: '', file: null }]);
                  setCustomerImportPreview([]);
                  setCustomerImportStatus('');
                  setModal('importCustomers');
                }}>
                  <Plus size={16} />
                  Importar clientes
                </button>
              </section>

              <section className="metric-grid" aria-label="Indicadores de recrutamento">
                <MetricCard label="Total de clientes" value={recruitmentTotals.total} icon={<Users size={18} />} tone="slate" />
                <MetricCard label="Não contatados" value={recruitmentTotals.notContacted} icon={<CheckCircle2 size={18} />} tone="amber" />
                <MetricCard label="Em contato" value={recruitmentTotals.inContact} icon={<Clock3 size={18} />} tone="teal" />
                <MetricCard label="Aceitaram" value={recruitmentTotals.accepted} icon={<FolderOpen size={18} />} tone="rose" />
              </section>

              <div className="bulk-selection-toolbar" aria-label="Ações em lote para clientes">
                <div className="bulk-selection-controls">
                  <span>{selectedCustomerIds.size} selecionados</span>
                  <button type="button" className="button outline small" onClick={toggleFilteredCustomerSelection} disabled={!filteredCustomers.length}>
                    {filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedCustomerIds.has(customer.id)) ? 'Desmarcar resultados' : 'Selecionar resultados'}
                  </button>
                  {selectedCustomerIds.size > 0 && (
                    <button type="button" className="button outline small" onClick={() => setSelectedCustomerIds(new Set())}>
                      Limpar seleção
                    </button>
                  )}
                </div>
                {selectedCustomerIds.size > 0 && (
                  <div className="bulk-selection-actions">
                    <select aria-label="Alterar status dos clientes selecionados" defaultValue="" onChange={(event) => {
                      if (event.target.value) handleBulkCustomerStatusChange(event.target.value as RecruitmentStatus);
                      event.target.value = '';
                    }}>
                      <option value="">Mover para status...</option>
                      {recruitmentStatusOrder.map((status) => <option key={status} value={status}>{getRecruitmentLabel(status)}</option>)}
                    </select>
                    <button type="button" className="button outline small" onClick={handleCopySelectedCustomerEmails}>
                      <Copy size={14} />
                      Copiar emails
                    </button>
                    <button type="button" className="button outline small" onClick={handleBulkCustomerDelete}>
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>
                )}
                {bulkActionMessage && <span className="bulk-action-message" role="status">{bulkActionMessage}</span>}
              </div>

              <section className="panel kanban-panel">
                <div className="panel-header">
                  <div>
                    <h2>Recrutamento</h2>
                    <p>Arraste os clientes entre os status para acompanhar o processo.</p>
                  </div>
                </div>

                <div className="kanban-grid">
                  {kanbanColumns.map((column) => {
                    const columnCustomers = filteredCustomers.filter((customer) => getCustomerKanbanStage(customer) === column.id);

                    return (
                      <div
                        key={column.id}
                        className="kanban-column"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const customerId = event.dataTransfer.getData('text/plain');
                          if (!customerId) return;
                          handleCustomerStatusChange(customerId, kanbanStageToRecruitmentStatus[column.id]);
                        }}
                      >
                        <div className={`kanban-column-header ${column.tone}`}>
                          <span>{column.label}</span>
                          <strong>{columnCustomers.length}</strong>
                        </div>

                        <div className="kanban-column-body">
                          {columnCustomers.length === 0 ? (
                            <div className="kanban-empty">Sem clientes</div>
                          ) : (
                            columnCustomers.map((customer) => {
                              const firstMessage = `Oi! Tudo bem?\n\nSomos do time de Product Design da Takeat e estamos entrando em contato com o ${customer.name}.\n\nEstamos começando uma iniciativa para aproximar nosso time de alguns clientes e entender melhor, diretamente com quem vive a operação, como podemos melhorar a experiência com a Takeat.\n\nQueremos convidar o ${customer.name} para participar dessa iniciativa. A ideia é compartilhar algumas novidades e, principalmente, ouvir a opinião de vocês sobre elas antes de chegarem para todo mundo.\n\nPodemos te explicar rapidinho como vai funcionar?`;
                              const whatsappUrl = `https://wa.me/${customer.whatsapp?.replace(/\D/g, '')}${column.id === 'not_contacted' ? `?text=${encodeURIComponent(firstMessage)}` : ''}`;

                              return (
                              <div
                                key={customer.id}
                                className="kanban-card"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = 'move';
                                  event.dataTransfer.setData('text/plain', customer.id);
                                }}
                              >
                                <div className="kanban-card-heading">
                                  <button type="button" className="kanban-card-title" onClick={() => setSelectedCustomerId(customer.id)}>
                                    <strong>{customer.name}</strong>
                                  </button>
                                  <input
                                    type="checkbox"
                                    className="customer-select-checkbox kanban-card-checkbox"
                                    aria-label={`Selecionar ${customer.name}`}
                                    checked={selectedCustomerIds.has(customer.id)}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={() => toggleCustomerSelection(customer.id)}
                                  />
                                </div>
                                <button type="button" className="kanban-card-main" onClick={() => setSelectedCustomerId(customer.id)}>
                                  <div className="customer-card-details">
                                    <div className="customer-card-tag customer-card-tag-phone">
                                      <strong>{customer.whatsapp || 'Não informado'}</strong>
                                    </div>
                                    <div className="customer-card-tag customer-card-tag-contact">
                                      <strong>{customer.contactName || 'Não informado'}</strong>
                                    </div>
                                    <div className="customer-card-tag customer-card-tag-email">
                                      <strong>{customer.email || 'Não informado'}</strong>
                                    </div>
                                    <div className="customer-card-sources">
                                      <span className="customer-card-tag-label">Base de origem</span>
                                      <div className="customer-source-tags">
                                        {(customer.sourceLists.length ? customer.sourceLists : ['Não informada']).map((source) => (
                                          <span key={source} className="customer-source-tag">{source}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                                {customer.whatsapp && (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="whatsapp-button"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {column.id === 'not_contacted' ? 'Enviar primeira mensagem' : 'WhatsApp'}
                                  </a>
                                )}
                              </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header list-header">
                  <div>
                    <h2>Clientes</h2>
                    <p>{filteredCustomers.length} registros</p>
                  </div>
                  <div className="toolbar">
                    <label className="search-box">
                      <Search size={15} />
                      <input type="search" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Buscar por nome ou WhatsApp" />
                    </label>
                    <label className="filter-box">
                      <SlidersHorizontal size={15} />
                      <select value={customerStatusFilter} onChange={(event) => setCustomerStatusFilter(event.target.value as 'all' | RecruitmentStatus)}>
                        <option value="all">Todos os status</option>
                        {recruitmentStatusOrder.map((status) => <option key={status} value={status}>{getRecruitmentLabel(status)}</option>)}
                      </select>
                    </label>
                    <label className="filter-box">
                      <SlidersHorizontal size={15} />
                      <select value={customerSourceFilter} onChange={(event) => setCustomerSourceFilter(event.target.value)}>
                        <option value="all">Todas as origens</option>
                        {customerSourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="customer-select-column">
                          <input
                            type="checkbox"
                            className="customer-select-checkbox"
                            aria-label="Selecionar todos os clientes filtrados"
                            checked={filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedCustomerIds.has(customer.id))}
                            onChange={toggleFilteredCustomerSelection}
                          />
                        </th>
                        <th>Cliente</th>
                        <th>WhatsApp</th>
                        <th>Contato</th>
                        <th>Email</th>
                        <th>Origem</th>
                        <th>Status</th>
                        <th>Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} onClick={() => setSelectedCustomerId(customer.id)}>
                          <td className="customer-select-column" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="customer-select-checkbox"
                              aria-label={`Selecionar ${customer.name}`}
                              checked={selectedCustomerIds.has(customer.id)}
                              onChange={() => toggleCustomerSelection(customer.id)}
                            />
                          </td>
                          <td>
                            <div className="name-cell">
                              <span className="name-icon"><Users size={14} /></span>
                              <div>
                                <strong>{customer.name}</strong>
                                <small>{customer.sourceLists.length ? customer.sourceLists.join(' • ') : 'Origem não informada'}</small>
                              </div>
                            </div>
                          </td>
                          <td>{customer.whatsapp || '—'}</td>
                          <td>{customer.contactName || '—'}</td>
                          <td>{customer.email || '—'}</td>
                          <td>{customer.sourceLists.length ? customer.sourceLists.join(', ') : '—'}</td>
                          <td><StatusBadge status={customer.recruitmentStatus} kind="customer" /></td>
                          <td>{customer.notes ? customer.notes.slice(0, 80) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {page === 'tests' && (
            <>
              <section className="page-header">
                <div>
                  <p className="eyebrow">TESTES COM CLIENTES</p>
                  <h1>Testes</h1>
                  <p className="subtitle">Organize grupos, acompanhe experiências e registre os aprendizados dos seus testes.</p>
                </div>
                <button type="button" className="button primary" onClick={() => setModal('newTest')}>
                  <Plus size={16} />
                  Novo teste
                </button>
              </section>

              <section className="metric-grid" aria-label="Indicadores de testes">
                <MetricCard label="Testes ativos" value={activeTestCount} icon={<CheckCircle2 size={18} />} tone="teal" />
                <MetricCard label="Rodadas em andamento" value={activeRoundCount} icon={<Clock3 size={18} />} tone="amber" />
                <MetricCard label="Grupos participando" value={groupParticipationCount} icon={<Users size={18} />} tone="rose" />
                <MetricCard label="Testes finalizados" value={finishedTestCount} icon={<FolderOpen size={18} />} tone="slate" />
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Em andamento</h2>
                    <p>Visão geral dos testes atendendo clientes</p>
                  </div>
                </div>
                {filteredTests.filter((test) => test.status === 'active' || test.status === 'planned').length ? (
                  <div className="test-card-grid">
                    {filteredTests
                      .filter((test) => test.status === 'active' || test.status === 'planned')
                      .map((test) => <TestCard key={test.id} test={test} onOpen={() => setSelectedTestId(test.id)} />)}
                  </div>
                ) : (
                  <EmptyState title="Nenhum teste em andamento" description="Crie um novo experimento para começar a acompanhar as versões e os grupos." actionLabel="Criar teste" onAction={() => setModal('newTest')} />
                )}
              </section>

              <section className="panel">
                <div className="panel-header list-header">
                  <div>
                    <h2>Todos os testes</h2>
                    <p>{filteredTests.length} registros</p>
                  </div>
                  <div className="toolbar">
                    <label className="search-box">
                      <Search size={15} />
                      <input type="search" value={testQuery} onChange={(event) => setTestQuery(event.target.value)} placeholder="Buscar por nome, produto ou responsável" />
                    </label>
                    <label className="filter-box">
                      <SlidersHorizontal size={15} />
                      <select value={testStatusFilter} onChange={(event) => setTestStatusFilter(event.target.value as 'all' | TestStatus)}>
                        <option value="all">Todos os status</option>
                        {testStatusOrder.map((status) => <option key={status} value={status}>{getStatusLabel(status, 'test')}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
                {filteredTests.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Teste</th>
                          <th>Produto</th>
                          <th>Status</th>
                          <th>Rodadas</th>
                          <th>Grupos</th>
                          <th>Início</th>
                          <th>Previsão de término</th>
                          <th>Duração</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTests.map((test) => {
                          const roundsCount = rounds.filter((round) => round.testId === test.id).length;
                          const groupsCount = new Set(assignments.filter((assignment) => rounds.some((round) => round.id === assignment.roundId && round.testId === test.id)).map((assignment) => assignment.groupId)).size;
                          return (
                            <tr key={test.id} onClick={() => setSelectedTestId(test.id)}>
                              <td>
                                <div className="name-cell">
                                  <span className="name-icon"><FlaskConical size={14} /></span>
                                  <div>
                                    <strong>{test.name}</strong>
                                    <small>{test.responsible ? `Responsável: ${test.responsible}` : 'Responsável não informado'}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{test.product || '—'}</td>
                              <td><StatusBadge status={test.status} kind="test" /></td>
                              <td>{roundsCount}</td>
                              <td>{groupsCount}</td>
                              <td>{formatDate(test.startedAt ?? test.createdAt)}</td>
                              <td>{formatDateTime(test.expectedEndAt)}</td>
                              <td>{formatDuration(test.startedAt ?? test.createdAt, test.completedAt ?? undefined)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="Nenhum teste encontrado" description="Ajuste a busca ou crie um novo teste para começar." actionLabel="Criar teste" onAction={() => setModal('newTest')} />
                )}
              </section>
            </>
          )}

          {page === 'groups' && (
            <>
              <section className="page-header">
                <div>
                  <p className="eyebrow">GRUPOS DE WHATSAPP</p>
                  <h1>Grupos</h1>
                  <p className="subtitle">Organize segmentações e acompanhe cada participação em testes.</p>
                </div>
                <button type="button" className="button primary" onClick={() => setModal('newGroup')}>
                  <Plus size={16} />
                  Novo grupo
                </button>
              </section>

              <section className="panel">
                <div className="panel-header list-header">
                  <div>
                    <h2>Todos os grupos</h2>
                    <p>{filteredGroups.length} registros</p>
                  </div>
                  <div className="toolbar">
                    <label className="search-box">
                      <Search size={15} />
                      <input type="search" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="Buscar por nome ou segmentação" />
                    </label>
                    <label className="filter-box">
                      <SlidersHorizontal size={15} />
                      <select value={groupStatusFilter} onChange={(event) => setGroupStatusFilter(event.target.value as 'all' | GroupStatus)}>
                        <option value="all">Todos os status</option>
                        {groupStatusOrder.map((status) => <option key={status} value={status}>{getStatusLabel(status, 'group')}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
                {filteredGroups.length ? (
                  <div className="group-card-grid">
                    {filteredGroups.map((group) => <GroupCard key={group.id} group={group} onOpen={() => setSelectedGroupId(group.id)} />)}
                  </div>
                ) : (
                  <EmptyState title="Nenhum grupo cadastrado" description="Cadastre grupos de WhatsApp para associar versões e rodadas." actionLabel="Criar grupo" onAction={() => setModal('newGroup')} />
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {selectedTest && (
        <>
          <button type="button" className="drawer-scrim" aria-label="Fechar painel do teste" onClick={() => setSelectedTestId(null)} />
          <aside className="drawer" aria-label="Detalhes do teste">
            <div className="drawer-header">
              <button type="button" className="icon-button" onClick={() => setSelectedTestId(null)}>
                <ArrowLeft size={18} />
              </button>
              <span>DETALHES DO TESTE</span>
              <button type="button" className="icon-button" onClick={() => setSelectedTestId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="drawer-content">
              <div className="drawer-title-row">
                <div>
                  <p className="eyebrow">TESTE</p>
                  <h2>{selectedTest.name}</h2>
                </div>
                <StatusBadge status={selectedTest.status} kind="test" onClick={() => advanceTestStatus(selectedTest)} />
              </div>

              <div className="button-row" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button type="button" className="button outline small" onClick={() => setModal('editTest')}>
                  Editar
                </button>
                <button type="button" className="button secondary small" onClick={() => handleDeleteTest(selectedTest.id)}>
                  Excluir
                </button>
              </div>

              <div className="summary-grid">
                <div>
                  <span>Produto</span>
                  <strong>{selectedTest.product || '—'}</strong>
                </div>
                <div>
                  <span>Responsável</span>
                  <strong>{selectedTest.responsible || '—'}</strong>
                </div>
                <div>
                  <span>Iniciado em</span>
                  <strong>{formatDateTime(selectedTest.startedAt ?? selectedTest.createdAt)}</strong>
                </div>
                <div>
                  <span>Previsão de término</span>
                  <strong>{formatDateTime(selectedTest.expectedEndAt)}</strong>
                </div>
                <div>
                  <span>Duração</span>
                  <strong>{formatDuration(selectedTest.startedAt ?? selectedTest.createdAt, selectedTest.completedAt ?? undefined)}</strong>
                </div>
              </div>

              {selectedTest.resourceUrl && (
                <div className="text-block">
                  <h3>Teste hospedado</h3>
                  <a href={selectedTest.resourceUrl} target="_blank" rel="noreferrer" className="button outline small">Abrir link do teste</a>
                </div>
              )}

              <div className="text-block">
                <h3>Objetivo</h3>
                <p>{selectedTest.objective || selectedTest.description || 'Sem objetivo informado.'}</p>
              </div>

              {selectedTest.hypothesis && (
                <div className="text-block">
                  <h3>Hipótese</h3>
                  <p>{selectedTest.hypothesis}</p>
                </div>
              )}

              <div className="section-row">
                <h3>Rodadas</h3>
                <button type="button" className="button outline small" onClick={() => setModal('newRound')}>
                  <Plus size={14} />
                  Nova rodada
                </button>
              </div>

              {selectedTestRounds.length ? (
                <div className="stack-list">
                  {selectedTestRounds.map((round) => {
                    const roundAssignments = assignments.filter((assignment) => assignment.roundId === round.id);
                    return (
                      <div key={round.id} className="round-card">
                        <div className="round-card-header">
                          <div>
                            <strong>{getRoundName(round)}</strong>
                            <small>
                              {round.startedAt ? `${formatDate(round.startedAt)} • ` : ''}
                              {roundAssignments.length} grupos
                            </small>
                          </div>
                          <StatusBadge status={round.status} kind="round" onClick={() => advanceRoundStatus(round)} />
                        </div>
                        <p>{round.objective || 'Sem objetivo definido.'}</p>
                        <div className="round-card-actions">
                          <button type="button" className="text-button" onClick={() => setSelectedRoundId(round.id)}>
                            Ver detalhes
                          </button>
                          <button type="button" className="button outline xsmall" onClick={() => { setSelectedRoundId(round.id); setModal('newAssignment'); }}>
                            + Adicionar grupo
                          </button>
                          {round.status !== 'completed' && (
                            <button type="button" className="button outline xsmall" onClick={() => { setSelectedRoundId(round.id); setModal('finalizeRound'); }}>
                              Finalizar rodada
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="Nenhuma rodada criada" description="Crie a primeira rodada para começar a acompanhar grupos e versões." actionLabel="Nova rodada" onAction={() => setModal('newRound')} compact />
              )}

              <div className="section-row">
                <h3>Anotações</h3>
                <button type="button" className="button outline small" onClick={() => setModal('newNote')}>
                  <Plus size={14} />
                  Nova anotação
                </button>
              </div>
              <div className="notes-stack">
                {notes.filter((note) => note.testId === selectedTest.id).length ? (
                  [...notes]
                    .filter((note) => note.testId === selectedTest.id)
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((note) => {
                      const relatedRound = note.roundId ? rounds.find((round) => round.id === note.roundId) : null;
                      const relatedAssignment = note.groupAssignmentId ? assignments.find((assignment) => assignment.id === note.groupAssignmentId) : null;
                      return (
                        <article key={note.id} className="note-item">
                          <div className="note-header">
                            <span>{formatDateTime(note.createdAt)}</span>
                            {relatedRound && <span>{relatedRound.name}</span>}
                          </div>
                          <p>{note.content}</p>
                          {relatedAssignment && (
                            <small>
                              Grupo: {getAssignmentGroupName(relatedAssignment.groupId, groups)}
                              {relatedAssignment.variant ? ` • Versão ${relatedAssignment.variant}` : ''}
                            </small>
                          )}
                        </article>
                      );
                    })
                ) : (
                  <EmptyState title="Nenhuma anotação ainda" description="Registre observações importantes durante as rodadas e as sessões de teste." actionLabel="Adicionar nota" onAction={() => setModal('newNote')} compact />
                )}
              </div>

              {selectedTest.status !== 'completed' && selectedTest.status !== 'archived' && (
                <div className="drawer-actions">
                  <button type="button" className="button primary" onClick={() => setModal('finalizeTest')}>
                    Finalizar teste
                  </button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {selectedCustomer && (
        <>
          <button type="button" className="drawer-scrim" aria-label="Fechar painel do cliente" onClick={() => setSelectedCustomerId(null)} />
          <aside className="drawer small-drawer" aria-label="Detalhes do cliente">
            <div className="drawer-header">
              <button type="button" className="icon-button" onClick={() => setSelectedCustomerId(null)}>
                <ArrowLeft size={18} />
              </button>
              <span>DETALHES DO CLIENTE</span>
              <button type="button" className="icon-button" onClick={() => setSelectedCustomerId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="drawer-content">
              <div className="drawer-title-row">
                <div>
                  <p className="eyebrow">CLIENTE</p>
                  <h2>{selectedCustomer.name}</h2>
                </div>
                <StatusBadge status={selectedCustomer.recruitmentStatus} kind="customer" />
              </div>

              <div className="summary-grid">
                <div>
                  <span>WhatsApp</span>
                  <strong>{selectedCustomer.whatsapp || '—'}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{getRecruitmentLabel(selectedCustomer.recruitmentStatus)}</strong>
                </div>
                <div>
                  <span>Contato</span>
                  <strong>{selectedCustomer.contactName || '—'}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selectedCustomer.email || '—'}</strong>
                </div>
                <div>
                  <span>Origem</span>
                  <strong>{selectedCustomer.sourceLists.length ? selectedCustomer.sourceLists.join(', ') : '—'}</strong>
                </div>
                <div>
                  <span>Atualizado em</span>
                  <strong>{formatDateTime(selectedCustomer.updatedAt)}</strong>
                </div>
              </div>

              {selectedCustomer.whatsapp && (
                <a href={`https://wa.me/${selectedCustomer.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="button primary full-width" style={{ marginTop: 12 }}>
                  <MessageCircleMore size={15} />
                  Entrar em contato no WhatsApp
                </a>
              )}

              <div className="field">
                <span>Status de recrutamento</span>
                <select value={selectedCustomer.recruitmentStatus} onChange={(event) => handleCustomerStatusChange(selectedCustomer.id, event.target.value as RecruitmentStatus)}>
                  {recruitmentStatusOrder.map((status) => <option key={status} value={status}>{getRecruitmentLabel(status)}</option>)}
                </select>
              </div>

              <div className="text-block">
                <h3>Observações</h3>
                <p>{selectedCustomer.notes || 'Nenhuma observação registrada ainda.'}</p>
              </div>

              <div className="section-row">
                <h3>Histórico</h3>
                <button type="button" className="button outline small" onClick={() => setModal('newNote')}>
                  <Plus size={14} />
                  Nova observação
                </button>
              </div>

              <div className="stack-list">
                {getRecruitmentHistory(selectedCustomer.id).length ? (
                  getRecruitmentHistory(selectedCustomer.id).map((history) => (
                    <div key={history.id} className="mini-record">
                      <div className="mini-record-header">
                        <strong>{formatDateTime(history.createdAt)}</strong>
                      </div>
                      <p>
                        {history.fromStatus ? `${getRecruitmentLabel(history.fromStatus)} → ${getRecruitmentLabel(history.toStatus)}` : getRecruitmentLabel(history.toStatus)}
                      </p>
                      {history.note && <small>{history.note}</small>}
                    </div>
                  ))
                ) : (
                  <p className="empty-inline">Nenhum histórico registrado.</p>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {selectedGroup && (
        <>
          <button type="button" className="drawer-scrim" aria-label="Fechar painel do grupo" onClick={() => setSelectedGroupId(null)} />
          <aside className="drawer small-drawer" aria-label="Detalhes do grupo">
            <div className="drawer-header">
              <button type="button" className="icon-button" onClick={() => setSelectedGroupId(null)}>
                <ArrowLeft size={18} />
              </button>
              <span>DETALHES DO GRUPO</span>
              <button type="button" className="icon-button" onClick={() => setSelectedGroupId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="drawer-content">
              <div className="drawer-title-row">
                <div>
                  <p className="eyebrow">GRUPO</p>
                  <h2>{selectedGroup.name}</h2>
                </div>
                <StatusBadge status={selectedGroup.status} kind="group" />
              </div>

              <div className="button-row" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button type="button" className="button outline small" onClick={() => setModal('editGroup')}>
                  Editar
                </button>
                <button type="button" className="button secondary small" onClick={() => handleDeleteGroup(selectedGroup.id)}>
                  Excluir
                </button>
              </div>

              <div className="text-block group-description">
                <h3>Descrição</h3>
                <p>{selectedGroup.description || 'Nenhuma descrição cadastrada.'}</p>
              </div>

              <div className="summary-grid">
                <div>
                  <span>Segmentação</span>
                  <strong>{selectedGroup.segmentation || '—'}</strong>
                </div>
                <div>
                  <span>Clientes</span>
                  <strong>{selectedGroupMembers.length}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{getStatusLabel(selectedGroup.status, 'group')}</strong>
                </div>
              </div>

              {selectedGroup.whatsappLink && (
                <a href={selectedGroup.whatsappLink} target="_blank" rel="noreferrer" className="button primary full-width">
                  <MessageCircleMore size={15} />
                  Abrir grupo no WhatsApp
                </a>
              )}

              <div className="section-row">
                <h3>Participantes</h3>
                <button type="button" className="button outline small" onClick={() => {
                  setSelectedGroupCustomerIds(new Set());
                  setGroupMemberQuery('');
                  setGroupMemberStatusFilter('all');
                  setGroupMemberSourceFilter('all');
                  setModal('addParticipantsToGroup');
                }}>
                  + Adicionar participantes
                </button>
              </div>

              <div className="stack-list">
                {selectedGroupMembers.length ? (
                  selectedGroupMembers.map((member) => (
                    <div key={member.id} className="mini-record">
                      <div className="mini-record-header">
                        <strong>{member.name}</strong>
                        <span>{getRecruitmentLabel(member.recruitmentStatus)}</span>
                      </div>
                      <small>{member.whatsapp || 'WhatsApp não informado'}</small>
                    </div>
                  ))
                ) : (
                  <p className="empty-inline">Nenhum participante cadastrado.</p>
                )}
              </div>

              <div className="text-block">
                <h3>Histórico de testes</h3>
                <div className="stack-list">
                  {assignments
                    .filter((assignment) => assignment.groupId === selectedGroup.id)
                    .map((assignment) => {
                      const round = rounds.find((item) => item.id === assignment.roundId);
                      const test = round ? tests.find((item) => item.id === round.testId) : null;
                      return (
                        <div key={assignment.id} className="mini-record">
                          <div className="mini-record-header">
                            <strong>{test?.name ?? 'Teste removido'}</strong>
                            <span>{round ? round.name : 'Rodada'}</span>
                          </div>
                          <p>
                            {assignment.experienceName || 'Experiência não definida'} • Versão {assignment.variant || '—'}
                          </p>
                          <small>
                            {assignment.startedAt ? formatDate(assignment.startedAt) : 'Sem data'} • {round?.status ? getStatusLabel(round.status, 'round') : 'Sem status'}
                          </small>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {modal === 'newTest' && (
        <ModalShell onClose={() => setModal(null)} title="Criar teste" subtitle="NOVO TESTE">
          <form onSubmit={handleCreateTest} className="modal-form">
            <label className="field">
              <span>Nome do teste</span>
              <input name="name" required placeholder="Ex.: Nova tela de pagamento" />
            </label>
            <label className="field">
              <span>Produto</span>
              <input name="product" placeholder="Ex.: Cardápio Digital" />
            </label>
            <label className="field">
              <span>Responsável</span>
              <select name="responsible" required defaultValue="">
                <option value="" disabled>Selecione o responsável</option>
                {testResponsibleOptions.map((responsible) => <option key={responsible} value={responsible}>{responsible}</option>)}
              </select>
            </label>
            <DateTimePicker label="Data e hora de início" name="startedAt" defaultValue={toDateTimeLocalInput(new Date().toISOString())} />
            <DateTimePicker label="Previsão de término" name="expectedEndAt" defaultValue={toDateTimeLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())} />
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="active">
                {testStatusOrder.map((status) => <option key={status} value={status}>{getStatusLabel(status, 'test')}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Objetivo</span>
              <textarea name="objective" rows={3} placeholder="Qual hipótese ou validação queremos fazer?" />
            </label>
            <label className="field">
              <span>Descrição</span>
              <textarea name="description" rows={3} placeholder="Contexto do teste e objetivo do cliente." />
            </label>
            <label className="field">
              <span>Link do teste ou arquivo do Drive</span>
              <input name="resourceUrl" type="url" placeholder="https://drive.google.com/..." />
              <small className="field-help">Meu Drive &gt; Sistema de Testes &gt; Novo Gestor</small>
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Salvar teste</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'editTest' && selectedTest && (
        <ModalShell onClose={() => setModal(null)} title="Editar teste" subtitle="EDITAR TESTE">
          <form onSubmit={handleEditTest} className="modal-form">
            <label className="field">
              <span>Nome do teste</span>
              <input name="name" required defaultValue={selectedTest.name} />
            </label>
            <label className="field">
              <span>Produto</span>
              <input name="product" defaultValue={selectedTest.product ?? ''} placeholder="Ex.: Cardápio Digital" />
            </label>
            <label className="field">
              <span>Responsável</span>
              <select name="responsible" required defaultValue={selectedTest.responsible ?? ''}>
                <option value="" disabled>Selecione o responsável</option>
                {selectedTest.responsible && !testResponsibleOptions.includes(selectedTest.responsible) && (
                  <option value={selectedTest.responsible}>{selectedTest.responsible} (atual)</option>
                )}
                {testResponsibleOptions.map((responsible) => <option key={responsible} value={responsible}>{responsible}</option>)}
              </select>
            </label>
            <DateTimePicker label="Data e hora de início" name="startedAt" defaultValue={toDateTimeLocalInput(selectedTest.startedAt ?? selectedTest.createdAt)} />
            <DateTimePicker label="Previsão de término" name="expectedEndAt" defaultValue={toDateTimeLocalInput(selectedTest.expectedEndAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())} />
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={selectedTest.status}>
                {testStatusOrder.map((status) => <option key={status} value={status}>{getStatusLabel(status, 'test')}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Objetivo</span>
              <textarea name="objective" rows={3} defaultValue={selectedTest.objective ?? ''} placeholder="Qual hipótese ou validação queremos fazer?" />
            </label>
            <label className="field">
              <span>Descrição</span>
              <textarea name="description" rows={3} defaultValue={selectedTest.description ?? ''} placeholder="Contexto do teste e objetivo do cliente." />
            </label>
            <label className="field">
              <span>Link do teste ou arquivo do Drive</span>
              <input name="resourceUrl" type="url" defaultValue={selectedTest.resourceUrl ?? ''} placeholder="https://drive.google.com/..." />
              <small className="field-help">Meu Drive &gt; Sistema de Testes &gt; Novo Gestor</small>
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Salvar alterações</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'importCustomers' && (
        <ModalShell onClose={() => setModal(null)} title="Importar clientes" subtitle="IMPORTAÇÃO DE BASE">
          <form onSubmit={handleImportCustomers} className="modal-form">
            <div className="customer-import-source-list">
              {customerImportSources.map((source, index) => (
                <div key={source.id} className="customer-import-source-row">
                  <label className="field">
                    <span>Nome da base</span>
                    <input
                      type="text"
                      value={source.label}
                      maxLength={80}
                      placeholder="Ex.: Restaurantes ativos"
                      onChange={(event) => setCustomerImportSources((current) => current.map((item) => item.id === source.id ? { ...item, label: event.target.value } : item))}
                    />
                  </label>
                  <label className="field">
                    <span>Planilha {index + 1}</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(event) => setCustomerImportSources((current) => current.map((item) => item.id === source.id ? { ...item, file: event.target.files?.[0] ?? null } : item))}
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button customer-import-remove"
                    aria-label={`Remover planilha ${index + 1}`}
                    title="Remover planilha"
                    disabled={customerImportSources.length === 1}
                    onClick={() => setCustomerImportSources((current) => current.filter((item) => item.id !== source.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button type="button" className="button outline small customer-import-add" onClick={() => setCustomerImportSources((current) => [...current, { id: crypto.randomUUID(), label: '', file: null }])}>
                <Plus size={14} />
                Adicionar planilha
              </button>
            </div>

            {customerImportPreview.length > 0 && (
              <div className="stack-list">
                {customerImportPreview.map((preview) => (
                  <div key={preview.source} className="mini-record">
                    <div className="mini-record-header">
                      <strong>{preview.source}</strong>
                    </div>
                    <small>{preview.count} clientes encontrados nesta base</small>
                  </div>
                ))}
              </div>
            )}

            {customerImportStatus && <p className="muted-text">{customerImportStatus}</p>}

            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Confirmar importação</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'addParticipantsToGroup' && selectedGroup && (
        <ModalShell onClose={() => setModal(null)} title="Adicionar participantes" subtitle="GRUPO">
          <form onSubmit={handleAddParticipantsToGroup} className="modal-form">
            <div className="participant-modal-controls">
              <label className="search-box">
                <Search size={15} />
                <input type="search" value={groupMemberQuery} onChange={(event) => setGroupMemberQuery(event.target.value)} placeholder="Buscar cliente, contato, telefone ou email" />
              </label>
              <label className="filter-box">
                <SlidersHorizontal size={15} />
                <select aria-label="Filtrar clientes por status" value={groupMemberStatusFilter} onChange={(event) => setGroupMemberStatusFilter(event.target.value as 'all' | RecruitmentStatus)}>
                  <option value="all">Todos os status</option>
                  {recruitmentStatusOrder.map((status) => <option key={status} value={status}>{getRecruitmentLabel(status)}</option>)}
                </select>
              </label>
              <label className="filter-box participant-source-filter">
                <SlidersHorizontal size={15} />
                <select aria-label="Filtrar clientes por base" value={groupMemberSourceFilter} onChange={(event) => setGroupMemberSourceFilter(event.target.value)}>
                  <option value="all">Todas as bases</option>
                  {groupMemberSourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </label>
            </div>

            <div className="participant-selection-actions">
              <span>{selectedGroupCustomerIds.size} selecionados</span>
              <button type="button" className="button outline small" onClick={toggleFilteredGroupMemberSelection} disabled={!filteredAvailableGroupMembers.length}>
                {filteredAvailableGroupMembers.length > 0 && filteredAvailableGroupMembers.every((customer) => selectedGroupCustomerIds.has(customer.id)) ? 'Desmarcar filtrados' : 'Selecionar filtrados'}
              </button>
              {selectedGroupCustomerIds.size > 0 && (
                <button type="button" className="button outline small" onClick={() => setSelectedGroupCustomerIds(new Set())}>Limpar seleção</button>
              )}
            </div>

            <div className="participant-list">
              {filteredAvailableGroupMembers.length ? (
                filteredAvailableGroupMembers.map((customer) => (
                  <label key={customer.id} className="participant-option">
                    <input
                      type="checkbox"
                      checked={selectedGroupCustomerIds.has(customer.id)}
                      onChange={() => setSelectedGroupCustomerIds((current) => {
                        const next = new Set(current);
                        if (next.has(customer.id)) next.delete(customer.id);
                        else next.add(customer.id);
                        return next;
                      })}
                    />
                    <span className="participant-option-content">
                      <span className="participant-option-heading">
                        <strong>{customer.name}</strong>
                        <StatusBadge status={customer.recruitmentStatus} kind="customer" />
                      </span>
                      <small>{customer.whatsapp || 'WhatsApp não informado'} · {customer.email || 'Email não informado'}</small>
                      <small className="participant-option-sources">Base: {customer.sourceLists.length ? customer.sourceLists.join(' · ') : 'Não informada'}</small>
                    </span>
                  </label>
                ))
              ) : (
                <p className="empty-inline">{availableGroupMembers.length ? 'Nenhum cliente encontrado com esses filtros.' : 'Todos os clientes já foram adicionados a este grupo.'}</p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary" disabled={!selectedGroupCustomerIds.size}>Adicionar {selectedGroupCustomerIds.size || ''} ao grupo</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'newGroup' && (
        <ModalShell onClose={() => setModal(null)} title="Criar grupo" subtitle="NOVO GRUPO">
          <form onSubmit={handleCreateGroup} className="modal-form">
            <label className="field">
              <span>Nome do grupo</span>
              <input name="name" required placeholder="Ex.: Restaurantes P" />
            </label>
            <label className="field">
              <span>Segmentação</span>
              <input name="segmentation" placeholder="Ex.: P, Franquias, Restaurantes novos" />
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="active">
                {groupStatusOrder.map((status) => <option key={status} value={status}>{getStatusLabel(status, 'group')}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Link do grupo no WhatsApp</span>
              <input name="whatsappLink" placeholder="https://chat.whatsapp.com/..." />
            </label>
            <label className="field">
              <span>Descrição</span>
              <textarea name="description" rows={3} placeholder="Base do grupo e contexto de experiência." />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Salvar grupo</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'editGroup' && selectedGroup && (
        <ModalShell onClose={() => setModal(null)} title="Editar grupo" subtitle="EDITAR GRUPO">
          <form onSubmit={handleEditGroup} className="modal-form">
            <label className="field">
              <span>Nome do grupo</span>
              <input name="name" required defaultValue={selectedGroup.name} />
            </label>
            <label className="field">
              <span>Segmentação</span>
              <input name="segmentation" defaultValue={selectedGroup.segmentation ?? ''} placeholder="Ex.: P, Franquias, Restaurantes novos" />
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={selectedGroup.status}>
                {groupStatusOrder.map((status) => <option key={status} value={status}>{getStatusLabel(status, 'group')}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Link do grupo no WhatsApp</span>
              <input name="whatsappLink" defaultValue={selectedGroup.whatsappLink ?? ''} placeholder="https://chat.whatsapp.com/..." />
            </label>
            <label className="field">
              <span>Descrição</span>
              <textarea name="description" rows={3} defaultValue={selectedGroup.description ?? ''} placeholder="Base do grupo e contexto de experiência." />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Salvar alterações</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'newRound' && selectedTest && (
        <ModalShell onClose={() => setModal(null)} title="Criar rodada" subtitle="NOVA RODADA">
          <form onSubmit={handleCreateRound} className="modal-form">
            <label className="field">
              <span>Nome da rodada</span>
              <input name="name" required placeholder="Ex.: Teste A/B" />
            </label>
            <label className="field">
              <span>Objetivo</span>
              <textarea name="objective" rows={3} placeholder="O que esta rodada deve validar?" />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Criar rodada</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'newAssignment' && selectedRound && (
        <ModalShell onClose={() => setModal(null)} title="Adicionar grupo à rodada" subtitle="ASSOCIAÇÃO">
          <form onSubmit={handleCreateAssignment} className="modal-form">
            <input type="hidden" name="roundId" value={selectedRound.id} />
            <label className="field">
              <span>Grupo</span>
              <select name="groupId" defaultValue="" required>
                <option value="" disabled>Selecione um grupo</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Experiência</span>
              <input name="experienceName" placeholder="Ex.: Nova tela de pagamento" />
            </label>
            <label className="field">
              <span>Versão</span>
              <input name="variant" placeholder="Ex.: A, B, revisada" />
            </label>
            <label className="field">
              <span>Data de início</span>
              <input name="startedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="field">
              <span>Observação</span>
              <textarea name="notes" rows={3} placeholder="Contexto relevante da participação." />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Salvar associação</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'newNote' && (selectedTest || selectedCustomer) && (
        <ModalShell onClose={() => setModal(null)} title={selectedCustomer ? 'Nova observação' : 'Nova anotação'} subtitle="OBSERVAÇÃO">
          <form onSubmit={selectedCustomer ? handleAddCustomerNote : handleCreateNote} className="modal-form">
            <label className="field">
              <span>Conteúdo</span>
              <textarea name="note" rows={5} required placeholder={selectedCustomer ? 'Descreva a conversa, interesse ou observação relevante.' : 'Descreva o comportamento, dilema ou comentário relevante.'} />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Salvar observação</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'finalizeRound' && selectedRound && (
        <ModalShell onClose={() => setModal(null)} title="Finalizar rodada" subtitle="RESULTADO DA RODADA">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              finishRound(selectedRound.id, values);
            }}
            className="modal-form"
          >
            <label className="field">
              <span>Resultado</span>
              <textarea name="result" rows={3} placeholder="O que aconteceu durante a rodada?" />
            </label>
            <label className="field">
              <span>Principais descobertas</span>
              <textarea name="learnings" rows={3} placeholder="Quais aprendizados foram obtidos?" />
            </label>
            <label className="field">
              <span>Problemas encontrados</span>
              <textarea name="problems" rows={3} placeholder="Quais problemas ou comportamentos inesperados apareceram?" />
            </label>
            <label className="field">
              <span>Próximos passos</span>
              <textarea name="nextSteps" rows={3} placeholder="O que precisa acontecer depois?" />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Finalizar rodada</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === 'finalizeTest' && selectedTest && (
        <ModalShell onClose={() => setModal(null)} title="Finalizar teste" subtitle="RESUMO FINAL">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              finishTest(selectedTest.id, values);
            }}
            className="modal-form"
          >
            <label className="field">
              <span>Resultado final</span>
              <textarea name="finalResult" rows={3} placeholder="O que aconteceu ao final do teste?" />
            </label>
            <label className="field">
              <span>Principais aprendizados</span>
              <textarea name="learnings" rows={3} placeholder="Quais aprendizados ficaram?" />
            </label>
            <label className="field">
              <span>Próximos passos</span>
              <textarea name="nextSteps" rows={3} placeholder="O que vem depois da validação?" />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="button primary">Finalizar teste</button>
            </div>
          </form>
        </ModalShell>
      )}

      {selectedRound && (
        <>
          <button type="button" className="drawer-scrim" aria-label="Fechar detalhe da rodada" onClick={() => setSelectedRoundId(null)} />
          <aside className="drawer round-drawer" aria-label="Detalhes da rodada">
            <div className="drawer-header">
              <button type="button" className="icon-button" onClick={() => setSelectedRoundId(null)}>
                <ArrowLeft size={18} />
              </button>
              <span>RODADA</span>
              <button type="button" className="icon-button" onClick={() => setSelectedRoundId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="drawer-content">
              <div className="drawer-title-row">
                <div>
                  <p className="eyebrow">RODADA</p>
                  <h2>{selectedRound.name}</h2>
                </div>
                <StatusBadge status={selectedRound.status} kind="round" onClick={() => advanceRoundStatus(selectedRound)} />
              </div>

              <div className="summary-grid">
                <div>
                  <span>Objetivo</span>
                  <strong>{selectedRound.objective || '—'}</strong>
                </div>
                <div>
                  <span>Início</span>
                  <strong>{formatDate(selectedRound.startedAt)}</strong>
                </div>
                <div>
                  <span>Duração</span>
                  <strong>{formatDuration(selectedRound.startedAt, selectedRound.completedAt ?? undefined)}</strong>
                </div>
              </div>

              <div className="section-row">
                <h3>Grupos participantes</h3>
                <button type="button" className="button outline small" onClick={() => setModal('newAssignment')}>
                  <Plus size={14} />
                  Adicionar grupo
                </button>
              </div>

              <div className="stack-list">
                {selectedRoundAssignments.length ? (
                  selectedRoundAssignments.map((assignment) => {
                    const group = groups.find((item) => item.id === assignment.groupId);
                    return (
                      <div key={assignment.id} className="assignment-card">
                        <div className="assignment-header">
                          <strong>{group?.name ?? 'Grupo não encontrado'}</strong>
                          <StatusBadge status={group?.status ?? 'active'} kind="group" />
                        </div>
                        <div className="assignment-meta">
                          <span>{group?.segmentation || 'Segmentação não informada'}</span>
                          <span>{group ? getGroupMemberCountLabel(group.id) : '0 clientes'}</span>
                        </div>
                        <div className="assignment-meta">
                          <span>Experiência: {assignment.experienceName || '—'}</span>
                          <span>Versão: {assignment.variant || '—'}</span>
                        </div>
                        <small>{assignment.notes || 'Sem observação'}</small>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState title="Nenhum grupo nesta rodada" description="Associe um grupo já cadastrado para começar a comparar versões e experiências." actionLabel="Adicionar grupo" onAction={() => setModal('newAssignment')} compact />
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: 'teal' | 'amber' | 'rose' | 'slate' }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function StatusBadge({ status, kind = 'test', onClick }: { status: string; kind?: 'test' | 'round' | 'group' | 'customer'; onClick?: () => void }) {
  const content = (
    <>
      <span className="status-dot" />
      {getStatusLabel(status, kind)}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`status-pill ${getStatusClass(status, kind)}`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <span className={`status-pill ${getStatusClass(status, kind)}`}>
      {content}
    </span>
  );
}

function EmptyState({ title, description, actionLabel, onAction, compact = false }: { title: string; description: string; actionLabel: string; onAction: () => void; compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <div className="illustration-box">
        <div className="ring" />
        <div className="sheet">
          <span />
          <span />
          <span />
        </div>
        <div className="plus-badge"><Plus size={14} /></div>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <button type="button" className="button primary" onClick={onAction}>{actionLabel}</button>
    </div>
  );
}

function TestCard({ test, onOpen }: { test: Test; onOpen: () => void }) {
  const roundCount = getRounds().filter((round) => round.testId === test.id).length;
  const groupCount = new Set(getAssignments().filter((assignment) => getRounds().some((round) => round.id === assignment.roundId && round.testId === test.id)).map((assignment) => assignment.groupId)).size;

  return (
    <button type="button" className="test-card" onClick={onOpen}>
      <div className="test-card-header">
        <div>
          <h3>{test.name}</h3>
          <span>{test.product || 'Produto não definido'}</span>
        </div>
        <StatusBadge status={test.status} kind="test" />
      </div>
      <p>{test.objective || test.description || 'Sem objetivo descrito.'}</p>
      <div className="test-card-metrics">
        <span>{roundCount} rodadas</span>
        <span>{groupCount} grupos</span>
      </div>
      <div className="test-card-footer">
        <span>Iniciado em {formatDate(test.startedAt ?? test.createdAt)}</span>
        <strong>{formatDuration(test.startedAt ?? test.createdAt, test.completedAt ?? undefined)}</strong>
      </div>
    </button>
  );
}

function GroupCard({ group, onOpen }: { group: WhatsAppGroup; onOpen: () => void }) {
  const memberCountLabel = getGroupMemberCountLabel(group.id);
  const testsCount = new Set(
    getAssignments()
      .filter((assignment) => assignment.groupId === group.id)
      .map((assignment) => getRounds().find((round) => round.id === assignment.roundId)?.testId)
      .filter(Boolean) as string[],
  ).size;

  return (
    <button type="button" className="group-card" onClick={onOpen}>
      <div className="group-card-header">
        <div>
          <h3>{group.name}</h3>
          <span>{group.segmentation || 'Segmentação não informada'} · {memberCountLabel}</span>
        </div>
        <StatusBadge status={group.status} kind="group" />
      </div>
      <p className="group-card-description">{group.description || 'Nenhuma descrição cadastrada.'}</p>
      <div className="group-card-footer">
        <span>{testsCount} testes realizados</span>
      </div>
    </button>
  );
}

function ModalShell({ children, title, subtitle, onClose }: { children: ReactNode; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="modal-scrim" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{subtitle}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default App;
