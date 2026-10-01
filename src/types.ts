export type TestStatus = 'planned' | 'active' | 'completed' | 'archived';
export type RoundStatus = 'planned' | 'active' | 'completed';
export type GroupStatus = 'active' | 'paused' | 'closed';
export type RecruitmentStatus = 'not_contacted' | 'contacted' | 'no_response' | 'interested' | 'accepted' | 'declined';

export type Test = {
  id: string;
  name: string;
  description?: string;
  objective?: string;
  hypothesis?: string;
  product?: string;
  responsible?: string;
  status: TestStatus;
  createdAt: string;
  startedAt?: string;
  expectedEndAt?: string;
  resourceUrl?: string;
  completedAt?: string;
  finalResult?: string;
  learnings?: string;
  nextSteps?: string;
};

export type WhatsAppGroup = {
  id: string;
  name: string;
  description?: string;
  segmentation?: string;
  whatsappLink?: string;
  memberCount?: number;
  status: GroupStatus;
  notes?: string;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  contactName?: string;
  whatsapp?: string;
  email?: string;
  sourceLists: string[];
  recruitmentStatus: RecruitmentStatus;
  notes?: string;
  raw?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type RecruitmentHistory = {
  id: string;
  customerId: string;
  fromStatus?: RecruitmentStatus;
  toStatus: RecruitmentStatus;
  createdAt: string;
  note?: string;
};

export type GroupMember = {
  id: string;
  groupId: string;
  customerId: string;
  addedAt: string;
};

export type TestRound = {
  id: string;
  testId: string;
  name: string;
  objective?: string;
  status: RoundStatus;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  result?: string;
  learnings?: string;
  nextSteps?: string;
};

export type GroupAssignment = {
  id: string;
  roundId: string;
  groupId: string;
  variant?: string;
  experienceName?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  result?: string;
};

export type TestNote = {
  id: string;
  testId?: string;
  roundId?: string;
  groupAssignmentId?: string;
  content: string;
  createdAt: string;
};
