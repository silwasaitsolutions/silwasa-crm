export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roleKeys: string[];
  permissions: string[];
}

/** Full record including secrets; only repositories and the auth service ever see this. */
export interface UserRecord extends AuthUser {
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}
