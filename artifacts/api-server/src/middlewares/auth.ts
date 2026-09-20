import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

type AuthResult = {
  userId?: string | null;
  sessionClaims?: { userId?: unknown } | null;
};

export function createRequireAuth(readAuth: (req: Request) => AuthResult) {
  return function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const auth = readAuth(req);
    const claimUserId = auth.sessionClaims?.userId;
    const userId = typeof claimUserId === "string" ? claimUserId : auth.userId;
    if (!userId) {
      res.status(401).json({ error: "Silakan masuk untuk mengakses proyek." });
      return;
    }
    res.locals.clerkUserId = userId;
    next();
  };
}

export const requireAuth = createRequireAuth((req) => getAuth(req));