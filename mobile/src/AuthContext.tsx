import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AddressForm } from "./address";
import { api, setAuthToken, type Role } from "./api";

const STORAGE_KEY = "astackd.session.v1";
const ADDRESS_KEY = "astackd.address.v1";

interface Session {
  token: string;
  userId: string;
  role: Role;
  emailVerified: boolean;
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  savedAddress: AddressForm | null;
  saveAddress: (address: AddressForm) => Promise<void>;
  register: (email: string, password: string, dateOfBirth: string, consentToTerms: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  verifyEmailCode: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [savedAddress, setSavedAddress] = useState<AddressForm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rawSession, rawAddress] = await AsyncStorage.multiGet([STORAGE_KEY, ADDRESS_KEY]);
        const savedSession = rawSession[1];
        if (savedSession) {
          const saved = JSON.parse(savedSession) as Session;
          setAuthToken(saved.token);
          setSession(saved);
        }
        if (rawAddress[1]) setSavedAddress(JSON.parse(rawAddress[1]) as AddressForm);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persist(next: Session): Promise<void> {
    setAuthToken(next.token);
    setSession(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      savedAddress,
      saveAddress: async (address) => {
        setSavedAddress(address);
        await AsyncStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
      },
      register: async (email, password, dateOfBirth, consentToTerms) => {
        const res = await api.register(email, password, dateOfBirth, consentToTerms);
        await persist({ token: res.token, userId: res.userId, role: res.role, emailVerified: res.emailVerified });
      },
      login: async (email, password) => {
        const res = await api.login(email, password);
        await persist({ token: res.token, userId: res.userId, role: res.role, emailVerified: res.emailVerified });
      },
      verifyEmailCode: async (email, token) => {
        await api.verifyEmail(email, token);
        if (session) {
          const next = { ...session, emailVerified: true };
          setSession(next);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      },
      logout: async () => {
        setAuthToken(null);
        setSession(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
      },
    }),
    [session, loading, savedAddress],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
