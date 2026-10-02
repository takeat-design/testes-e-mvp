import { createContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authService } from '../services/authService';
import { isSupabaseConfigured } from '../lib/supabase';
import { inspectLocalMigration, migrateLocalDataToSupabase, type LocalMigrationOverview } from '../services/localMigrationService';

type AuthContextValue = {
  email: string;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function SupabaseAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [migrationOverview, setMigrationOverview] = useState<LocalMigrationOverview | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [continueWithoutMigration, setContinueWithoutMigration] = useState(false);

  async function authorizeSession(nextSession: Session) {
    const hasAccess = await authService.hasWorkspaceAccess(nextSession.user.id);
    if (!hasAccess) {
      await authService.signOut();
      throw new Error('Esta conta ainda não foi adicionada ao workspace.');
    }
    setMigrationOverview(await inspectLocalMigration());
    setContinueWithoutMigration(false);
    setSession(nextSession);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;

    void authService.getSession()
      .then(async (currentSession) => {
        if (!currentSession) return null;
        await authorizeSession(currentSession);
        return currentSession;
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Não foi possível validar a sessão.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const nextSession = await authService.signIn(email.trim(), password);
      await authorizeSession(nextSession);
      setPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    await authService.signOut();
    setSession(null);
    setMigrationOverview(null);
    setContinueWithoutMigration(false);
  }

  async function handleMigration() {
    setErrorMessage('');
    setIsMigrating(true);
    try {
      setMigrationOverview(await migrateLocalDataToSupabase());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível migrar os dados locais.');
    } finally {
      setIsMigrating(false);
    }
  }

  if (!isSupabaseConfigured) return children;

  if (isLoading) {
    return <main className="auth-screen"><p>Verificando sessão...</p></main>;
  }

  if (!session) {
    return (
      <main className="auth-screen">
        <form className="auth-panel" onSubmit={handleSignIn}>
          <img className="auth-logo" src={new URL('../../img/takeat logo.png', import.meta.url).href} alt="Takeat" />
          <div>
            <p className="eyebrow">TESTES E MVP</p>
            <h1>Acessar sistema</h1>
          </div>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Senha</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
          <button type="submit" className="button primary" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </main>
    );
  }

  const needsMigrationReview = Boolean(
    migrationOverview
    && migrationOverview.localTotal > 0
    && !migrationOverview.alreadyMigrated
    && !continueWithoutMigration,
  );

  if (needsMigrationReview && migrationOverview) {
    const canStartMigration = migrationOverview.remoteTotal === 0 || migrationOverview.canResume;
    const entityLabels: Record<string, string> = {
      customers: 'Clientes',
      recruitment_history: 'Histórico de recrutamento',
      groups: 'Grupos',
      group_members: 'Membros dos grupos',
      tests: 'Testes',
      test_rounds: 'Rodadas',
      test_assignments: 'Participações',
      test_notes: 'Notas',
    };

    return (
      <main className="auth-screen">
        <section className="auth-panel auth-migration-panel">
          <img className="auth-logo" src={new URL('../../img/takeat logo.png', import.meta.url).href} alt="Takeat" />
          <div>
            <p className="eyebrow">MIGRAÇÃO DE DADOS</p>
            <h1>Dados deste navegador</h1>
            <p className="auth-description">Os dados locais serão copiados para o Supabase. A cópia local será mantida.</p>
          </div>
          <div className="auth-migration-list">
            {Object.entries(migrationOverview.localCounts).filter(([, count]) => count > 0).map(([entity, count]) => (
              <div key={entity}><span>{entityLabels[entity] ?? entity}</span><strong>{count}</strong></div>
            ))}
            <div className="auth-migration-total"><span>Total local</span><strong>{migrationOverview.localTotal}</strong></div>
          </div>
          {migrationOverview.remoteTotal > 0 && !migrationOverview.canResume && (
            <p className="auth-warning" role="status">
              O Supabase já contém {migrationOverview.remoteTotal} registros. A importação automática foi bloqueada para evitar duplicações; os dados locais continuam preservados.
            </p>
          )}
          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
          <button type="button" className="button primary" disabled={!canStartMigration || isMigrating} onClick={() => void handleMigration()}>
            {isMigrating ? 'Migrando dados...' : migrationOverview.canResume ? 'Retomar migração' : 'Migrar dados locais'}
          </button>
          <button type="button" className="button outline" onClick={() => setContinueWithoutMigration(true)}>Continuar sem mesclar</button>
          <button type="button" className="auth-sign-out" onClick={() => void handleSignOut()}>Sair da conta</button>
        </section>
      </main>
    );
  }

  return <AuthContext.Provider value={{ email: session.user.email ?? '', signOut: handleSignOut }}>{children}</AuthContext.Provider>;
}
