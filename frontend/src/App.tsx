import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';
import { authApi, tokenStorage } from './api';
import type { User } from './types';
import PageBackground from './PageBackground';
import RoleSelect from './RoleSelect';

function App() {
  if (window.location.pathname === '/role') {
    return <RoleSelect />;
  }

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      if (!tokenStorage.get()) {
        if (mounted) setChecking(false);
        return;
      }
      try {
        const current = await authApi.me();
        if (mounted) setUser(current);
      } catch {
        tokenStorage.clear();
      } finally {
        if (mounted) setChecking(false);
      }
    };
    void restore();
    return () => { mounted = false; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const normalizedLogin = login.trim().toLowerCase();

    if (!normalizedLogin) {
      setError('Введите логин.');
      return;
    }
    if (password.length < 1) {
      setError('Введите пароль.');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.login(normalizedLogin, password);
      tokenStorage.set(result.token);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
    setPassword('');
  };

  if (checking) {
    return <main className="loading"><span className="loader" /></main>;
  }

  return (
    <main className="auth-page">
      <PageBackground />

      <section className="auth-layout">
        <section className="auth-card">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 0C5.87827 0 3.84344 0.842855 2.34315 2.34315C0.842855 3.84344 0 5.87827 0 8V36C0 38.1217 0.842855 40.1566 2.34315 41.6569C3.84344 43.1571 5.87827 44 8 44H36C38.1217 44 40.1566 43.1571 41.6569 41.6569C43.1571 40.1566 44 38.1217 44 36V8C44 5.87827 43.1571 3.84344 41.6569 2.34315C40.1566 0.842855 38.1217 0 36 0H8ZM7 15.522C7 14.392 7.916 13.478 9.046 13.478H24.046C25.3116 13.478 26.5254 13.9808 27.4203 14.8757C28.3152 15.7706 28.818 16.9844 28.818 18.25V28.478C28.818 29.606 27.902 30.522 26.772 30.522H11.772C10.5064 30.522 9.29261 30.0192 8.39769 29.1243C7.50276 28.2294 7 27.0156 7 25.75V15.522ZM35.364 14.022C35.516 13.9078 35.6968 13.8382 35.8862 13.8211C36.0756 13.804 36.266 13.8401 36.436 13.9253C36.6059 14.0105 36.7488 14.1415 36.8484 14.3034C36.9481 14.4653 37.0006 14.6519 37 14.842V29.158C37.0006 29.3481 36.9481 29.5347 36.8484 29.6966C36.7488 29.8585 36.6059 29.9895 36.436 30.0747C36.266 30.1599 36.0756 30.196 35.8862 30.1789C35.6968 30.1618 35.516 30.0922 35.364 29.978L31 26.702C30.7454 26.512 30.5386 26.2651 30.3963 25.9811C30.2539 25.6971 30.1798 25.3837 30.18 25.066V18.93C30.18 18.286 30.484 17.68 31 17.294L35.364 14.022Z" fillRule="evenodd" clipRule="evenodd" fill="#3474EC"/>
              </svg>
            </span>
            <span className="brand-text">Цифровые дни</span>
          </div>

          {user ? (
            <div className="signed-in">
              <h1>Вы вошли</h1>
              <p className="card-subtitle">{user.displayName}</p>
              <p className="signed-email">{user.email}</p>
              <button className="submit-button" onClick={logout}>Выйти</button>
            </div>
          ) : (
            <>
              <div className="card-header">
                <h1>Добро пожаловать</h1>
                <p className="card-subtitle">Войдите в систему для управления встречами</p>
              </div>

              <form className="auth-form" onSubmit={submit}>
                <label className="field">
                  <span>Логин</span>
                  <div className="input-shell">
                    {/* Иконка увеличена до 24 */}
                    <UserIcon size={24} />
                    <input
                      type="text"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="Введите логин"
                      autoComplete="username"
                    />
                  </div>
                </label>
                <label className="field">
                  <span>Пароль</span>
                  <div className="input-shell">
                    {/* Иконка увеличена до 24 */}
                    <Lock size={24} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Введите пароль"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="show-password"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {/* Иконки увеличена до 24 */}
                      {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                  </div>
                </label>

                {error && <p className="error" role="alert">{error}</p>}

                <button className="submit-button" type="submit" disabled={loading}>
                  {loading ? <span className="loader small" /> : 'Войти'}
                </button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;