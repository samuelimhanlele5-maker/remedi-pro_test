import fs from 'fs';
import path from 'path';
import pg from 'pg';
import type { PoolClient } from 'pg';
import { hashPassword } from './auth.js';

export type CreatorAccessState = 'active' | 'trial' | 'expired' | 'disabled';

export interface User {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  role: 'student' | 'creator' | 'admin';
  avatarUrl?: string;
  bio?: string;
  disabled?: boolean;
  createdAt: string;
  creatorCode?: string;
  accessStatus?: CreatorAccessState;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  accessStartedAt?: string;
  accessExpiresAt?: string;
  accessDurationDays?: number;
  lastPaymentVerifiedAt?: string;
  trialQuizzesAllowed?: number; // free quizzes this creator started with
  trialQuizzesUsed?: number; // free quizzes used so far
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
  freeTrialQuizzes: number; // free quizzes for each new creator (set by admin)
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

export interface Question {
  id: string;
  quizId: string;
  subject: string;
  passage?: string;
  question: string;
  diagram?: string;
  options: string[];
  answer: string;
  marks?: number;
  order: number;
}

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
  scoreScale: number;
  accessType: 'public' | 'private';
  maxAttempts?: number; // public quizzes: attempts allowed per email (0 = unlimited)
  listedPublicly?: boolean; // private quizzes: also show in public lists (default off)
  opensAt?: string | null; // scheduled mock window start (ISO)
  closesAt?: string | null; // scheduled mock window end (ISO)
  windowHours?: number; // length of the window in hours (default 24)
  shareCode: string;
  leaderboardEnabled: boolean;
  calculatorEnabled?: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  participantName: string;
  participantEmail: string;
  userId?: string;
  selectedSubjects: string[];
  answers: Record<string, string>;
  subjectScores: Record<string, { total: number; correct: number; percentage: number; scaledScore: number }>;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  finalScore: number;
  scoreScale: number;
  formattedScore: string;
  timeUsedSeconds: number;
  startedAt: string;
  completedAt: string;
  hiddenFromLeaderboard?: boolean;
}

export interface LiveSession {
  id: string;
  quizId: string;
  participantName: string;
  participantEmail: string;
  selectedSubjects: string[];
  currentQuestionIndex: number;
  totalQuestions: number;
  startedAt: string;
  lastHeartbeat: string;
  status: 'active' | 'completed' | 'abandoned';
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
  
  // Access and Pricing (Requirement 8)
  accessType?: HubAccessType;
  membershipModel?: HubMembershipModel;
  membershipFee?: number;
  currency?: string;
  paymentInstructions?: string;

  // Hub profile (Phase 2)
  institution?: string;
  examBody?: string; // e.g. JAMB
  subjects?: string[]; // subjects offered
  maxSubjects?: number; // most subjects a student may select (0 = no limit)
  joinMode?: 'open' | 'approval';
  objectives?: string;
  hubCode?: string; // short code used in the shareable link

  // Joining Requirements (Requirement 4)
  compulsorySubjects?: string[];
  optionalSubjects?: string[];
  requiredOptionalCount?: number;

  // External Online Tutorial Links (Requirement 10)
  tutorialLinks?: TutorialLink[];

  // Attached Assessment Quizzes (Requirement 6)
  assessmentQuizIds?: string[];

  createdAt: string;
  updatedAt?: string;
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

  // active = full member, pending = waiting for the creator, rejected = declined
  status?: 'active' | 'pending' | 'rejected';

  // Membership & payment
  membershipType?: HubMembershipModel;
  isPaid?: boolean;

  // Member assessment records inside this hub (Requirement 5, 6, 7)
  completedAssessments?: MemberAssessmentRecord[];
  lastActiveAt?: string;
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

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  actor: string;
  timestamp: string;
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

export interface DatabaseSchema {
  registrations: Registration[];
  users: User[];
  quizzes: Quiz[];
  questions: Question[];
  attempts: QuizAttempt[];
  liveSessions: LiveSession[];
  learningHubs: LearningHub[];
  hubMembers: HubMember[];
  hubMaterials: HubMaterial[];
  follows: Follow[];
  auditLogs: AuditLog[];
  paymentRequests: PaymentRequest[];
  systemSettings: SystemSettings;
}

export function generateCreatorCode(existingCodes: string[] = []): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do {
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `REM-${rand}`;
  } while (existingCodes.includes(code));
  return code;
}

// When DATABASE_URL is set (Vercel + Neon/Supabase Postgres) data lives in Postgres.
// When it is not set (local dev), the app falls back to data/remedi_db.json as before.
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL, max: 2 }) : null;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'remedi_db.json');

const INITIAL_DB: DatabaseSchema = {
  registrations: [],
  users: [
    {
      id: 'usr_admin',
      email: 'samuelosemu5@gmail.com',
      password: hashPassword(process.env.ADMIN_PASSWORD || 'password123'),
      fullName: 'Samuel Osemu',
      role: 'admin',
      bio: 'Remedi Pro Lead Platform Administrator and Medical Educator',
      disabled: false,
      creatorCode: 'REM-ADMIN1',
      accessStatus: 'active',
      accessStartedAt: new Date(Date.now() - 3600 * 1000 * 24 * 60).toISOString(),
      accessExpiresAt: new Date(Date.now() + 3600 * 1000 * 24 * 365).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],
  quizzes: [],
  questions: [],
  attempts: [],
  liveSessions: [],
  learningHubs: [],
  hubMembers: [],
  hubMaterials: [],
  follows: [],
  auditLogs: [],
  paymentRequests: [],
  systemSettings: {
    paymentSystemEnabled: false, // Default: OFF (Remedi Pro runs completely free unless admin activates it)
    freeTrialEnabled: true,
    trialDurationDays: 14,
    paidAccessDurationDays: 30,
    freeTrialQuizzes: 3,
    requirePaymentForQuizCreation: true,
    requirePaymentForHubCreation: true,
    accessFeeAmount: 5000,
    currency: 'NGN',
    paymentMethod: 'manual_transfer',
    bankDetails: {
      bankName: 'Zenith Bank',
      accountName: 'Remedi Pro Educational Services',
      accountNumber: '1018923456',
      instructions: 'Transfer the access fee to the account above. Use your unique Creator Code as the payment narration or reference. After transfer, click "I Have Paid" and submit your reference for admin manual verification.',
      whatsappNumber: '+234 812 345 6789',
    },
  },
};

class DatabaseManager {
  private db: DatabaseSchema;

  public readonly usesPostgres = !!pool;
  private lock: Promise<void> = Promise.resolve();
  private tableReady = false;
  private session: {
    client: PoolClient;
    write: boolean;
    snapshot: string;
    releaseLock: () => void;
  } | null = null;

  constructor() {
    this.db = pool ? this.normalize({}) : this.load();
    this.ensureCreatorIntegrity();
  }

  // ---- Postgres request lifecycle (used by server/app.ts) ----
  // One request at a time per server instance; write requests also take a row lock
  // in the database so two instances can never overwrite each other's changes.
  public async beginRequest(write: boolean): Promise<void> {
    if (!pool) return;
    const prev = this.lock;
    let releaseLock!: () => void;
    this.lock = new Promise<void>((r) => (releaseLock = r));
    await prev;
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      if (!this.tableReady) {
        await client.query(
          'CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())'
        );
        this.tableReady = true;
      }
      if (write) await client.query('BEGIN');
      const lockSql = write ? ' FOR UPDATE' : '';
      let res = await client.query('SELECT data FROM app_state WHERE id = 1' + lockSql);
      if (write && res.rowCount === 0) {
        await client.query('INSERT INTO app_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [
          JSON.stringify(this.normalize({})),
        ]);
        res = await client.query('SELECT data FROM app_state WHERE id = 1 FOR UPDATE');
      }
      this.db = this.normalize(res.rowCount ? res.rows[0].data : {});
      this.ensureCreatorIntegrity();
      this.session = { client, write, snapshot: JSON.stringify(this.db), releaseLock };
    } catch (err) {
      try {
        if (client && write) await client.query('ROLLBACK');
      } catch {}
      if (client) client.release();
      releaseLock();
      throw err;
    }
  }

  public async endRequest(commit: boolean): Promise<void> {
    const s = this.session;
    if (!s) return;
    this.session = null;
    try {
      if (s.write) {
        if (commit && JSON.stringify(this.db) !== s.snapshot) {
          await s.client.query('UPDATE app_state SET data = $1, updated_at = now() WHERE id = 1', [
            JSON.stringify(this.db),
          ]);
        }
        await s.client.query(commit ? 'COMMIT' : 'ROLLBACK');
      }
    } catch (err) {
      try {
        await s.client.query('ROLLBACK');
      } catch {}
      s.client.release();
      s.releaseLock();
      throw err;
    }
    s.client.release();
    s.releaseLock();
  }

  private normalize(parsed: any): DatabaseSchema {
    // Ensure all collections exist and enrich with new features
    const loadedHubs: LearningHub[] = (parsed.learningHubs || INITIAL_DB.learningHubs).map((h: any) => ({
      ...h,
      accessType: h.accessType || 'free',
      membershipModel: h.membershipModel || 'free',
      compulsorySubjects: h.compulsorySubjects || ['Biology', 'Chemistry'],
      optionalSubjects: h.optionalSubjects || ['Physics', 'Mathematics', 'English'],
      requiredOptionalCount: h.requiredOptionalCount ?? 1,
      tutorialLinks: h.tutorialLinks || [],
      assessmentQuizIds: h.assessmentQuizIds || (h.id === 'hub_stem_apex' ? ['quiz_utme_mock'] : []),
    }));

    const loadedMembers: HubMember[] = (parsed.hubMembers || INITIAL_DB.hubMembers).map((m: any) => ({
      ...m,
      selectedSubjects: m.selectedSubjects && m.selectedSubjects.length > 0 ? m.selectedSubjects : ['Biology', 'Chemistry', 'Physics'],
      membershipType: m.membershipType || 'free',
      completedAssessments: m.completedAssessments || [],
    }));

    const loadedUsers: User[] = (parsed.users || INITIAL_DB.users).map((u: any) => ({
      ...u,
      onlineTutorialLinks: u.onlineTutorialLinks || (u.id === 'usr_creator_1' ? [
        {
          id: 'ctut_1',
          platform: 'youtube',
          title: 'Dr. Evelyn Clark Official Science Channel',
          url: 'https://youtube.com',
        },
        {
          id: 'ctut_2',
          platform: 'zoom',
          title: 'Remedi Pro Science Masterclass Virtual Room',
          url: 'https://zoom.us',
        }
      ] : []),
    }));

    const schema: DatabaseSchema = {
      users: loadedUsers,
    registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
      quizzes: parsed.quizzes || INITIAL_DB.quizzes,
      questions: parsed.questions || INITIAL_DB.questions,
      attempts: parsed.attempts || INITIAL_DB.attempts,
      liveSessions: parsed.liveSessions || [],
      learningHubs: loadedHubs,
      hubMembers: loadedMembers,
      hubMaterials: (parsed.hubMaterials || INITIAL_DB.hubMaterials).map((mat: any) => ({
        ...mat,
        isMemberOnly: mat.isMemberOnly !== false,
      })),
      follows: parsed.follows || INITIAL_DB.follows || [],
      auditLogs: parsed.auditLogs || INITIAL_DB.auditLogs,
      paymentRequests: parsed.paymentRequests || INITIAL_DB.paymentRequests,
      systemSettings: {
        ...INITIAL_DB.systemSettings,
        ...(parsed.systemSettings || {}),
        bankDetails: {
          ...INITIAL_DB.systemSettings.bankDetails,
          ...(parsed.systemSettings?.bankDetails || {}),
        },
      },
    };
    return schema;
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return this.normalize(parsed);
      }
    } catch (err) {
      console.error('Failed to load database, using initial dataset:', err);
    }
    this.save(INITIAL_DB);
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }

  // Ensure every creator and admin has a unique creatorCode, accessStatus, and evaluates expiry
  public ensureCreatorIntegrity() {
    const existingCodes = this.db.users.map((u) => u.creatorCode).filter(Boolean) as string[];
    let changed = false;

    this.db.users.forEach((u) => {
      if (u.role === 'creator' || u.role === 'admin') {
        if (!u.creatorCode) {
          if (u.id === 'usr_creator_1') u.creatorCode = 'REM-8K29X';
          else if (u.id === 'usr_admin') u.creatorCode = 'REM-ADMIN1';
          else {
            u.creatorCode = generateCreatorCode(existingCodes);
            existingCodes.push(u.creatorCode);
          }
          changed = true;
        }

        if (!u.accessStatus) {
          u.accessStatus = 'active';
          u.accessStartedAt = u.createdAt;
          u.accessExpiresAt = new Date(Date.now() + 3600 * 1000 * 24 * 30).toISOString();
          changed = true;
        }

        // Automatic expiry check: if expiry date has passed, mark expired!
        if (u.role === 'creator' && u.accessExpiresAt) {
          const isExpired = new Date(u.accessExpiresAt).getTime() < Date.now();
          if (isExpired && u.accessStatus !== 'expired') {
            u.accessStatus = 'expired';
            changed = true;
          } else if (!isExpired && u.accessStatus === 'expired') {
            u.accessStatus = 'active';
            changed = true;
          }
        }
      }
    });

    if (changed) {
      this.save(this.db);
    }
  }

  private save(data: DatabaseSchema) {
    if (pool) return; // Postgres mode saves once at the end of each request
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  public getData(): DatabaseSchema {
    this.ensureCreatorIntegrity();
    return this.db;
  }

  public update(mutator: (db: DatabaseSchema) => void): DatabaseSchema {
    mutator(this.db);
    this.ensureCreatorIntegrity();
    this.save(this.db);
    return this.db;
  }

  // Access check for creators
  public checkCreatorAccess(userId?: string): {
    paymentSystemEnabled: boolean;
    canCreateQuiz: boolean;
    canCreateHub: boolean;
    status: CreatorAccessState;
    message?: string;
  } {
    const settings = this.db.systemSettings;
    // If master switch is OFF, no creator is ever blocked!
    if (!settings.paymentSystemEnabled) {
      return {
        paymentSystemEnabled: false,
        canCreateQuiz: true,
        canCreateHub: true,
        status: 'active',
      };
    }

    if (!userId) {
      return {
        paymentSystemEnabled: true,
        canCreateQuiz: false,
        canCreateHub: false,
        status: 'expired',
        message: 'Authentication required.',
      };
    }

    const user = this.db.users.find((u) => u.id === userId);
    if (!user) {
      return {
        paymentSystemEnabled: true,
        canCreateQuiz: false,
        canCreateHub: false,
        status: 'expired',
        message: 'User account not found.',
      };
    }

    // Admins are exempt
    if (user.role === 'admin') {
      return {
        paymentSystemEnabled: true,
        canCreateQuiz: true,
        canCreateHub: true,
        status: 'active',
      };
    }

    // Students do not have creator permissions
    if (user.role === 'student') {
      return {
        paymentSystemEnabled: true,
        canCreateQuiz: false,
        canCreateHub: false,
        status: 'expired',
        message: 'Student accounts cannot create quizzes or learning hubs.',
      };
    }

    // Check expiry
    if (user.accessExpiresAt && new Date(user.accessExpiresAt).getTime() < Date.now()) {
      user.accessStatus = 'expired';
    }

    if (user.disabled) {
      return {
        paymentSystemEnabled: true,
        canCreateQuiz: false,
        canCreateHub: false,
        status: 'disabled',
        message: 'Your account has been disabled by platform administration.',
      };
    }

    // Free trial: a number of free quizzes instead of a number of days
    if (user.accessStatus === 'trial') {
      const allowed = user.trialQuizzesAllowed ?? settings.freeTrialQuizzes ?? 0;
      const used = user.trialQuizzesUsed ?? 0;
      if (used < allowed) {
        return {
          paymentSystemEnabled: true,
          canCreateQuiz: true,
          canCreateHub: true,
          status: 'trial',
          message: `Free trial: ${allowed - used} of ${allowed} quizzes left.`,
        };
      }
      return {
        paymentSystemEnabled: true,
        canCreateQuiz: !settings.requirePaymentForQuizCreation,
        canCreateHub: !settings.requirePaymentForHubCreation,
        status: 'expired',
        message: 'Your free trial quizzes are used up. Please activate your subscription to create more.',
      };
    }

    if (user.accessStatus === 'expired') {
      return {
        paymentSystemEnabled: true,
        canCreateQuiz: !settings.requirePaymentForQuizCreation,
        canCreateHub: !settings.requirePaymentForHubCreation,
        status: 'expired',
        message: 'Creator access expired. Please activate or renew your subscription.',
      };
    }

    return {
      paymentSystemEnabled: true,
      canCreateQuiz: true,
      canCreateHub: true,
      status: user.accessStatus || 'active',
    };
  }
}

export const dbManager = new DatabaseManager();
