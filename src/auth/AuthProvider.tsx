import { onIdTokenChanged, signInWithCustomToken, signOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Claims } from '@shared/types';
import { call } from '@/lib/call';
import { deviceId } from '@/lib/device';
import { auth } from '@/lib/firebase';

interface Session {
  user: User;
  claims: Claims;
}

interface AuthValue {
  /** undefined: 확인 중, null: 로그인 안 됨 */
  session: Session | null | undefined;
  loginStudent(input: { sid: string; name: string; phone: string }): Promise<void>;
  loginTeacher(code: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(
    () =>
      onIdTokenChanged(auth, async (user) => {
        if (!user) return setSession(null);
        const { claims } = await user.getIdTokenResult();
        if (claims.role === 'student' || claims.role === 'teacher') {
          setSession({ user, claims: claims as unknown as Claims });
        } else {
          await signOut(auth);
        }
      }),
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({
      session,
      async loginStudent(input) {
        const { token } = await call<object, { token: string }>(
          'loginStudent',
          { ...input, deviceId: deviceId() },
          { busyMessage: '로그인하는 사람이 많아요. 잠시 후 다시 눌러 주세요.' },
        );
        await signInWithCustomToken(auth, token);
      },
      async loginTeacher(code) {
        const { token } = await call<object, { token: string }>('loginTeacher', { code, deviceId: deviceId() });
        await signInWithCustomToken(auth, token);
      },
      logout: () => signOut(auth),
    }),
    [session],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider 밖에서 useAuth 사용');
  return v;
}

/** 로그인된 화면 안에서만 쓰는 편의 함수 */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('로그인 필요');
  return session;
}
