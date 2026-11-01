import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import crypto from 'node:crypto';
import type { UserAccount, UserRole } from '../types/account.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  sessionUser?: UserAccount;
}

type SessionRecord = { user: UserAccount; expiresAt: number };
const sessions = new Map<string, SessionRecord>();
const SESSION_COOKIE = 'unboxin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const parseCookies = (header?: string): Record<string, string> => {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((result, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return result;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
    return result;
  }, {});
};

const safeUser = (user: UserAccount): UserAccount => {
  const { pin: _pin, ...withoutPin } = user;
  return withoutPin as UserAccount;
};

export const createSession = (user: UserAccount): string => {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { user: safeUser(user), expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
};

export const getSessionUser = (req: Request): UserAccount | null => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
};

export const destroySession = (req: Request): void => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) sessions.delete(token);
};

export const setSessionCookie = (res: Response, token: string, secureRequest = false): void => {
  const secure = secureRequest ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
};

export const clearSessionCookie = (res: Response): void => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
};

export const requireSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Sesi login tidak ditemukan atau sudah berakhir.' });
  req.sessionUser = user;
  next();
};

/** Batasi endpoint tulis berdasarkan peran akun yang sedang login. */
export const requireRoles = (...allowedRoles: UserRole[]) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.sessionUser || getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Sesi login tidak ditemukan atau sudah berakhir.' });
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Akun ini tidak memiliki izin untuk tindakan tersebut.' });
  }
  req.sessionUser = user;
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};



