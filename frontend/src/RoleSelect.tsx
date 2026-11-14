import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';
import { authApi, tokenStorage } from './api';
import type { RoleType } from './types';
import PageBackground from './PageBackground';

const ROLE_INFO = {
  member: {
    title: 'Встреча ещё не началась',
    description: 'Ожидайте начала встречи',
  },
} as const;

function RoleSelect() {
  const [role, setRole] = useState<RoleType>('member');
  
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Пре-филл имени из аккаунта, если пользователь уже авторизован
  useEffect(() => {
    if (!tokenStorage.get()) return;
    let mounted = true;
    authApi
      .me()
      .then((user) => {
        if (mounted && user.displayName) setDisplayName(user.displayName);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setError('Введите имя и фамилию.');
      return;
    }

    setLoading(true);
    try {
      if (role === 'organizer') {
        if (!login.trim() || !password.trim()) {
          setError('Введите логин и пароль.');
          return;
        }

        // Реальная авторизация ведущего через API
        const result = await authApi.login(login.trim().toLowerCase(), password);
        
        // Сохраняем JWT-токен для дальнейших запросов и восстановления сессии
        tokenStorage.set(result.token);

        localStorage.setItem(
          'awareness-days-role-pending',
          JSON.stringify({ role, displayName: result.user.displayName || trimmedName }),
        );
      } else {
        // Для участника просто сохраняем данные в локальное хранилище
        localStorage.setItem(
          'awareness-days-role-pending',
          JSON.stringify({ role, displayName: trimmedName }),
        );
      }
      
      // Перенаправляем на главную, где App.tsx подхватит токен
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  };

  const isOrganizer = role === 'organizer';

  return (
    <main className="auth-page">
      <PageBackground />
      <section className="auth-layout">
        <section className="auth-card role-card">
          
          {/* Логотип */}
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8 0C5.87827 0 3.84344 0.842855 2.34315 2.34315C0.842855 3.84344 0 5.87827 0 8V36C0 38.1217 0.842855 40.1566 2.34315 41.6569C3.84344 43.1571 5.87827 44 8 44H36C38.1217 44 40.1566 43.1571 41.6569 41.6569C43.1571 40.1566 44 38.1217 44 36V8C44 5.87827 43.1571 3.84344 41.6569 2.34315C40.1566 0.842855 38.1217 0 36 0H8ZM7 15.522C7 14.392 7.916 13.478 9.046 13.478H24.046C25.3116 13.478 26.5254 13.9808 27.4203 14.8757C28.3152 15.7706 28.818 16.9844 28.818 18.25V28.478C28.818 29.606 27.902 30.522 26.772 30.522H11.772C10.5064 30.522 9.29261 30.0192 8.39769 29.1243C7.50276 28.2294 7 27.0156 7 25.75V15.522ZM35.364 14.022C35.516 13.9078 35.6968 13.8382 35.8862 13.8211C36.0756 13.804 36.266 13.8401 36.436 13.9253C36.6059 14.0105 36.7488 14.1415 36.8484 14.3034C36.9481 14.4653 37.0006 14.6519 37 14.842V29.158C37.0006 29.3481 36.9481 29.5347 36.8484 29.6966C36.7488 29.8585 36.6059 29.9895 36.436 30.0747C36.266 30.1599 36.0756 30.196 35.8862 30.1789C35.6968 30.1618 35.516 30.0922 35.364 29.978L31 26.702C30.7454 26.512 30.5386 26.2651 30.3963 25.9811C30.2539 25.6971 30.1798 25.3837 30.18 25.066V18.93C30.18 18.286 30.484 17.68 31 17.294L35.364 14.022Z"
                  fillRule="evenodd"
                  clipRule="evenodd"
                  fill="#3474EC"
                />
              </svg>
            </span>
            <span className="brand-text">Цифровые дни</span>
          </div>

          {/* Заголовки меняются в зависимости от роли */}
          <div className="card-header">
            <h1>{isOrganizer ? 'Вход для ведущего' : 'Вход на встречу'}</h1>
            <p className="card-subtitle" style={{ whiteSpace: 'pre-line' }}>
              {isOrganizer 
                ? 'Войдите в свой аккаунт, чтобы\nсоздать новую встречу' 
                : 'Выберите, как вы хотите войти'}
            </p>
          </div>

          {/* Переключатель ролей */}
          <div className="role-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isOrganizer}
              className={`role-tab${!isOrganizer ? ' active' : ''}`}
              onClick={() => setRole('member')}
            >
              <UserIcon size={20} />
              <span>Участник</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isOrganizer}
              className={`role-tab${isOrganizer ? ' active' : ''}`}
              onClick={() => setRole('organizer')}
            >
              {/* Кастомная иконка короны */}
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.75 0.75L6.136 6.75L0.75 3.25L2.25 13.25H17.25L18.75 3.25L13.364 6.75L9.75 0.75Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/>
              </svg>
              <span>Ведущий</span>
            </button>
          </div>

          {/* Блок с информацией показываем только для участника */}
          {!isOrganizer && (
            <div className="role-info role-info-member">
              <div className="role-info-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute' }}>
                  <circle cx="24" cy="24" r="24" fill="#F0A33A" fillOpacity="0.35"/>
                </svg>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative', zIndex: 1 }}>
                  <path opacity="0.2" d="M16.0002 29.6666C23.5481 29.6666 29.6668 23.5479 29.6668 16C29.6668 8.45209 23.5481 2.33331 16.0002 2.33331C8.45227 2.33331 2.3335 8.45209 2.3335 16C2.3335 23.5479 8.45227 29.6666 16.0002 29.6666Z" fill="#F0A33A"/>
                  <path d="M29.6668 16C29.6668 23.5479 23.5481 29.6666 16.0002 29.6666C8.45227 29.6666 2.3335 23.5479 2.3335 16C2.3335 8.45209 8.45227 2.33331 16.0002 2.33331C23.5481 2.33331 29.6668 8.45209 29.6668 16Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#F0A33A"/>
                  <path d="M21.3869 21.04L17.4803 18.44C16.3203 17.6667 15.7469 17.28 15.4269 16.68C15.1069 16.0933 15.1069 15.4 15.1069 14V8.41333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#F0A33A"/>
                </svg>
              </div>
              <div className="role-info-content">
                <h3>{ROLE_INFO.member.title}</h3>
                <p>{ROLE_INFO.member.description}</p>
              </div>
            </div>
          )}

          {/* Форма */}
          <form className="role-form" onSubmit={submit}>
            
            {/* Поля логина и пароля только для ведущего */}
            {isOrganizer && (
              <>
                <label className="field">
                  <span className="field-label">Логин</span>
                  <div className="input-shell">
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
                  <span className="field-label">Пароль</span>
                  <div className="input-shell">
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
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                  </div>
                </label>
              </>
            )}

            {/* Поле имени для всех */}
            <label className="field">
              <span className="field-label">Ваше имя</span>
              <div className="input-shell">
                {/* Кастомная иконка профиля */}
                <svg width="31" height="24" viewBox="0 0 31 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M4.60417 0.75H25.4167C27.5453 0.75 29.2708 2.47557 29.2708 4.60417V19.25C29.2708 21.3786 27.5453 23.1042 25.4167 23.1042H4.60417C2.47557 23.1042 0.75 21.3786 0.75 19.25V4.60417C0.75 2.47557 2.47557 0.75 4.60417 0.75Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/>
                  <path d="M12.6979 9.61458C12.6979 11.3175 11.3175 12.6979 9.61458 12.6979C7.91171 12.6979 6.53125 11.3175 6.53125 9.61458C6.53125 7.91171 7.91171 6.53125 9.61458 6.53125C11.3175 6.53125 12.6979 7.91171 12.6979 9.61458Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/>
                  <path d="M5.375 18.0938C6.14583 16.0896 7.84167 15.0104 9.61458 15.0104C11.3875 15.0104 13.0833 16.0896 13.8542 18.0938M18.0938 8.84375H23.875M18.0938 14.2396H21.9479" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/>
                </svg>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Введите имя"
                  autoComplete="name"
                />
              </div>
            </label>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? <span className="loader small" /> : 'Войти'}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

export default RoleSelect;