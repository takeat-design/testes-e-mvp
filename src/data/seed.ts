import type { GroupAssignment, Test, TestNote, TestRound, WhatsAppGroup } from '../types';

export function seedInitialData() {
  const test: Test = {
    id: 'test-payment-flow',
    name: 'Nova tela de pagamento',
    description: 'Validar uma nova experiência de pagamento pelo celular.',
    objective: 'Validar se os clientes conseguem realizar o pagamento diretamente pelo celular.',
    hypothesis: 'Uma tela mais enxuta e orientada por contexto deve reduzir atrito no checkout.',
    product: 'Cardápio Digital',
    responsible: 'Thomas',
    status: 'active',
    createdAt: '2026-09-28T00:00:00.000Z',
    startedAt: '2026-09-28T00:00:00.000Z',
    finalResult: '',
    learnings: '',
    nextSteps: '',
  };

  const groups: WhatsAppGroup[] = [
    {
      id: 'group-restaurantes-p',
      name: 'Restaurantes P',
      description: 'Grupo de restaurantes premium para experimentação de checkout.',
      segmentation: 'P',
      whatsappLink: 'https://wa.me/5511999999999',
      memberCount: 18,
      status: 'active',
      notes: 'Clientes com operação mais sensível e maior volume de pedidos.',
      createdAt: '2026-09-10T00:00:00.000Z',
    },
    {
      id: 'group-restaurantes-g',
      name: 'Restaurantes G',
      description: 'Grupo base para comparação em volume moderado.',
      segmentation: 'G',
      whatsappLink: 'https://wa.me/5511888888888',
      memberCount: 15,
      status: 'active',
      notes: 'Grupo mais estável para validação de fluxo.',
      createdAt: '2026-09-12T00:00:00.000Z',
    },
  ];

  const round: TestRound = {
    id: 'round-ab-01',
    testId: 'test-payment-flow',
    name: 'Teste A/B',
    objective: 'Comparar a tela A e a tela B em uma amostra equivalente.',
    status: 'active',
    startedAt: '2026-09-28T00:00:00.000Z',
    notes: 'Monitorar dúvidas de fluxo e volume de cliques até confirmação.',
  };

  const assignments: GroupAssignment[] = [
    {
      id: 'assignment-restaurantes-p',
      roundId: 'round-ab-01',
      groupId: 'group-restaurantes-p',
      variant: 'A',
      experienceName: 'Nova tela de pagamento',
      startedAt: '2026-09-28T00:00:00.000Z',
      notes: 'Fluxo com proposta simplificada e foco em confirmação.',
    },
    {
      id: 'assignment-restaurantes-g',
      roundId: 'round-ab-01',
      groupId: 'group-restaurantes-g',
      variant: 'B',
      experienceName: 'Nova tela de pagamento',
      startedAt: '2026-09-28T00:00:00.000Z',
      notes: 'Versão com mais contexto e explicações no caminho.',
    },
  ];

  const notes: TestNote[] = [
    {
      id: 'note-1',
      testId: 'test-payment-flow',
      roundId: 'round-ab-01',
      groupAssignmentId: 'assignment-restaurantes-p',
      content: 'Cliente relatou dificuldade para encontrar o botão de pagamento em alguns dispositivos.',
      createdAt: '2026-09-30T14:32:00.000Z',
    },
    {
      id: 'note-2',
      testId: 'test-payment-flow',
      roundId: 'round-ab-01',
      groupAssignmentId: 'assignment-restaurantes-g',
      content: 'Versão B gerou menos dúvida inicial, mas alguns grupos sentiram que a confirmação ficou distante.',
      createdAt: '2026-09-30T16:10:00.000Z',
    },
  ];

  return {
    tests: [test],
    groups,
    rounds: [round],
    assignments,
    notes,
  };
}
