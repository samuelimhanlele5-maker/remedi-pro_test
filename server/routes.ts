import { randomInt } from 'crypto';
import { hashPassword, verifyPassword, signToken, verifyToken, safeEqual } from './auth.js';
import { Router, Request, Response } from 'express';
import {
  dbManager,
  User,
  Quiz,
  Question,
  QuizAttempt,
  LiveSession,
  LearningHub,
  HubMember,
  HubMaterial,
  Follow,
  TutorialLink,
  MemberAssessmentRecord,
  AuditLog,
  PaymentRequest,
  SystemSettings,
  generateCreatorCode,
  Registration,
} from './db.js';

export const apiRouter = Router();

// Helper to generate unique IDs
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// Helper to clean numeric inputs safely
export function parseNullableInt(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const parsed = parseInt(String(val).trim(), 10);
  return isNaN(parsed) ? null : parsed;
}

// Helper to extract the authenticated user from the signed login token (Authorization: Bearer ...)
export function getAuthUser(req: Request): User | null {
  const header = String(req.headers['authorization'] || '');
  if (!header.startsWith('Bearer ')) return null;
  const userId = verifyToken(header.slice(7).trim());
  if (!userId) return null;
  const db = dbManager.getData();
  return db.users.find((u) => u.id === userId) || null;
}

// Middleware: Enforce admin role strictly on backend (Requirement 10)
export function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please log in as an administrator.' });
  }
  if (user.role !== 'admin' || user.disabled) {
    return res.status(403).json({ error: 'Access forbidden: Administrator privileges required.' });
  }
  next();
}

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = dbManager.getData();

  const existing = db.users.find((u) => u.email === cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists.' });
  }

  const assignedRole = role === 'admin' && cleanEmail === 'samuelosemu5@gmail.com' 
    ? 'admin' 
    : (role === 'creator' ? 'creator' : 'student');

  const isCreatorOrAdmin = assignedRole === 'creator' || assignedRole === 'admin';
  const existingCodes = db.users.map((u) => u.creatorCode).filter(Boolean) as string[];
  const creatorCode = isCreatorOrAdmin ? generateCreatorCode(existingCodes) : undefined;
  const regSettings = dbManager.getData().systemSettings;
  const trialQuizzes = regSettings.freeTrialEnabled ? Math.max(0, regSettings.freeTrialQuizzes ?? 0) : 0;
  // Admin: active for a year. Creators: start the free trial set by the admin (a number of free quizzes).
  const accessStatus =
    assignedRole === 'admin' ? 'active' : assignedRole === 'creator' ? (trialQuizzes > 0 ? 'trial' : 'expired') : undefined;
  const accessStartedAt = isCreatorOrAdmin ? new Date().toISOString() : undefined;
  const accessExpiresAt =
    assignedRole === 'admin' ? new Date(Date.now() + 3600 * 1000 * 24 * 365).toISOString() : undefined;

  const newUser: User = {
    id: generateId('usr'),
    email: cleanEmail,
    password: hashPassword(password.trim()),
    fullName: fullName.trim(),
    role: assignedRole,
    disabled: false,
    creatorCode,
    accessStatus,
    accessStartedAt,
    accessExpiresAt,
    accessDurationDays: assignedRole === 'admin' ? 365 : undefined,
    trialQuizzesAllowed: assignedRole === 'creator' ? trialQuizzes : undefined,
    trialQuizzesUsed: assignedRole === 'creator' ? 0 : undefined,
    createdAt: new Date().toISOString(),
  };

  dbManager.update((state) => {
    state.users.push(newUser);
    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'USER_REGISTER',
      details: `User ${newUser.fullName} (${newUser.email}) registered as ${newUser.role}${creatorCode ? ` with code ${creatorCode}` : ''}.`,
      actor: newUser.email,
      timestamp: new Date().toISOString(),
    });
  });

  const { password: _, ...userSafe } = newUser;
  return res.status(201).json({ user: userSafe, token: signToken(newUser.id) });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = dbManager.getData();
  const user = db.users.find((u) => u.email === cleanEmail);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // The admin password is controlled by the ADMIN_PASSWORD setting on the server
  let passwordOk = false;
  let legacyHash = false;
  if (user.id === 'usr_admin' && process.env.ADMIN_PASSWORD) {
    passwordOk = safeEqual(password.trim(), process.env.ADMIN_PASSWORD);
  } else if (user.id === 'usr_admin' && process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Admin login is not configured yet. Set ADMIN_PASSWORD on the server.' });
  } else {
    const v = verifyPassword(password.trim(), user.password);
    passwordOk = v.ok;
    legacyHash = v.ok && v.legacy;
  }
  if (!passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (legacyHash) {
    dbManager.update((state) => {
      const t = state.users.find((u) => u.id === user.id);
      if (t) t.password = hashPassword(password.trim());
    });
  }

  if (user.disabled) {
    return res.status(403).json({ error: 'This account has been disabled by platform administration.' });
  }

  const { password: _, ...userSafe } = user;
  return res.json({ user: userSafe, token: signToken(user.id) });
});

apiRouter.post('/auth/reset-password', (req: Request, res: Response) => {
  const { email, newPassword, currentPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({
      error: 'Password reset by email is not available yet. Please contact the platform admin to reset your password.',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (authUser.email !== cleanEmail && authUser.role !== 'admin') {
    return res.status(403).json({ error: 'You can only change your own password.' });
  }
  const db = dbManager.getData();
  const user = db.users.find((u) => u.email === cleanEmail);

  if (!user) {
    return res.status(404).json({ error: 'No user account found with that email address.' });
  }

  if (authUser.id === user.id) {
    if (user.id === 'usr_admin' && process.env.ADMIN_PASSWORD) {
      return res.status(400).json({ error: 'The admin password is changed in the Vercel settings (ADMIN_PASSWORD).' });
    }
    if (!verifyPassword(String(currentPassword || '').trim(), user.password).ok) {
      return res.status(403).json({ error: 'Your current password is not correct.' });
    }
  }

  dbManager.update((state) => {
    const target = state.users.find((u) => u.email === cleanEmail);
    if (target) {
      target.password = hashPassword(newPassword.trim());
    }
    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'PASSWORD_RESET',
      details: `Password reset for user ${cleanEmail}.`,
      actor: cleanEmail,
      timestamp: new Date().toISOString(),
    });
  });

  return res.json({ message: 'Password has been successfully updated.' });
});

apiRouter.put('/users/:id/profile', (req: Request, res: Response) => {
  const { id } = req.params;
  const { fullName, bio, role } = req.body;
  const authUser = getAuthUser(req);
  if (!authUser || (authUser.id !== id && authUser.role !== 'admin')) {
    return res.status(403).json({ error: 'You can only edit your own profile.' });
  }
  const db = dbManager.getData();
  const user = db.users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  dbManager.update((state) => {
    const target = state.users.find((u) => u.id === id);
    if (target) {
      if (fullName) target.fullName = fullName.trim();
      if (bio !== undefined) target.bio = bio.trim();
      if (role && (role === 'student' || role === 'creator')) {
        target.role = role;
        if (role === 'creator') {
          if (!target.creatorCode) {
            const existingCodes = state.users.map((u) => u.creatorCode).filter(Boolean) as string[];
            target.creatorCode = generateCreatorCode(existingCodes);
          }
          if (!target.accessStatus) {
            target.accessStatus = 'active';
            target.accessStartedAt = new Date().toISOString();
            target.accessExpiresAt = new Date(Date.now() + 3600 * 1000 * 24 * 30).toISOString();
            target.accessDurationDays = 30;
          }
        }
      }
    }
  });

  const updated = dbManager.getData().users.find((u) => u.id === id);
  const { password: _, ...userSafe } = updated!;
  return res.json({ user: userSafe });
});

// Admin list users
apiRouter.get('/users', requireAdmin, (req: Request, res: Response) => {
  const db = dbManager.getData();
  const list = db.users.map(({ password, ...u }) => u);
  return res.json({ users: list });
});

// Admin toggle disable user
apiRouter.put('/users/:id/toggle-disabled', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  let status = false;

  dbManager.update((state) => {
    const target = state.users.find((u) => u.id === id);
    if (target) {
      target.disabled = !target.disabled;
      status = target.disabled;
      state.auditLogs.unshift({
        id: generateId('log'),
        action: 'USER_STATUS_CHANGE',
        details: `User ${target.email} was ${target.disabled ? 'disabled' : 'enabled'}.`,
        actor: 'Admin',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return res.json({ id, disabled: status });
});

// ==========================================
// 2. QUIZZES & QUESTIONS
// ==========================================

// Get all quizzes (optional filter by creatorId or creatorOnly)
apiRouter.get('/quizzes', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const creatorId = req.query.creatorId as string;
  const creatorOnly = req.query.creatorOnly === 'true';
  const db = dbManager.getData();

  let list = db.quizzes;
  if (creatorId) {
    list = list.filter((q) => q.creatorId === creatorId);
  } else if (creatorOnly && authUser) {
    list = list.filter((q) => q.creatorId === authUser.id);
  }

  // Private quizzes are hidden from every list except for the owner and admin
  {
    list = list.filter(
      (q) =>
        q.accessType !== 'private' ||
        (!!authUser && (authUser.role === 'admin' || authUser.id === q.creatorId))
    );
  }

  // Calculate summary metrics for creator dashboard
  const enriched = list.map((quiz) => {
    const attempts = db.attempts.filter((a) => a.quizId === quiz.id);
    const participantCount = attempts.length;
    const avgScore = participantCount > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.finalScore / a.scoreScale) * 100, 0) / participantCount)
      : 0;

    const questionCount = db.questions.filter((q) => q.quizId === quiz.id).length;

    return {
      ...quiz,
      participantCount,
      avgScore, // percentage
      questionCount,
    };
  });

  return res.json({ quizzes: enriched });
});

// Requirement 1 & 13: Creator Dashboard Statistics — STRICT CREATOR OWNERSHIP
apiRouter.get('/creator/stats', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  const targetCreatorId = (req.query.creatorId as string) || authUser?.id;

  if (!targetCreatorId) {
    return res.status(401).json({ error: 'Creator authentication required.' });
  }

  const db = dbManager.getData();
  const creator = db.users.find((u) => u.id === targetCreatorId);
  if (!creator) {
    return res.status(404).json({ error: 'Creator account not found.' });
  }

  // Filter STRICTLY by this creator
  const creatorQuizzes = db.quizzes.filter((q) => q.creatorId === targetCreatorId);
  const quizIds = creatorQuizzes.map((q) => q.id);
  const creatorAttempts = db.attempts.filter((a) => quizIds.includes(a.quizId));

  const totalQuizzes = creatorQuizzes.length;
  const totalParticipants = creatorAttempts.length;

  const totalScorePct = creatorAttempts.reduce((sum, a) => {
    return sum + (a.scoreScale > 0 ? (a.finalScore / a.scoreScale) * 100 : 0);
  }, 0);
  const averageScore = totalParticipants > 0 ? Math.round(totalScorePct / totalParticipants) : 0;

  const creatorHubs = db.learningHubs.filter((h) => h.creatorId === targetCreatorId);
  const hubIds = creatorHubs.map((h) => h.id);
  const totalHubMembers = db.hubMembers.filter((m) => hubIds.includes(m.hubId)).length;

  const followerCount = (db.follows || []).filter((f) => f.creatorId === targetCreatorId).length;

  return res.json({
    stats: {
      creatorId: targetCreatorId,
      creatorName: creator.fullName,
      totalQuizzes,
      totalParticipants,
      averageScore,
      learningHubCount: creatorHubs.length,
      totalHubMembers,
      followerCount,
    },
  });
});

// Get single quiz by id or shareCode
apiRouter.get('/quizzes/:idOrCode', (req: Request, res: Response) => {
  const { idOrCode } = req.params;
  const db = dbManager.getData();

  const quiz = db.quizzes.find((q) => q.id === idOrCode || q.shareCode.toUpperCase() === idOrCode.toUpperCase());
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found.' });
  }

  const allQuestions = db.questions
    .filter((q) => q.quizId === quiz.id)
    .sort((a, b) => a.order - b.order);

  // Only the owner/admin receive correct answers. Students never do.
  // Private quiz questions are sent only after a valid, unused exam code.
  let questions: any[];
  if (canManageQuiz(req, quiz)) {
    questions = allQuestions;
  } else if (quiz.accessType === 'private' && !validCodeForQuiz(db, quiz, req.query.code)) {
    questions = allQuestions.map((q) => ({ id: q.id, quizId: q.quizId, subject: q.subject, order: q.order }));
  } else {
    questions = allQuestions.map((q: any) => {
      const { answer, explanation, ...safe } = q;
      return safe;
    });
  }

  const attempts = db.attempts.filter((a) => a.quizId === quiz.id);
  const participantCount = attempts.length;
  const avgScore = participantCount > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.finalScore / a.scoreScale) * 100, 0) / participantCount)
    : 0;

  return res.json({
    quiz: {
      ...quiz,
      participantCount,
      avgScore,
      questions,
    },
  });
});

// Create quiz
apiRouter.post('/quizzes', (req: Request, res: Response) => {
  const {
    creatorId,
    creatorName,
    title,
    description,
    coverImage,
    subjects,
    compulsorySubjects,
    optionalSubjects,
    requiredOptionalCount,
    durationMinutes,
    scoreScale,
    accessType,
    leaderboardEnabled,
    questions,
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Quiz title is required.' });
  }

  // Only logged-in creators/admins can create quizzes
  const authUser = getAuthUser(req);
  if (!authUser || authUser.disabled || (authUser.role !== 'creator' && authUser.role !== 'admin')) {
    return res.status(401).json({ error: 'Please create a creator account or log in to create quizzes.' });
  }

  // Access check when payment system is enabled (Requirement 3 & 6)
  const accessCheck = dbManager.checkCreatorAccess(authUser.id);
  if (!accessCheck.canCreateQuiz) {
    return res.status(403).json({
      error: accessCheck.message || 'Active creator subscription required to create new quizzes.',
      status: accessCheck.status,
      paymentRequired: true,
    });
  }

  const cleanSubjects: string[] = Array.isArray(subjects) ? subjects.filter(Boolean) : ['General Knowledge'];
  const cleanCompulsory: string[] = Array.isArray(compulsorySubjects) ? compulsorySubjects.filter(Boolean) : [];
  const cleanOptional: string[] = Array.isArray(optionalSubjects) ? optionalSubjects.filter(Boolean) : [];

  const quizId = generateId('quiz');
  const codeSuffix = Math.floor(1000 + Math.random() * 9000);
  const shareCode = `REM-${cleanSubjects[0]?.substring(0, 4).toUpperCase() || 'EXAM'}-${codeSuffix}`;

  const numScale = Number(scoreScale);
  const validScale = !isNaN(numScale) && numScale > 0 ? numScale : 100;

  const parsedDuration = parseNullableInt(durationMinutes);

  const newQuiz: Quiz = {
    id: quizId,
    creatorId: authUser.id,
    creatorName: authUser.fullName || creatorName || 'Creator',
    title: title.trim(),
    description: description ? description.trim() : '',
    coverImage: coverImage || '',
    subjects: cleanSubjects,
    compulsorySubjects: cleanCompulsory,
    optionalSubjects: cleanOptional,
    requiredOptionalCount: parseNullableInt(requiredOptionalCount) ?? (cleanOptional.length > 0 ? 1 : 0),
    durationMinutes: parsedDuration,
    scoreScale: validScale,
    accessType: accessType === 'private' ? 'private' : 'public',
    maxAttempts: accessType === 'private' ? 1 : Math.max(0, parseNullableInt(req.body.maxAttempts) ?? 1),
    listedPublicly: accessType === 'private' ? req.body.listedPublicly === true : true,
    ...scheduleFields(req.body),
    shareCode,
    leaderboardEnabled: leaderboardEnabled !== false,
    calculatorEnabled: Boolean(req.body.calculatorEnabled),
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const formattedQuestions: Question[] = [];
  if (Array.isArray(questions) && questions.length > 0) {
    questions.forEach((q: any, idx: number) => {
      if (q.question && q.question.trim()) {
        formattedQuestions.push({
          id: generateId('q'),
          quizId,
          subject: q.subject?.trim() || cleanSubjects[0] || 'General',
          passage: q.passage ? q.passage.trim() : undefined,
          question: q.question.trim(),
          diagram: q.diagram ? q.diagram.trim() : undefined,
          options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ['A', 'B', 'C', 'D'],
          answer: q.answer ? String(q.answer).trim() : (q.options ? q.options[0] : 'A'),
          marks: 1,
          order: idx + 1,
        });
      }
    });
  }

  dbManager.update((state) => {
    state.quizzes.unshift(newQuiz);
    const creatorUser = state.users.find((x) => x.id === authUser.id);
    if (
      creatorUser &&
      creatorUser.role === 'creator' &&
      creatorUser.accessStatus === 'trial' &&
      state.systemSettings.paymentSystemEnabled
    ) {
      creatorUser.trialQuizzesUsed = (creatorUser.trialQuizzesUsed ?? 0) + 1;
    }
    state.questions.push(...formattedQuestions);
    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'QUIZ_CREATE',
      details: `Quiz "${newQuiz.title}" created with ${formattedQuestions.length} questions. Code: ${newQuiz.shareCode}`,
      actor: newQuiz.creatorName,
      timestamp: new Date().toISOString(),
    });
  });

  return res.status(201).json({ quiz: newQuiz, questions: formattedQuestions });
});

// Update quiz
apiRouter.put('/quizzes/:id', (req: Request, res: Response) => {
  {
    const _q = dbManager.getData().quizzes.find((x) => x.id === req.params.id);
    if (_q && !canManageQuiz(req, _q)) return res.status(403).json({ error: 'Only the quiz owner or admin can do this.' });
  }
  const { id } = req.params;
  const {
    title,
    description,
    coverImage,
    subjects,
    compulsorySubjects,
    optionalSubjects,
    requiredOptionalCount,
    durationMinutes,
    scoreScale,
    accessType,
    leaderboardEnabled,
    questions,
  } = req.body;

  const db = dbManager.getData();
  const quiz = db.quizzes.find((q) => q.id === id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found.' });
  }

  const numScale = Number(scoreScale);
  const validScale = scoreScale !== undefined && !isNaN(numScale) && numScale > 0
    ? numScale
    : quiz.scoreScale;

  dbManager.update((state) => {
    const target = state.quizzes.find((q) => q.id === id);
    if (target) {
      if (title) target.title = title.trim();
      if (description !== undefined) target.description = description.trim();
      if (coverImage !== undefined) target.coverImage = coverImage;
      if (Array.isArray(subjects)) target.subjects = subjects.filter(Boolean);
      if (Array.isArray(compulsorySubjects)) target.compulsorySubjects = compulsorySubjects.filter(Boolean);
      if (Array.isArray(optionalSubjects)) target.optionalSubjects = optionalSubjects.filter(Boolean);
      if (requiredOptionalCount !== undefined) {
        target.requiredOptionalCount = parseNullableInt(requiredOptionalCount) ?? 0;
      }
      if (durationMinutes !== undefined) {
        target.durationMinutes = parseNullableInt(durationMinutes);
      }
      target.scoreScale = validScale;
      if (accessType) target.accessType = accessType;
      if (req.body.maxAttempts !== undefined) {
        target.maxAttempts = target.accessType === 'private' ? 1 : Math.max(0, parseNullableInt(req.body.maxAttempts) ?? 1);
      }
      if (req.body.listedPublicly !== undefined || accessType) {
        target.listedPublicly = target.accessType === 'private' ? req.body.listedPublicly === true : true;
      }
      if (req.body.opensAt !== undefined || req.body.windowHours !== undefined) {
        Object.assign(
          target,
          scheduleFields({
            opensAt: req.body.opensAt !== undefined ? req.body.opensAt : target.opensAt,
            windowHours: req.body.windowHours ?? target.windowHours,
          })
        );
      }
      if (leaderboardEnabled !== undefined) target.leaderboardEnabled = Boolean(leaderboardEnabled);
      if (req.body.calculatorEnabled !== undefined) target.calculatorEnabled = Boolean(req.body.calculatorEnabled);
      target.updatedAt = new Date().toISOString();
    }

    // If questions were provided, replace or update
    if (Array.isArray(questions)) {
      state.questions = state.questions.filter((q) => q.quizId !== id);
      const newQuestions: Question[] = questions.map((q: any, idx: number) => ({
        id: q.id && q.id.startsWith('q_') ? q.id : generateId('q'),
        quizId: id,
        subject: q.subject?.trim() || (target?.subjects[0] || 'General'),
        passage: q.passage ? q.passage.trim() : undefined,
        question: q.question.trim(),
        diagram: q.diagram ? q.diagram.trim() : undefined,
        options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ['A', 'B', 'C', 'D'],
        answer: q.answer ? String(q.answer).trim() : (q.options ? q.options[0] : 'A'),
        marks: 1,
        order: idx + 1,
      }));
      state.questions.push(...newQuestions);
    }

    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'QUIZ_UPDATE',
      details: `Quiz "${quiz.title}" (${id}) updated.`,
      actor: quiz.creatorName,
      timestamp: new Date().toISOString(),
    });
  });

  const updatedQuiz = dbManager.getData().quizzes.find((q) => q.id === id);
  const updatedQuestions = dbManager.getData().questions.filter((q) => q.quizId === id);
  return res.json({ quiz: updatedQuiz, questions: updatedQuestions });
});

// Delete quiz (CASCADE: delete quiz, questions, attempts, live sessions, links)
apiRouter.delete('/quizzes/:id', (req: Request, res: Response) => {
  {
    const _q = dbManager.getData().quizzes.find((x) => x.id === req.params.id);
    if (_q && !canManageQuiz(req, _q)) return res.status(403).json({ error: 'Only the quiz owner or admin can do this.' });
  }
  const { id } = req.params;
  const db = dbManager.getData();

  const quiz = db.quizzes.find((q) => q.id === id);
  if (!quiz) {
    // If not found in DB, return 404 with verification flag
    return res.status(404).json({ error: 'Quiz not found or already deleted.', verifiedDeleted: true });
  }

  const quizTitle = quiz.title;

  dbManager.update((state) => {
    // 1. Delete quiz
    state.quizzes = state.quizzes.filter((q) => q.id !== id);
    // 2. Delete questions
    state.questions = state.questions.filter((q) => q.quizId !== id);
    // 3. Delete attempts
    state.attempts = state.attempts.filter((a) => a.quizId !== id);
    // 4. Delete live sessions
    state.liveSessions = state.liveSessions.filter((s) => s.quizId !== id);
    // 5. Unlink from any hub materials
    state.hubMaterials = state.hubMaterials.filter((m) => m.quizId !== id);

    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'QUIZ_DELETE',
      details: `Quiz "${quizTitle}" (${id}) and all cascading records (questions, attempts, live sessions) permanently deleted.`,
      actor: 'System/Creator',
      timestamp: new Date().toISOString(),
    });
  });

  // Verify deletion
  const verifyDb = dbManager.getData();
  const stillExists = verifyDb.quizzes.some((q) => q.id === id);

  return res.json({
    success: true,
    message: `Quiz "${quizTitle}" has been completely removed from the database and all dependent records.`,
    deletedId: id,
    verifiedDeleted: !stillExists,
  });
});

// ==========================================
// 3. CBT SESSIONS & ATTEMPTS
// ==========================================

// Check access / prior attempt
apiRouter.post('/cbt/check-access', (req: Request, res: Response) => {
  const { quizId, email } = req.body;
  if (!quizId || !email) {
    return res.status(400).json({ error: 'quizId and email are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = dbManager.getData();

  const quiz = db.quizzes.find((q) => q.id === quizId || q.shareCode.toUpperCase() === quizId.toUpperCase());
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz does not exist.' });
  }

  // Check attempt limit (public quizzes: creator-set; private quizzes: always 1)
  const priorAttempts = db.attempts.filter(
    (a) => a.quizId === quiz.id && a.participantEmail.toLowerCase() === cleanEmail
  );
  const priorAttempt = priorAttempts.length >= attemptLimit(quiz) ? priorAttempts[priorAttempts.length - 1] : undefined;

  return res.json({
    canAttempt: !priorAttempt,
    schedule: {
      status: canManageQuiz(req, quiz) ? 'open' : scheduleStatus(quiz),
      opensAt: quiz.opensAt || null,
      closesAt: quiz.closesAt || null,
    },
    priorAttempt: priorAttempt || null,
    quiz,
  });
});

// Start live CBT session
apiRouter.post('/cbt/start-session', (req: Request, res: Response) => {
  const { quizId, participantName, participantEmail, selectedSubjects } = req.body;
  if (!quizId || !participantName || !participantEmail) {
    return res.status(400).json({ error: 'quizId, participantName, and participantEmail are required.' });
  }

  const cleanEmail = participantEmail.trim().toLowerCase();
  const db = dbManager.getData();

  const quiz = db.quizzes.find((q) => q.id === quizId || q.shareCode.toUpperCase() === quizId.toUpperCase());
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found.' });
  }

  const accessError = checkPrivateAccess(db, quiz, req.body.accessCode, cleanEmail);
  if (accessError) {
    return res.status(403).json({ error: accessError });
  }
  const startBlocked = scheduleBlock(req, quiz);
  if (startBlocked) {
    return res.status(403).json({ error: startBlocked });
  }

  // Get total question count for chosen subjects
  const chosen = Array.isArray(selectedSubjects) && selectedSubjects.length > 0
    ? selectedSubjects
    : quiz.subjects;

  const relevantQuestions = db.questions.filter(
    (q) => q.quizId === quiz.id && chosen.includes(q.subject)
  );

  const sessionId = generateId('sess');
  const session: LiveSession = {
    id: sessionId,
    quizId: quiz.id,
    participantName: participantName.trim(),
    participantEmail: cleanEmail,
    selectedSubjects: chosen,
    currentQuestionIndex: 1,
    totalQuestions: relevantQuestions.length,
    startedAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    status: 'active',
  };

  dbManager.update((state) => {
    // Remove stale sessions for this participant on this quiz
    state.liveSessions = state.liveSessions.filter(
      (s) => !(s.quizId === quiz.id && s.participantEmail.toLowerCase() === cleanEmail)
    );
    state.liveSessions.push(session);
  });

  return res.json({ session });
});

// CBT Heartbeat
apiRouter.post('/cbt/heartbeat', (req: Request, res: Response) => {
  const { quizId, participantEmail, currentQuestionIndex } = req.body;
  if (!quizId || !participantEmail) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }

  const cleanEmail = participantEmail.trim().toLowerCase();

  dbManager.update((state) => {
    const session = state.liveSessions.find(
      (s) => s.quizId === quizId && s.participantEmail.toLowerCase() === cleanEmail && s.status === 'active'
    );
    if (session) {
      session.lastHeartbeat = new Date().toISOString();
      if (currentQuestionIndex !== undefined) {
        session.currentQuestionIndex = currentQuestionIndex;
      }
    }
  });

  return res.json({ ok: true });
});

// Submit CBT Attempt
apiRouter.post('/cbt/submit', (req: Request, res: Response) => {
  const {
    quizId,
    participantName,
    participantEmail,
    userId,
    selectedSubjects,
    answers,
    timeUsedSeconds,
    startedAt,
  } = req.body;

  if (!quizId || !participantName || !participantEmail || !answers) {
    return res.status(400).json({ error: 'Incomplete submission data.' });
  }

  const cleanEmail = participantEmail.trim().toLowerCase();
  const db = dbManager.getData();

  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found.' });
  }

  // Check one-attempt rule again
  const accessError = checkPrivateAccess(db, quiz, req.body.accessCode, cleanEmail);
  if (accessError) {
    return res.status(403).json({ error: accessError });
  }
  const submitBlocked = scheduleBlock(req, quiz);
  if (submitBlocked) {
    // Outside the window, only people who started inside it may still submit
    const hadSession = db.liveSessions.some(
      (s) => s.quizId === quiz.id && s.participantEmail.toLowerCase() === cleanEmail
    );
    if (!hadSession) return res.status(403).json({ error: submitBlocked });
  }
  const priorAttempts = db.attempts.filter(
    (a) => a.quizId === quiz.id && a.participantEmail.toLowerCase() === cleanEmail
  );
  const existingAttempt = priorAttempts.length >= attemptLimit(quiz) ? priorAttempts[priorAttempts.length - 1] : undefined;
  if (existingAttempt) {
    return res.status(409).json({
      error: 'You have already submitted an attempt for this quiz.',
      attempt: existingAttempt,
    });
  }

  const chosenSubjects = Array.isArray(selectedSubjects) && selectedSubjects.length > 0
    ? selectedSubjects
    : quiz.subjects;

  // Filter questions for the student's selected subjects
  const relevantQuestions = db.questions.filter(
    (q) => q.quizId === quiz.id && chosenSubjects.includes(q.subject)
  );

  let totalCorrect = 0;
  let totalQuestions = relevantQuestions.length;

  const subjectScores: Record<string, { total: number; correct: number; percentage: number; scaledScore: number }> = {};

  // Initialize subjects
  chosenSubjects.forEach((sub: string) => {
    subjectScores[sub] = { total: 0, correct: 0, percentage: 0, scaledScore: 0 };
  });

  relevantQuestions.forEach((q) => {
    const studentAnswer = answers[q.id];
    const isCorrect = studentAnswer !== undefined &&
      String(studentAnswer).trim().toLowerCase() === String(q.answer).trim().toLowerCase();

    const sub = q.subject || 'General';
    if (!subjectScores[sub]) {
      subjectScores[sub] = { total: 0, correct: 0, percentage: 0, scaledScore: 0 };
    }

    subjectScores[sub].total += 1;
    if (isCorrect) {
      subjectScores[sub].correct += 1;
      totalCorrect += 1;
    }
  });

  // Calculate subject percentages & proportional scaled scores
  // Scale breakdown per subject if scale is e.g. 400 across 4 subjects
  const subjectCount = Object.keys(subjectScores).length || 1;
  const scalePerSubject = quiz.scoreScale / subjectCount;

  Object.keys(subjectScores).forEach((sub) => {
    const s = subjectScores[sub];
    s.percentage = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
    s.scaledScore = Math.round((s.percentage / 100) * scalePerSubject);
  });

  // Proportional final score based on overall percentage
  const overallPercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) : 0;
  const finalScore = Math.round(overallPercentage * quiz.scoreScale);
  const formattedScore = `${finalScore}/${quiz.scoreScale}`;

  const attemptId = generateId('att');
  const attemptRecord: QuizAttempt = {
    id: attemptId,
    quizId: quiz.id,
    participantName: participantName.trim(),
    participantEmail: cleanEmail,
    userId: userId || undefined,
    selectedSubjects: chosenSubjects,
    answers,
    subjectScores,
    totalQuestions,
    correctCount: totalCorrect,
    wrongCount: totalQuestions - totalCorrect,
    finalScore,
    scoreScale: quiz.scoreScale,
    formattedScore,
    timeUsedSeconds: Number(timeUsedSeconds) || 0,
    startedAt: startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    hiddenFromLeaderboard: false,
  };

  dbManager.update((state) => {
    state.attempts.push(attemptRecord);
    if (quiz.accessType === 'private') {
      const reg = state.registrations.find(
        (r) => r.quizId === quiz.id && r.code === normCode(req.body.accessCode)
      );
      if (reg) {
        reg.usedAt = new Date().toISOString();
        reg.attemptId = attemptId;
      }
    }
    // Mark live session as completed
    const session = state.liveSessions.find(
      (s) => s.quizId === quiz.id && s.participantEmail.toLowerCase() === cleanEmail
    );
    if (session) {
      session.status = 'completed';
    }

    // Requirement 6: Record assessment into Learning Hub membership history
    const memberHubs = state.hubMembers.filter(
      (m) => m.userEmail.toLowerCase() === cleanEmail || (userId && m.userId === userId)
    );

    memberHubs.forEach((m) => {
      const hub = state.learningHubs.find((h) => h.id === m.hubId);
      // Attach if quiz is explicitly linked to hub, or belongs to the hub creator
      const isHubQuiz =
        hub?.assessmentQuizIds?.includes(quiz.id) ||
        hub?.creatorId === quiz.creatorId ||
        quiz.creatorId === 'usr_creator_1';

      if (isHubQuiz) {
        if (!m.completedAssessments) m.completedAssessments = [];
        // Avoid duplicate attempt entry for same quiz attempt
        if (!m.completedAssessments.some((rec) => rec.id === attemptId)) {
          const simplifiedSubScores: Record<string, { total: number; correct: number; percentage: number }> = {};
          Object.entries(subjectScores).forEach(([sub, sc]) => {
            simplifiedSubScores[sub] = {
              total: sc.total,
              correct: sc.correct,
              percentage: sc.percentage,
            };
          });

          m.completedAssessments.unshift({
            id: attemptId,
            quizId: quiz.id,
            quizTitle: quiz.title,
            subjectScores: simplifiedSubScores,
            finalScore,
            scoreScale: quiz.scoreScale,
            percentage: Math.round(overallPercentage * 100),
            completedAt: attemptRecord.completedAt,
          });
        }
      }
    });

    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'QUIZ_SUBMITTED',
      details: `${participantName} completed "${quiz.title}" with score ${formattedScore}.`,
      actor: cleanEmail,
      timestamp: new Date().toISOString(),
    });
  });

  return res.status(201).json({ attempt: attemptRecord });
});

// Get attempt details
apiRouter.get('/cbt/attempt/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = dbManager.getData();

  const attempt = db.attempts.find((a) => a.id === id);
  if (!attempt) {
    return res.status(404).json({ error: 'Attempt record not found.' });
  }

  const quiz = db.quizzes.find((q) => q.id === attempt.quizId);
  const questions = db.questions.filter((q) => q.quizId === attempt.quizId);

  const mayReview = quiz ? canManageQuiz(req, quiz) : false;
  return res.json({
    attempt,
    quiz,
    questions: mayReview ? questions : questions.map(({ answer, explanation, ...safe }: any) => safe),
  });
});

// Creator/Admin Reset participant attempt
apiRouter.post('/cbt/reset-attempt', (req: Request, res: Response) => {
  const { attemptId, quizId, participantEmail } = req.body;
  const db = dbManager.getData();

  const targetAttempt = attemptId ? db.attempts.find((a) => a.id === attemptId) : undefined;
  const targetQuizId = targetAttempt ? targetAttempt.quizId : quizId;
  const targetQuiz = db.quizzes.find((q) => q.id === targetQuizId);
  if (!targetQuiz) {
    return res.status(404).json({ error: 'Quiz not found.' });
  }
  if (!canManageQuiz(req, targetQuiz)) {
    return res.status(403).json({ error: 'Only the quiz owner or admin can allow a retake.' });
  }
  const retakeEmail = String(targetAttempt?.participantEmail || participantEmail || '').trim().toLowerCase();

  dbManager.update((state) => {
    // Free the student's one-time exam code so it can be used again
    state.registrations.forEach((r) => {
      if (r.quizId === targetQuizId && ((attemptId && r.attemptId === attemptId) || (retakeEmail && r.email === retakeEmail))) {
        delete r.attemptId;
        delete r.usedAt;
      }
    });
    if (attemptId) {
      state.attempts = state.attempts.filter((a) => a.id !== attemptId);
    } else if (quizId && participantEmail) {
      state.attempts = state.attempts.filter(
        (a) => !(a.quizId === quizId && a.participantEmail.toLowerCase() === participantEmail.trim().toLowerCase())
      );
    }

    // Also remove from live sessions so they can start fresh
    if (quizId && participantEmail) {
      state.liveSessions = state.liveSessions.filter(
        (s) => !(s.quizId === quizId && s.participantEmail.toLowerCase() === participantEmail.trim().toLowerCase())
      );
    }

    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'ATTEMPT_RESET',
      details: `Attempt reset for ${participantEmail || attemptId}.`,
      actor: 'Creator/Admin',
      timestamp: new Date().toISOString(),
    });
  });

  return res.json({ success: true, message: 'Attempt reset successfully. Participant may retake the quiz.' });
});

// ==========================================
// 4. LIVE PARTICIPANTS
// ==========================================

apiRouter.get('/quizzes/:id/live-participants', (req: Request, res: Response) => {
  {
    const _q = dbManager.getData().quizzes.find((x) => x.id === req.params.id);
    if (_q && !canManageQuiz(req, _q)) return res.status(403).json({ error: 'Only the quiz owner or admin can do this.' });
  }
  const { id } = req.params;
  const db = dbManager.getData();

  // Active within last 60 seconds (phones send a signal every 20 seconds)
  const cutoff = Date.now() - 60 * 1000;
  const activeSessions = db.liveSessions.filter((s) => {
    if (s.quizId !== id) return false;
    if (s.status !== 'active') return false;
    const heartbeatTime = new Date(s.lastHeartbeat).getTime();
    return heartbeatTime >= cutoff;
  });

  return res.json({
    count: activeSessions.length,
    participants: activeSessions.map((s) => ({
      id: s.id,
      name: s.participantName,
      email: s.participantEmail,
      selectedSubjects: s.selectedSubjects,
      currentQuestion: s.currentQuestionIndex,
      totalQuestions: s.totalQuestions,
      progress: `Question ${s.currentQuestionIndex}/${s.totalQuestions}`,
      startedAt: s.startedAt,
      status: s.status,
    })),
  });
});

// ==========================================
// 5. LEADERBOARD
// ==========================================

apiRouter.get('/quizzes/:id/leaderboard', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = dbManager.getData();

  const quiz = db.quizzes.find((q) => q.id === id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found.' });
  }

  // Filter visible attempts for this quiz
  const visibleAttempts = db.attempts
    .filter((a) => a.quizId === id && !a.hiddenFromLeaderboard)
    .sort((a, b) => {
      // Sort by final score descending, then by time used ascending
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return a.timeUsedSeconds - b.timeUsedSeconds;
    });

  const ranked = visibleAttempts.map((att, idx) => ({
    rank: idx + 1,
    attemptId: att.id,
    student: att.participantName,
    email: canManageQuiz(req, quiz) ? att.participantEmail : '',
    subjects: att.selectedSubjects.join(', '),
    score: att.formattedScore,
    numericScore: att.finalScore,
    scale: att.scoreScale,
    timeUsedSeconds: att.timeUsedSeconds,
    completedAt: att.completedAt,
  }));

  return res.json({
    quizTitle: quiz.title,
    leaderboardEnabled: quiz.leaderboardEnabled,
    scoreScale: quiz.scoreScale,
    leaderboard: ranked,
  });
});

// Hide participant from leaderboard without deleting attempt
apiRouter.put('/quizzes/:id/leaderboard/hide-participant', (req: Request, res: Response) => {
  {
    const _q = dbManager.getData().quizzes.find((x) => x.id === req.params.id);
    if (_q && !canManageQuiz(req, _q)) return res.status(403).json({ error: 'Only the quiz owner or admin can do this.' });
  }
  const { attemptId } = req.body;
  if (!attemptId) {
    return res.status(400).json({ error: 'attemptId is required.' });
  }

  dbManager.update((state) => {
    const attempt = state.attempts.find((a) => a.id === attemptId);
    if (attempt) {
      attempt.hiddenFromLeaderboard = true;
      state.auditLogs.unshift({
        id: generateId('log'),
        action: 'LEADERBOARD_HIDE',
        details: `Participant ${attempt.participantName} hidden from leaderboard on quiz ${attempt.quizId}.`,
        actor: 'Creator',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return res.json({ success: true });
});

// ==========================================
// 6. LEARNING HUBS & MATERIALS
// ==========================================

// Get all hubs
// ==========================================
// LEARNING HUBS (Phase 2: profile, membership, subject limits)
// ==========================================

function memberStatus(m: HubMember): 'active' | 'pending' | 'rejected' {
  return m.status ?? 'active';
}

function findHubByKey(db: any, key: string): LearningHub | undefined {
  const k = String(key || '').trim().toUpperCase();
  return db.learningHubs.find((h: LearningHub) => h.id.toUpperCase() === k || (h.hubCode && h.hubCode.toUpperCase() === k));
}

function cleanSubjectList(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const v = String(raw || '').trim().slice(0, 60);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out.slice(0, 20);
}

function makeHubCode(existing: string[]): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do {
    code = 'HUB-';
    for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
  } while (existing.includes(code));
  return code;
}

// Validates and cleans the fields a creator can set on a hub
function readHubFields(body: any): { error?: string; fields?: Partial<LearningHub> } {
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Hub name is required.' };
  if (title.length > 120) return { error: 'Hub name is too long (120 characters at most).' };
  const subjects = cleanSubjectList(body.subjects);
  if (subjects.length === 0) return { error: 'Add at least one subject offered by this hub.' };
  let maxSubjects = parseNullableInt(body.maxSubjects) ?? 0;
  if (maxSubjects < 0) maxSubjects = 0;
  if (maxSubjects > subjects.length) maxSubjects = subjects.length;
  const joinMode = body.joinMode === 'approval' ? 'approval' : 'open';
  const accessType = body.accessType === 'paid' ? 'paid' : 'free';
  const fields: Partial<LearningHub> = {
    title,
    description: String(body.description || '').trim().slice(0, 2000),
    institution: String(body.institution || '').trim().slice(0, 120),
    examBody: String(body.examBody || '').trim().slice(0, 60),
    subjects,
    subject: subjects.join(', ').slice(0, 200),
    maxSubjects,
    joinMode,
    accessType,
    objectives: String(body.objectives || '').trim().slice(0, 2000),
    isPublic: body.isPublic !== false,
  };
  if (accessType === 'paid') {
    const fee = parseNullableInt(body.membershipFee);
    fields.membershipFee = fee !== null && fee >= 0 ? fee : 0;
    fields.paymentInstructions = String(body.paymentInstructions || '').trim().slice(0, 1000);
  } else {
    fields.membershipFee = undefined;
    fields.paymentInstructions = undefined;
  }
  return { fields };
}

// Checks a student's chosen subjects against the hub's list and limit (enforced here, not only on the screen)
function checkSubjectSelection(hub: LearningHub, input: any): { error?: string; subjects?: string[] } {
  const offered = hub.subjects || [];
  const chosen = cleanSubjectList(input);
  if (offered.length === 0) return { subjects: [] };
  if (chosen.length === 0) return { error: 'Choose at least one subject.' };
  const lower = new Map(offered.map((x) => [x.toLowerCase(), x]));
  const matched: string[] = [];
  for (const c of chosen) {
    const real = lower.get(c.toLowerCase());
    if (!real) return { error: `"${c}" is not offered by this hub.` };
    matched.push(real);
  }
  const max = hub.maxSubjects ?? 0;
  if (max > 0 && matched.length > max) return { error: `You can choose at most ${max} subject${max === 1 ? '' : 's'}.` };
  return { subjects: matched };
}

function viewerHubStatus(db: any, hub: LearningHub, viewer: User | null): 'owner' | 'active' | 'pending' | 'rejected' | null {
  if (!viewer) return null;
  if (viewer.id === hub.creatorId) return 'owner';
  const m = db.hubMembers.find((x: HubMember) => x.hubId === hub.id && x.userEmail.toLowerCase() === viewer.email.toLowerCase());
  return m ? memberStatus(m) : null;
}

// List hubs (with optional search)
apiRouter.get('/hubs', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const viewer = getAuthUser(req);
  const q = String(req.query.q || '').trim().toLowerCase();
  const hubs = db.learningHubs
    .filter((h) => {
      const status = viewerHubStatus(db, h, viewer);
      const mayList = h.isPublic !== false || !!status || viewer?.role === 'admin';
      if (!mayList) return false;
      if (!q) return true;
      const hay = [h.title, h.description, h.institution, h.examBody, h.subject, ...(h.subjects || []), h.creatorName]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    })
    .map((hub) => ({
      ...hub,
      memberCount: db.hubMembers.filter((m) => m.hubId === hub.id && memberStatus(m) === 'active').length,
      materialCount: db.hubMaterials.filter((m) => m.hubId === hub.id).length,
      myStatus: viewerHubStatus(db, hub, viewer),
    }));
  return res.json({ hubs });
});

// Get single hub (by id or by the short hub code from a shared link)
apiRouter.get('/hubs/:id', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const hub = findHubByKey(db, req.params.id);
  if (!hub) {
    return res.status(404).json({ error: 'Hub not found.' });
  }
  const viewer = getAuthUser(req);
  const manage = canManageHub(req, hub);
  const status = viewerHubStatus(db, hub, viewer);
  const allMembers = db.hubMembers.filter((m) => m.hubId === hub.id);
  const activeMembers = allMembers.filter((m) => memberStatus(m) === 'active');
  const myMembership = viewer
    ? allMembers.find((m) => m.userEmail.toLowerCase() === viewer.email.toLowerCase()) || null
    : null;
  const mayReadMaterials = manage || status === 'active';
  const materials = mayReadMaterials
    ? db.hubMaterials
        .filter((m) => m.hubId === hub.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  return res.json({
    hub: {
      ...hub,
      memberCount: activeMembers.length,
      pendingCount: manage ? allMembers.filter((m) => memberStatus(m) === 'pending').length : undefined,
      members: manage ? allMembers : [],
      myMembership,
      myStatus: status,
      materials,
      materialCount: db.hubMaterials.filter((m) => m.hubId === hub.id).length,
      quizzes: manage ? db.quizzes.filter((q) => q.creatorId === hub.creatorId) : [],
    },
  });
});

// Create hub
apiRouter.post('/hubs', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.disabled || (authUser.role !== 'creator' && authUser.role !== 'admin')) {
    return res.status(401).json({ error: 'Please log in with a creator account to create a learning hub.' });
  }
  const parsed = readHubFields(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  // Access check when payment system is enabled (Requirement 3 & 6)
  const accessCheck = dbManager.checkCreatorAccess(authUser.id);
  if (!accessCheck.canCreateHub) {
    return res.status(403).json({
      error: accessCheck.message || 'Active creator subscription required to create new learning hubs.',
      status: accessCheck.status,
      paymentRequired: true,
    });
  }

  const db = dbManager.getData();
  const newHub: LearningHub = {
    id: generateId('hub'),
    creatorId: authUser.id,
    creatorName: authUser.fullName || 'Creator',
    title: '',
    description: '',
    subject: '',
    coverColor: req.body.coverColor || 'navy',
    isPublic: true,
    hubCode: makeHubCode(db.learningHubs.map((h) => h.hubCode || '')),
    createdAt: new Date().toISOString(),
    ...(parsed.fields as any),
  };

  dbManager.update((state) => {
    state.learningHubs.unshift(newHub);
    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'HUB_CREATE',
      details: `Learning Hub "${newHub.title}" created.`,
      actor: newHub.creatorName,
      timestamp: new Date().toISOString(),
    });
  });

  return res.status(201).json({ hub: newHub });
});

// Edit hub (owner or admin)
apiRouter.put('/hubs/:id', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const hub = findHubByKey(db, req.params.id);
  if (!hub) return res.status(404).json({ error: 'Hub not found.' });
  if (!canManageHub(req, hub)) return res.status(403).json({ error: 'Only the hub owner or admin can edit this hub.' });
  const parsed = readHubFields(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  dbManager.update((state) => {
    const t = state.learningHubs.find((h) => h.id === hub.id);
    if (t) {
      Object.assign(t, parsed.fields, { updatedAt: new Date().toISOString() });
      if (!t.hubCode) t.hubCode = makeHubCode(state.learningHubs.map((h) => h.hubCode || ''));
    }
  });
  const updated = dbManager.getData().learningHubs.find((h) => h.id === hub.id);
  return res.json({ hub: updated });
});

// Delete hub (owner or admin)
apiRouter.delete('/hubs/:id', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const hub = findHubByKey(db, req.params.id);
  if (!hub) return res.status(404).json({ error: 'Hub not found.' });
  if (!canManageHub(req, hub)) return res.status(403).json({ error: 'Only the hub owner or admin can delete this hub.' });
  dbManager.update((state) => {
    state.learningHubs = state.learningHubs.filter((h) => h.id !== hub.id);
    state.hubMembers = state.hubMembers.filter((m) => m.hubId !== hub.id);
    state.hubMaterials = state.hubMaterials.filter((m) => m.hubId !== hub.id);
    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'HUB_DELETE',
      details: `Learning Hub "${hub.title}" deleted.`,
      actor: hub.creatorName,
      timestamp: new Date().toISOString(),
    });
  });
  return res.json({ ok: true });
});

// Join (or request to join) a hub, choosing subjects
apiRouter.post('/hubs/:id/join', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.disabled) {
    return res.status(401).json({ error: 'Please log in to join a learning hub.' });
  }
  const db = dbManager.getData();
  const hub = findHubByKey(db, req.params.id);
  if (!hub) return res.status(404).json({ error: 'Hub not found.' });
  if (hub.creatorId === authUser.id) {
    return res.status(400).json({ error: 'You own this hub, so you are already its manager.' });
  }
  const cleanEmail = authUser.email.trim().toLowerCase();
  const existing = db.hubMembers.find((m) => m.hubId === hub.id && m.userEmail.toLowerCase() === cleanEmail);
  if (existing && memberStatus(existing) === 'active') {
    return res.json({ success: true, status: 'active', message: 'You are already a member of this hub.' });
  }
  if (existing && memberStatus(existing) === 'pending') {
    return res.json({ success: true, status: 'pending', message: 'Your request is already waiting for the hub creator.' });
  }

  const picked = checkSubjectSelection(hub, req.body?.subjects);
  if (picked.error) return res.status(400).json({ error: picked.error });

  // Open free hubs admit at once. Approval hubs and paid hubs wait for the creator.
  // A paid hub is never marked paid here: the creator confirms payment by approving.
  const needsApproval = (hub.joinMode ?? 'open') === 'approval' || hub.accessType === 'paid';
  const status: 'active' | 'pending' = needsApproval ? 'pending' : 'active';

  const member: HubMember = {
    id: existing?.id || generateId('hm'),
    hubId: hub.id,
    userId: authUser.id,
    userName: authUser.fullName.trim(),
    userEmail: cleanEmail,
    joinedAt: new Date().toISOString(),
    selectedSubjects: picked.subjects,
    status,
    isPaid: hub.accessType === 'paid' ? false : undefined,
  };

  dbManager.update((state) => {
    if (existing) {
      const i = state.hubMembers.findIndex((m) => m.id === existing.id);
      state.hubMembers[i] = member; // a declined student asking again
    } else {
      state.hubMembers.push(member);
    }
  });

  const message =
    status === 'active'
      ? 'You joined the hub.'
      : hub.accessType === 'paid'
      ? 'This is a paid hub. Your request is pending until the hub creator confirms your payment.'
      : 'Your request was sent. The hub creator will approve it.';
  return res.status(201).json({ success: true, status, member, message });
});

// Creator: approve or decline a request
apiRouter.put('/hubs/:id/members/:memberId', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const hub = findHubByKey(db, req.params.id);
  if (!hub) return res.status(404).json({ error: 'Hub not found.' });
  if (!canManageHub(req, hub)) return res.status(403).json({ error: 'Only the hub owner or admin can do this.' });
  const next = req.body?.status;
  if (next !== 'active' && next !== 'rejected') return res.status(400).json({ error: 'Status must be active or rejected.' });
  const member = db.hubMembers.find((m) => m.id === req.params.memberId && m.hubId === hub.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  dbManager.update((state) => {
    const t = state.hubMembers.find((m) => m.id === member.id);
    if (t) {
      t.status = next;
      if (next === 'active' && hub.accessType === 'paid') t.isPaid = true; // creator confirmed the payment
    }
  });
  return res.json({ ok: true });
});

// Remove a member (creator), or leave a hub (the member)
apiRouter.delete('/hubs/:id/members/:memberId', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const hub = findHubByKey(db, req.params.id);
  if (!hub) return res.status(404).json({ error: 'Hub not found.' });
  const member = db.hubMembers.find((m) => m.id === req.params.memberId && m.hubId === hub.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  const u = getAuthUser(req);
  const isSelf = !!u && u.id === member.userId;
  if (!isSelf && !canManageHub(req, hub)) return res.status(403).json({ error: 'Not allowed.' });
  dbManager.update((state) => {
    state.hubMembers = state.hubMembers.filter((m) => m.id !== member.id);
  });
  return res.json({ ok: true });
});

// Member: change their own subject selection (limits enforced here)
apiRouter.put('/hubs/:id/my-subjects', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser || authUser.disabled) return res.status(401).json({ error: 'Please log in.' });
  const db = dbManager.getData();
  const hub = findHubByKey(db, req.params.id);
  if (!hub) return res.status(404).json({ error: 'Hub not found.' });
  const member = db.hubMembers.find(
    (m) => m.hubId === hub.id && m.userEmail.toLowerCase() === authUser.email.toLowerCase()
  );
  if (!member || memberStatus(member) === 'rejected') return res.status(403).json({ error: 'You are not a member of this hub.' });
  const picked = checkSubjectSelection(hub, req.body?.subjects);
  if (picked.error) return res.status(400).json({ error: picked.error });
  dbManager.update((state) => {
    const t = state.hubMembers.find((m) => m.id === member.id);
    if (t) t.selectedSubjects = picked.subjects;
  });
  return res.json({ ok: true, subjects: picked.subjects });
});

// Add material to hub
apiRouter.post('/hubs/:id/materials', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, type, content, quizId } = req.body;
  const authUser = getAuthUser(req);
  const targetHub = dbManager.getData().learningHubs.find((h) => h.id === id);
  if (!targetHub) return res.status(404).json({ error: 'Hub not found.' });
  if (!authUser || !canManageHub(req, targetHub)) {
    return res.status(403).json({ error: 'Only the hub owner or admin can add materials.' });
  }

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const material: HubMaterial = {
    id: generateId('mat'),
    hubId: id,
    creatorId: authUser.id,
    title: title.trim(),
    description: description ? description.trim() : '',
    type: type || 'note',
    content: content.trim(),
    quizId: quizId || undefined,
    createdAt: new Date().toISOString(),
  };

  dbManager.update((state) => {
    state.hubMaterials.unshift(material);
  });

  return res.status(201).json({ material });
});

// Hub student performance analytics
apiRouter.get('/hubs/:id/performance', (req: Request, res: Response) => {
  {
    const _h = dbManager.getData().learningHubs.find((x) => x.id === req.params.id);
    if (!_h) return res.status(404).json({ error: 'Hub not found.' });
    if (!canManageHub(req, _h)) return res.status(403).json({ error: 'Only the hub owner or admin can view this.' });
  }
  const { id } = req.params;
  const db = dbManager.getData();

  const members = db.hubMembers.filter((m) => m.hubId === id && memberStatus(m) === 'active');
  const hub = db.learningHubs.find((h) => h.id === id);

  const studentEmails = members.map((m) => m.userEmail.toLowerCase());
  const memberAttempts = db.attempts.filter((a) => studentEmails.includes(a.participantEmail.toLowerCase()));

  const performance = members.map((m) => {
    const attempts = memberAttempts.filter((a) => a.participantEmail.toLowerCase() === m.userEmail.toLowerCase());
    const count = attempts.length;
    const avgScore = count > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.finalScore / a.scoreScale) * 100, 0) / count)
      : null;

    return {
      memberId: m.id,
      name: m.userName,
      email: m.userEmail,
      joinedAt: m.joinedAt,
      quizzesTaken: count,
      averageScore: avgScore !== null ? `${avgScore}%` : 'No attempts',
      latestAttempt: attempts[attempts.length - 1] || null,
    };
  });

  return res.json({ hubTitle: hub?.title, performance });
});

// ==========================================
// 7. RESULTS & ANALYTICS (STUDENT PERFORMANCE)
// ==========================================

apiRouter.get('/analytics/student/:email', (req: Request, res: Response) => {
  {
    const _au = getAuthUser(req);
    if (!_au || (_au.role !== 'admin' && _au.email.toLowerCase() !== String(req.params.email).toLowerCase())) {
      return res.status(403).json({ error: 'You can only view your own results.' });
    }
  }
  const { email } = req.params;
  const cleanEmail = email.trim().toLowerCase();
  const db = dbManager.getData();

  const studentAttempts = db.attempts
    .filter((a) => a.participantEmail.toLowerCase() === cleanEmail)
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  const totalAttempts = studentAttempts.length;

  // Track subject performance
  const subjectAggregates: Record<string, { totalQ: number; correctQ: number }> = {};
  studentAttempts.forEach((att) => {
    Object.entries(att.subjectScores).forEach(([sub, scoreObj]) => {
      if (!subjectAggregates[sub]) {
        subjectAggregates[sub] = { totalQ: 0, correctQ: 0 };
      }
      subjectAggregates[sub].totalQ += scoreObj.total;
      subjectAggregates[sub].correctQ += scoreObj.correct;
    });
  });

  const subjectPerformance = Object.entries(subjectAggregates).map(([subject, data]) => {
    const percentage = data.totalQ > 0 ? Math.round((data.correctQ / data.totalQ) * 100) : 0;
    return {
      subject,
      totalQuestions: data.totalQ,
      correctQuestions: data.correctQ,
      accuracyPercentage: percentage,
    };
  });

  // Calculate weak areas and strong areas ONLY if sufficient data exists
  // If fewer than 2 attempts or fewer than 6 questions answered overall, return "Not enough data yet"
  const hasEnoughData = totalAttempts >= 2 && Object.values(subjectAggregates).some((d) => d.totalQ >= 4);

  let strongAreas: string[] | null = null;
  let weakAreas: string[] | null = null;
  let strongMessage = 'Not enough data yet';
  let weakMessage = 'Not enough data yet';

  if (hasEnoughData) {
    const sorted = [...subjectPerformance].sort((a, b) => b.accuracyPercentage - a.accuracyPercentage);
    const strong = sorted.filter((s) => s.accuracyPercentage >= 75);
    const weak = sorted.filter((s) => s.accuracyPercentage < 65);

    if (strong.length > 0) {
      strongAreas = strong.map((s) => `${s.subject} (${s.accuracyPercentage}% accuracy)`);
      strongMessage = `${strong.length} mastery subjects identified`;
    }
    if (weak.length > 0) {
      weakAreas = weak.map((s) => `${s.subject} (${s.accuracyPercentage}% accuracy - needs reinforcement)`);
      weakMessage = `${weak.length} focus subjects requiring review`;
    } else {
      weakMessage = 'Consistent performance across attempted subjects';
    }
  }

  // Improvement over time
  const timeline = studentAttempts.map((att) => ({
    date: att.completedAt.split('T')[0],
    quizTitle: db.quizzes.find((q) => q.id === att.quizId)?.title || 'Quiz',
    score: att.finalScore,
    scale: att.scoreScale,
    percentage: Math.round((att.finalScore / att.scoreScale) * 100),
  }));

  return res.json({
    studentEmail: cleanEmail,
    totalAttempts,
    subjectPerformance,
    hasEnoughData,
    strongAreas,
    strongMessage,
    weakAreas,
    weakMessage,
    timeline,
    recentAttempts: studentAttempts.slice(-5).reverse(),
  });
});

// ==========================================
// 8. ADMIN PLATFORM OVERVIEW & GOVERNANCE
// ==========================================

apiRouter.get('/admin/stats', requireAdmin, (req: Request, res: Response) => {
  const db = dbManager.getData();

  const totalUsers = db.users.length;
  const totalCreators = db.users.filter((u) => u.role === 'creator').length;
  const activeCreators = db.users.filter(
    (u) => u.role === 'creator' && (u.accessStatus === 'active' || (!u.accessExpiresAt && !u.disabled))
  ).length;
  const expiredCreators = db.users.filter(
    (u) => u.role === 'creator' && u.accessStatus === 'expired'
  ).length;
  const totalQuizzes = db.quizzes.length;
  const totalAttempts = db.attempts.length;
  const activeQuizzes = db.quizzes.filter((q) => q.isPublished).length;
  const totalHubs = db.learningHubs.length;
  const pendingPaymentRequests = (db.paymentRequests || []).filter((r) => r.status === 'pending').length;

  return res.json({
    totalUsers,
    totalCreators,
    activeCreators,
    expiredCreators,
    totalQuizzes,
    totalParticipants: totalAttempts,
    activeQuizzes,
    totalHubs,
    pendingPaymentRequests,
    auditLogs: db.auditLogs.slice(0, 25),
  });
});

// Admin System Settings (Master Switch: Payment ON / OFF, Bank Details, Trial rules)
apiRouter.get('/admin/settings', requireAdmin, (req: Request, res: Response) => {
  const db = dbManager.getData();
  return res.json({ settings: db.systemSettings });
});

apiRouter.put('/admin/settings', requireAdmin, (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  const updates = req.body;

  dbManager.update((state) => {
    state.systemSettings = {
      ...state.systemSettings,
      ...updates,
      bankDetails: {
        ...state.systemSettings.bankDetails,
        ...(updates.bankDetails || {}),
      },
    };

    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'SETTINGS_UPDATE',
      details: `Payment system master switch set to ${state.systemSettings.paymentSystemEnabled ? 'ON' : 'OFF'}. Free trial: ${state.systemSettings.freeTrialEnabled ? 'ON' : 'OFF'}.`,
      actor: admin?.email || 'Admin',
      timestamp: new Date().toISOString(),
    });
  });

  const updated = dbManager.getData().systemSettings;
  return res.json({ settings: updated });
});

// Admin Search and List Creators (by unique creator code or keyword)
apiRouter.get('/admin/creators', requireAdmin, (req: Request, res: Response) => {
  const db = dbManager.getData();
  const searchCode = (req.query.code as string || '').trim().toUpperCase();
  const searchKeyword = (req.query.search as string || '').trim().toLowerCase();

  let creators = db.users.filter((u) => u.role === 'creator' || u.role === 'admin');

  if (searchCode) {
    creators = creators.filter((u) => u.creatorCode && u.creatorCode.toUpperCase().includes(searchCode));
  } else if (searchKeyword) {
    creators = creators.filter(
      (u) =>
        u.fullName.toLowerCase().includes(searchKeyword) ||
        u.email.toLowerCase().includes(searchKeyword) ||
        (u.creatorCode && u.creatorCode.toLowerCase().includes(searchKeyword))
    );
  }

  // Enrich with creator metrics
  const summaries = creators.map((c) => {
    const creatorQuizzes = db.quizzes.filter((q) => q.creatorId === c.id);
    const quizIds = creatorQuizzes.map((q) => q.id);
    const participantCount = db.attempts.filter((a) => quizIds.includes(a.quizId)).length;
    const hubCount = db.learningHubs.filter((h) => h.creatorId === c.id).length;
    const pendingReqs = (db.paymentRequests || []).filter((r) => r.creatorId === c.id && r.status === 'pending');
    const allReqs = (db.paymentRequests || []).filter((r) => r.creatorId === c.id);
    const latestReq = allReqs[allReqs.length - 1] || null;

    return {
      id: c.id,
      email: c.email,
      fullName: c.fullName,
      creatorCode: c.creatorCode || 'N/A',
      role: c.role,
      createdAt: c.createdAt,
      disabled: Boolean(c.disabled),
      accessStatus: c.accessStatus || 'active',
      trialStartedAt: c.trialStartedAt,
      trialExpiresAt: c.trialExpiresAt,
      accessStartedAt: c.accessStartedAt,
      accessExpiresAt: c.accessExpiresAt,
      accessDurationDays: c.accessDurationDays,
      trialQuizzesAllowed: c.trialQuizzesAllowed,
      trialQuizzesUsed: c.trialQuizzesUsed,
      quizzesCount: creatorQuizzes.length,
      totalParticipants: participantCount,
      learningHubCount: hubCount,
      pendingRequestsCount: pendingReqs.length,
      latestPaymentRequest: latestReq,
    };
  });

  return res.json({ creators: summaries });
});

// Admin Get Single Creator Details
apiRouter.get('/admin/creators/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = dbManager.getData();

  const creator = db.users.find(
    (u) => u.id === id || (u.creatorCode && u.creatorCode.toUpperCase() === id.toUpperCase())
  );

  if (!creator) {
    return res.status(404).json({ error: 'Creator account not found.' });
  }

  const creatorQuizzes = db.quizzes.filter((q) => q.creatorId === creator.id);
  const quizIds = creatorQuizzes.map((q) => q.id);
  const quizAttempts = db.attempts.filter((a) => quizIds.includes(a.quizId));
  const creatorHubs = db.learningHubs.filter((h) => h.creatorId === creator.id);
  const creatorRequests = (db.paymentRequests || []).filter((r) => r.creatorId === creator.id);

  const enrichedQuizzes = creatorQuizzes.map((q) => {
    const qAttempts = db.attempts.filter((a) => a.quizId === q.id);
    const qCount = db.questions.filter((item) => item.quizId === q.id).length;
    return {
      ...q,
      participantCount: qAttempts.length,
      questionCount: qCount,
    };
  });

  return res.json({
    creator: {
      id: creator.id,
      email: creator.email,
      fullName: creator.fullName,
      creatorCode: creator.creatorCode || 'N/A',
      role: creator.role,
      createdAt: creator.createdAt,
      disabled: Boolean(creator.disabled),
      accessStatus: creator.accessStatus || 'active',
      trialStartedAt: creator.trialStartedAt,
      trialExpiresAt: creator.trialExpiresAt,
      accessStartedAt: creator.accessStartedAt,
      accessExpiresAt: creator.accessExpiresAt,
      accessDurationDays: creator.accessDurationDays,
      quizzesCount: creatorQuizzes.length,
      totalParticipants: quizAttempts.length,
      learningHubCount: creatorHubs.length,
    },
    quizzes: enrichedQuizzes,
    hubs: creatorHubs,
    paymentRequests: creatorRequests,
    recentAttempts: quizAttempts.slice(-10).reverse(),
  });
});

// Admin Manually Activate Creator
apiRouter.post('/admin/creators/:id/activate', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { durationDays, notes } = req.body;
  const admin = getAuthUser(req);
  const db = dbManager.getData();

  const days = parseInt(String(durationDays || 30), 10);
  const safeDays = isNaN(days) || days <= 0 ? 30 : days;

  let targetCreator: User | undefined;

  dbManager.update((state) => {
    targetCreator = state.users.find(
      (u) => u.id === id || (u.creatorCode && u.creatorCode.toUpperCase() === id.toUpperCase())
    );

    if (targetCreator) {
      targetCreator.accessStatus = 'active';
      targetCreator.accessStartedAt = new Date().toISOString();
      targetCreator.accessExpiresAt = new Date(Date.now() + safeDays * 86400000).toISOString();
      targetCreator.accessDurationDays = safeDays;
      targetCreator.lastPaymentVerifiedAt = new Date().toISOString();

      state.auditLogs.unshift({
        id: generateId('log'),
        action: 'CREATOR_ACTIVATE',
        details: `Creator ${targetCreator.fullName} (${targetCreator.creatorCode}) activated for ${safeDays} days.${notes ? ` Note: ${notes}` : ''}`,
        actor: admin?.email || 'Admin',
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (!targetCreator) {
    return res.status(404).json({ error: 'Creator account not found.' });
  }

  const { password: _, ...safe } = targetCreator;
  return res.json({ creator: safe, message: `Creator activated for ${safeDays} days.` });
});

// Admin Set or Change Custom Expiry Date
apiRouter.post('/admin/creators/:id/set-expiry', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { expiresAt } = req.body;
  const admin = getAuthUser(req);

  if (!expiresAt) {
    return res.status(400).json({ error: 'Expiry date is required.' });
  }

  const targetDate = new Date(expiresAt);
  if (isNaN(targetDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format.' });
  }

  let targetCreator: User | undefined;

  dbManager.update((state) => {
    targetCreator = state.users.find(
      (u) => u.id === id || (u.creatorCode && u.creatorCode.toUpperCase() === id.toUpperCase())
    );

    if (targetCreator) {
      targetCreator.accessExpiresAt = targetDate.toISOString();
      targetCreator.accessStatus = targetDate.getTime() > Date.now() ? 'active' : 'expired';

      state.auditLogs.unshift({
        id: generateId('log'),
        action: 'CREATOR_EXPIRY_CHANGE',
        details: `Creator ${targetCreator.fullName} (${targetCreator.creatorCode}) expiry date updated to ${targetDate.toLocaleDateString()}. Status: ${targetCreator.accessStatus}.`,
        actor: admin?.email || 'Admin',
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (!targetCreator) {
    return res.status(404).json({ error: 'Creator account not found.' });
  }

  const { password: _, ...safe } = targetCreator;
  return res.json({ creator: safe, message: `Expiry date updated to ${targetDate.toLocaleDateString()}.` });
});

// Admin Toggle Creator Access (Enable / Disable)
apiRouter.put('/admin/creators/:id/toggle-access', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const admin = getAuthUser(req);
  let targetCreator: User | undefined;

  dbManager.update((state) => {
    targetCreator = state.users.find(
      (u) => u.id === id || (u.creatorCode && u.creatorCode.toUpperCase() === id.toUpperCase())
    );

    if (targetCreator) {
      if (targetCreator.accessStatus === 'disabled') {
        targetCreator.accessStatus = 'active';
        if (!targetCreator.accessExpiresAt || new Date(targetCreator.accessExpiresAt).getTime() < Date.now()) {
          targetCreator.accessExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
        }
      } else {
        targetCreator.accessStatus = 'disabled';
      }

      state.auditLogs.unshift({
        id: generateId('log'),
        action: 'CREATOR_ACCESS_TOGGLE',
        details: `Creator ${targetCreator.fullName} (${targetCreator.creatorCode}) access status toggled to ${targetCreator.accessStatus}.`,
        actor: admin?.email || 'Admin',
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (!targetCreator) {
    return res.status(404).json({ error: 'Creator account not found.' });
  }

  const { password: _, ...safe } = targetCreator;
  return res.json({ creator: safe });
});

// ==========================================
// 9. PAYMENT REQUESTS (MANUAL BANK TRANSFERS)
// ==========================================

// Admin list all payment requests
apiRouter.get('/admin/payment-requests', requireAdmin, (req: Request, res: Response) => {
  const db = dbManager.getData();
  const statusFilter = req.query.status as string;

  let list = db.paymentRequests || [];
  if (statusFilter) {
    list = list.filter((r) => r.status === statusFilter);
  }

  const sorted = [...list].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );

  return res.json({ requests: sorted });
});

// Admin Verify and Activate Payment Request
apiRouter.post('/admin/payment-requests/:id/verify', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { durationDays } = req.body;
  const admin = getAuthUser(req);
  const db = dbManager.getData();

  const days = parseInt(String(durationDays || db.systemSettings.paidAccessDurationDays || 30), 10);
  const safeDays = isNaN(days) || days <= 0 ? 30 : days;

  let matchedRequest: PaymentRequest | undefined;
  let matchedCreator: User | undefined;

  dbManager.update((state) => {
    matchedRequest = (state.paymentRequests || []).find((r) => r.id === id);

    if (matchedRequest) {
      matchedRequest.status = 'verified';
      matchedRequest.verifiedAt = new Date().toISOString();
      matchedRequest.verifiedBy = admin?.email || 'Admin';
      matchedRequest.durationGrantedDays = safeDays;

      matchedCreator = state.users.find((u) => u.id === matchedRequest?.creatorId);
      if (matchedCreator) {
        matchedCreator.accessStatus = 'active';
        matchedCreator.accessStartedAt = new Date().toISOString();
        matchedCreator.accessExpiresAt = new Date(Date.now() + safeDays * 86400000).toISOString();
        matchedCreator.accessDurationDays = safeDays;
        matchedCreator.lastPaymentVerifiedAt = new Date().toISOString();
      }

      state.auditLogs.unshift({
        id: generateId('log'),
        action: 'PAYMENT_VERIFY',
        details: `Payment request ${matchedRequest.id} for ${matchedRequest.creatorName} verified. Account activated for ${safeDays} days.`,
        actor: admin?.email || 'Admin',
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (!matchedRequest) {
    return res.status(404).json({ error: 'Payment request not found.' });
  }

  return res.json({
    request: matchedRequest,
    creator: matchedCreator,
    message: `Payment verified. Creator account activated for ${safeDays} days.`,
  });
});

// Admin Reject Payment Request
apiRouter.post('/admin/payment-requests/:id/reject', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin = getAuthUser(req);

  let matchedRequest: PaymentRequest | undefined;

  dbManager.update((state) => {
    matchedRequest = (state.paymentRequests || []).find((r) => r.id === id);

    if (matchedRequest) {
      matchedRequest.status = 'rejected';
      matchedRequest.rejectionReason = reason ? String(reason).trim() : 'Payment reference could not be verified.';

      state.auditLogs.unshift({
        id: generateId('log'),
        action: 'PAYMENT_REJECT',
        details: `Payment request ${matchedRequest.id} rejected. Reason: ${matchedRequest.rejectionReason}`,
        actor: admin?.email || 'Admin',
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (!matchedRequest) {
    return res.status(404).json({ error: 'Payment request not found.' });
  }

  return res.json({ request: matchedRequest, message: 'Payment request rejected.' });
});

// Admin Delete Payment Request
apiRouter.delete('/admin/payment-requests/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;

  dbManager.update((state) => {
    state.paymentRequests = (state.paymentRequests || []).filter((r) => r.id !== id);
  });

  return res.json({ success: true });
});

// ==========================================
// 10. CREATOR ACCESS & "I HAVE PAID" WORKFLOW
// ==========================================

// Creator Get Current Access Status
apiRouter.get('/creator/access-status', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const db = dbManager.getData();
  const settings = db.systemSettings;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const access = dbManager.checkCreatorAccess(user.id);
  const userPendingReq = (db.paymentRequests || []).find(
    (r) => r.creatorId === user.id && r.status === 'pending'
  );

  return res.json({
    userId: user.id,
    paymentSystemEnabled: settings.paymentSystemEnabled,
    userRole: user.role,
    creatorCode: user.creatorCode,
    accessStatus: settings.paymentSystemEnabled ? access.status : user.accessStatus || 'active',
    accessExpiresAt: user.accessExpiresAt || null,
    trialExpiresAt: user.trialExpiresAt || null,
    trialQuizzesAllowed: user.trialQuizzesAllowed ?? settings.freeTrialQuizzes ?? 0,
    trialQuizzesUsed: user.trialQuizzesUsed ?? 0,
    canCreateQuiz: access.canCreateQuiz,
    canCreateHub: access.canCreateHub,
    accessFeeAmount: settings.accessFeeAmount,
    currency: settings.currency,
    bankDetails: settings.bankDetails,
    pendingRequest: userPendingReq || null,
  });
});

// Creator Submit Payment Request ("I Have Paid")
apiRouter.post('/creator/payment-request', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required to submit payment.' });
  }

  const { amount, senderName, senderBank, referenceNumber, notes, receiptUrl } = req.body;

  if (!senderName || !referenceNumber) {
    return res.status(400).json({ error: 'Sender name and payment reference / narration are required.' });
  }

  const db = dbManager.getData();
  const settings = db.systemSettings;

  const newRequest: PaymentRequest = {
    id: generateId('pay_req'),
    creatorId: user.id,
    creatorName: user.fullName,
    creatorEmail: user.email,
    creatorCode: user.creatorCode || 'N/A',
    amount: Number(amount) || settings.accessFeeAmount || 5000,
    currency: settings.currency || 'NGN',
    paymentMethod: 'manual_transfer',
    senderName: String(senderName).trim(),
    senderBank: senderBank ? String(senderBank).trim() : undefined,
    referenceNumber: String(referenceNumber).trim(),
    notes: notes ? String(notes).trim() : undefined,
    receiptUrl: receiptUrl ? String(receiptUrl).trim() : undefined,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  dbManager.update((state) => {
    if (!state.paymentRequests) state.paymentRequests = [];
    state.paymentRequests.unshift(newRequest);

    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'PAYMENT_SUBMITTED',
      details: `Creator ${user.fullName} (${user.creatorCode}) submitted payment request ${newRequest.id} for ${newRequest.amount} ${newRequest.currency}.`,
      actor: user.email,
      timestamp: new Date().toISOString(),
    });
  });

  return res.status(201).json({
    request: newRequest,
    message: 'Payment confirmation submitted successfully. Awaiting administrator manual verification.',
  });
});


// ==========================================
// PRIVATE QUIZZES: REGISTRATION & ONE-TIME EXAM CODES
// ==========================================

function normCode(c: any): string {
  return String(c || '').trim().toUpperCase();
}

function makeExamCode(existing: string[]): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do {
    code = 'EX-';
    for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
  } while (existing.includes(code));
  return code;
}

function attemptLimit(quiz: Quiz): number {
  if (quiz.accessType === 'private') return 1;
  if (quiz.maxAttempts === 0) return Infinity;
  return Math.max(1, quiz.maxAttempts ?? 1);
}

// Returns an error message if the code is not valid for this candidate, otherwise null
function checkPrivateAccess(db: any, quiz: Quiz, code: any, email: string): string | null {
  if (quiz.accessType !== 'private') return null;
  const c = normCode(code);
  if (!c) return 'An exam code is required for this private quiz.';
  const reg = (db.registrations || []).find((r: Registration) => r.quizId === quiz.id && r.code === c);
  if (!reg || reg.status === 'cancelled') return 'Invalid or cancelled exam code.';
  if (reg.email.toLowerCase() !== email.toLowerCase()) return 'This exam code belongs to a different candidate.';
  if (reg.attemptId) return 'This exam code has already been used.';
  return null;
}

function canManageQuiz(req: Request, quiz: Quiz): boolean {
  const u = getAuthUser(req);
  return !!u && !u.disabled && (u.role === 'admin' || u.id === quiz.creatorId);
}

function createRegistration(
  quiz: Quiz,
  input: { name?: any; email?: any; phone?: any }
): { error?: string; status?: number; registration?: Registration } {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const phone = String(input.phone || '').trim();
  if (!name) return { error: 'Full name is required.', status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'A valid email is required.', status: 400 };
  if (phone.replace(/\D/g, '').length < 7) return { error: 'A valid phone number is required.', status: 400 };

  const db = dbManager.getData();
  const dup = db.registrations.find((r) => r.quizId === quiz.id && r.email === email && r.status === 'active');
  if (dup) {
    return {
      error: 'This email is already registered for this quiz. Ask the quiz creator to resend your exam code.',
      status: 409,
    };
  }

  const registration: Registration = {
    id: generateId('reg'),
    quizId: quiz.id,
    name,
    email,
    phone,
    code: makeExamCode(db.registrations.filter((r) => r.quizId === quiz.id).map((r) => r.code)),
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  dbManager.update((state) => {
    state.registrations.push(registration);
  });
  return { registration };
}

// Student self-registration (opened from the creator's registration link)
apiRouter.post('/quizzes/:idOrCode/register', (req: Request, res: Response) => {
  const key = req.params.idOrCode;
  const db = dbManager.getData();
  const quiz = db.quizzes.find((q) => q.id === key || q.shareCode.toUpperCase() === key.toUpperCase());
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  if (quiz.accessType !== 'private') {
    return res.status(400).json({ error: 'This quiz is public and does not need registration.' });
  }
  const result = createRegistration(quiz, req.body || {});
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  const r = result.registration!;
  return res.status(201).json({
    registration: { code: r.code, name: r.name, email: r.email },
    quiz: { id: quiz.id, title: quiz.title },
  });
});

// Creator: list registrations
apiRouter.get('/quizzes/:id/registrations', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const quiz = db.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  if (!canManageQuiz(req, quiz)) return res.status(403).json({ error: 'Not allowed.' });
  const list = db.registrations
    .filter((r) => r.quizId === quiz.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ registrations: list });
});

// Creator: add a student by hand
apiRouter.post('/quizzes/:id/registrations', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const quiz = db.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  if (!canManageQuiz(req, quiz)) return res.status(403).json({ error: 'Not allowed.' });
  const result = createRegistration(quiz, req.body || {});
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  return res.status(201).json({ registration: result.registration });
});

// Creator: cancel a code
apiRouter.delete('/quizzes/:id/registrations/:regId', (req: Request, res: Response) => {
  const db = dbManager.getData();
  const quiz = db.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  if (!canManageQuiz(req, quiz)) return res.status(403).json({ error: 'Not allowed.' });
  const exists = db.registrations.some((r) => r.id === req.params.regId && r.quizId === quiz.id);
  if (!exists) return res.status(404).json({ error: 'Registration not found.' });
  dbManager.update((state) => {
    const r = state.registrations.find((x) => x.id === req.params.regId);
    if (r) r.status = 'cancelled';
  });
  return res.json({ ok: true });
});

// Student: check an exam code before starting
apiRouter.post('/cbt/verify-code', (req: Request, res: Response) => {
  const { quizId, code } = req.body || {};
  if (!quizId || !code) return res.status(400).json({ error: 'quizId and code are required.' });
  const db = dbManager.getData();
  const quiz = db.quizzes.find((q) => q.id === quizId || q.shareCode.toUpperCase() === String(quizId).toUpperCase());
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  const c = normCode(code);
  const reg = db.registrations.find((r) => r.quizId === quiz.id && r.code === c);
  if (!reg || reg.status === 'cancelled') return res.status(403).json({ error: 'Invalid or cancelled exam code.' });
  return res.json({ name: reg.name, email: reg.email, used: !!reg.attemptId });
});


// ==========================================
// SCHEDULED MOCK WINDOW & PRIVATE CODE CHECK
// ==========================================

function scheduleFields(body: any): { opensAt: string | null; closesAt: string | null; windowHours: number } {
  const hours = Math.min(24 * 30, Math.max(1, parseNullableInt(body?.windowHours) ?? 24));
  const opens = body?.opensAt ? new Date(body.opensAt) : null;
  if (!opens || isNaN(opens.getTime())) return { opensAt: null, closesAt: null, windowHours: hours };
  return {
    opensAt: opens.toISOString(),
    closesAt: new Date(opens.getTime() + hours * 3600 * 1000).toISOString(),
    windowHours: hours,
  };
}

function scheduleStatus(quiz: Quiz): 'upcoming' | 'open' | 'closed' {
  if (!quiz.opensAt || !quiz.closesAt) return 'open';
  const now = Date.now();
  if (now < Date.parse(quiz.opensAt)) return 'upcoming';
  if (now > Date.parse(quiz.closesAt)) return 'closed';
  return 'open';
}

function scheduleBlock(req: Request, quiz: Quiz): string | null {
  if (canManageQuiz(req, quiz)) return null;
  const st = scheduleStatus(quiz);
  if (st === 'open') return null;
  return st === 'upcoming' ? 'This quiz has not opened yet.' : 'This quiz is closed.';
}

function validCodeForQuiz(db: any, quiz: Quiz, code: any): boolean {
  const c = normCode(code);
  if (!c) return false;
  return (db.registrations || []).some(
    (r: Registration) => r.quizId === quiz.id && r.code === c && r.status === 'active' && !r.attemptId
  );
}


function canManageHub(req: Request, hub: LearningHub): boolean {
  const u = getAuthUser(req);
  return !!u && !u.disabled && (u.role === 'admin' || u.id === hub.creatorId);
}


// Admin: give a user a temporary password (shown once to the admin to pass on)
apiRouter.post('/admin/users/:id/reset-password', requireAdmin, (req: Request, res: Response) => {
  const db = dbManager.getData();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === 'usr_admin') {
    return res.status(400).json({ error: 'The admin password is changed in the Vercel settings (ADMIN_PASSWORD).' });
  }
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let temp = '';
  for (let i = 0; i < 10; i++) temp += chars[randomInt(chars.length)];
  dbManager.update((state) => {
    const t = state.users.find((u) => u.id === target.id);
    if (t) t.password = hashPassword(temp);
    state.auditLogs.unshift({
      id: generateId('log'),
      action: 'PASSWORD_RESET',
      details: `Admin set a temporary password for ${target.email}.`,
      timestamp: new Date().toISOString(),
      actor: 'Admin',
    });
  });
  return res.json({ tempPassword: temp, email: target.email });
});
