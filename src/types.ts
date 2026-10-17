export type UserRole = 'student' | 'creator' | 'admin';
export type CreatorAccessState = 'active' | 'trial' | 'expired' | 'disabled';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  bio?: string;
  disabled?: boolean;
  createdAt: string;
  // Creator unique code and access control
  creatorCode?: string; // e.g. "REM-8K29X"
  accessStatus?: CreatorAccessState;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  accessStartedAt?: string;
  accessExpiresAt?: string;
  accessDurationDays?: number;
  trialQuizzesAllowed?: number;
  trialQuizzesUsed?: number;
  lastPaymentVerifiedAt?: string;
  onlineTutorialLinks?: TutorialLink[];
  followerCount?: number;
  isFollowing?: boolean;
}

export type HubAccessType = 'free' | 'paid';
export type HubMembershipModel = 'free' | 'monthly' | 'yearly' | 'lifetime';

export interface TutorialLink {
  id: string;
  platform: 'youtube' | 'google_meet' | 'zoom' | 'other';
  title: string;
  url: string;
}

export interface MemberAssessmentRecord {
  id: string;
  quizId: string;
  quizTitle: string;
  subjectScores?: Record<string, { total: number; correct: number; percentage: number }>;
  finalScore: number;
  scoreScale: number;
  percentage: number;
  completedAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followerName: string;
  followerEmail: string;
  creatorId: string;
  createdAt: string;
}

export interface CreatorDashboardStats {
  creatorId: string;
  creatorName: string;
  totalQuizzes: number;
  totalParticipants: number;
  averageScore: number;
  learningHubCount: number;
  totalHubMembers: number;
  followerCount: number;
}

export interface BankPaymentDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  whatsappNumber: string;
}

export interface SystemSettings {
  paymentSystemEnabled: boolean; // Master switch: ON / OFF
  freeTrialEnabled: boolean;
  trialDurationDays: number;
  freeTrialQuizzes: number;
  paidAccessDurationDays: number;
  requirePaymentForQuizCreation: boolean;
  requirePaymentForHubCreation: boolean;
  accessFeeAmount: number;
  currency: string;
  paymentMethod: 'manual_transfer';
  bankDetails: BankPaymentDetails;
}

export interface PaymentRequest {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  creatorCode: string;
  amount: number;
  currency: string;
  paymentMethod: 'manual_transfer';
  senderName: string;
  senderBank?: string;
  referenceNumber: string;
  notes?: string;
  receiptUrl?: string;
  status: 'pending' | 'verified' | 'rejected';
  requestedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  durationGrantedDays?: number;
}

export interface CreatorSummary {
  id: string;
  email: string;
  fullName: string;
  creatorCode: string;
  role: string;
  createdAt: string;
  disabled: boolean;
  accessStatus: CreatorAccessState;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  accessStartedAt?: string;
  accessExpiresAt?: string;
  accessDurationDays?: number;
  trialQuizzesAllowed?: number;
  trialQuizzesUsed?: number;
  quizzesCount: number;
  totalParticipants: number;
  learningHubCount: number;
  pendingRequestsCount: number;
  latestPaymentRequest?: PaymentRequest | null;
}

export interface CreatorAccessStatus {
  paymentSystemEnabled: boolean;
  userRole: UserRole;
  creatorCode?: string;
  accessStatus: CreatorAccessState;
  accessExpiresAt?: string | null;
  trialExpiresAt?: string | null;
  trialQuizzesAllowed?: number;
  trialQuizzesUsed?: number;
  userId?: string;
  canCreateQuiz: boolean;
  canCreateHub: boolean;
  accessFeeAmount: number;
  currency: string;
  bankDetails: BankPaymentDetails;
  pendingRequest?: PaymentRequest | null;
}

export interface Question {
  id: string;
  quizId?: string;
  subject: string;
  passage?: string;
  question: string;
  diagram?: string;
  options: string[];
  answer: string;
  marks?: number;
  order: number;
}

export type ScoreScale = 100 | 400 | 500 | 700 | 7000 | number;

export interface Quiz {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  coverImage?: string;
  subjects: string[];
  compulsorySubjects: string[];
  optionalSubjects: string[];
  requiredOptionalCount: number;
  durationMinutes: number | null;
  scoreScale: ScoreScale;
  accessType: 'public' | 'private';
  maxAttempts?: number;
  listedPublicly?: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
  windowHours?: number;
  shareCode: string;
  leaderboardEnabled: boolean;
  calculatorEnabled?: boolean;
  isPublished: boolean;
  participantCount?: number;
  avgScore?: number;
  questionCount?: number;
  questions?: Question[];
  createdAt: string;
  updatedAt: string;
}

export interface SubjectScore {
  total: number;
  correct: number;
  percentage: number;
  scaledScore: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  participantName: string;
  participantEmail: string;
  userId?: string;
  selectedSubjects: string[];
  answers: Record<string, string>;
  subjectScores: Record<string, SubjectScore>;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  finalScore: number;
  scoreScale: ScoreScale;
  formattedScore: string;
  timeUsedSeconds: number;
  startedAt: string;
  completedAt: string;
  hiddenFromLeaderboard?: boolean;
}

export interface LiveParticipant {
  id: string;
  name: string;
  email: string;
  selectedSubjects: string[];
  currentQuestion: number;
  totalQuestions: number;
  progress: string;
  startedAt: string;
  status: string;
}

export interface LeaderboardEntry {
  rank: number;
  attemptId: string;
  student: string;
  email: string;
  subjects: string;
  score: string;
  numericScore: number;
  scale: number;
  timeUsedSeconds: number;
  completedAt: string;
}

export interface LearningHub {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  title: string;
  description: string;
  subject: string;
  category?: 'study_group' | 'educational_community' | 'tutorial_coaching' | 'institution' | 'exam_prep' | 'general';
  coverColor?: string;
  isPublic: boolean;
  memberCount?: number;
  materialCount?: number;
  institution?: string;
  examBody?: string;
  subjects?: string[];
  maxSubjects?: number;
  joinMode?: 'open' | 'approval';
  objectives?: string;
  hubCode?: string;
  pendingCount?: number;
  myStatus?: 'owner' | 'active' | 'pending' | 'rejected' | null;
  myMembership?: HubMember | null;
  createdAt: string;

  // Requirement 8: Free or Paid access & Membership Model
  accessType?: HubAccessType;
  membershipModel?: HubMembershipModel;
  membershipFee?: number;
  currency?: string;
  paymentInstructions?: string;

  // Requirement 4: Creator defines compulsory & optional subjects
  compulsorySubjects?: string[];
  optionalSubjects?: string[];
  requiredOptionalCount?: number;

  // Requirement 10: Online tutorial links
  tutorialLinks?: TutorialLink[];

  // Requirement 6: Linked assessment quizzes
  assessmentQuizIds?: string[];
}

export interface HubMaterial {
  id: string;
  hubId: string;
  creatorId: string;
  title: string;
  description: string;
  type: 'note' | 'tutorial' | 'guide' | 'quiz_link';
  content: string;
  quizId?: string;
  isMemberOnly?: boolean;
  createdAt: string;
}

export interface HubMember {
  id: string;
  hubId: string;
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: string;

  // Selected subjects chosen by member upon joining (Requirement 4 & 5)
  selectedSubjects?: string[];
  status?: 'active' | 'pending' | 'rejected';

  // Membership & payment
  membershipType?: HubMembershipModel;
  isPaid?: boolean;

  // Member assessment records inside this hub (Requirement 5, 6, 7)
  completedAssessments?: MemberAssessmentRecord[];
  lastActiveAt?: string;
}

export interface StudentAnalytics {
  studentEmail: string;
  totalAttempts: number;
  subjectPerformance: {
    subject: string;
    totalQuestions: number;
    correctQuestions: number;
    accuracyPercentage: number;
  }[];
  hasEnoughData: boolean;
  strongAreas: string[] | null;
  strongMessage: string;
  weakAreas: string[] | null;
  weakMessage: string;
  timeline: {
    date: string;
    quizTitle: string;
    score: number;
    scale: number;
    percentage: number;
  }[];
  recentAttempts: QuizAttempt[];
}

export interface AdminStats {
  totalUsers: number;
  totalCreators: number;
  activeCreators: number;
  expiredCreators: number;
  totalQuizzes: number;
  totalParticipants: number;
  activeQuizzes: number;
  totalHubs: number;
  pendingPaymentRequests: number;
  auditLogs: {
    id: string;
    action: string;
    details: string;
    actor: string;
    timestamp: string;
  }[];
}

export interface Registration {
  id: string;
  quizId: string;
  name: string;
  email: string;
  phone: string;
  code: string;
  status: 'active' | 'cancelled';
  createdAt: string;
  usedAt?: string;
  attemptId?: string;
}
