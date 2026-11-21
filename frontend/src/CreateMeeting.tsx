import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronLeft, Clock, Save, ChevronDown, User as UserIcon } from 'lucide-react';
import { tokenStorage } from './api';
import type { User } from './types';

function CreateMeeting() {
  const [user, setUser] = useState<User | null>(null);

  // Состояния формы
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [host, setHost] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Скрытые нативные поля — форма остаётся рабочей,
  // но на видимом поле нет нативного «окошка» выбора (как в макете)
  const dateNativeRef = useRef<HTMLInputElement>(null);
  const timeNativeRef = useRef<HTMLInputElement>(null);

  // Кастомный дропдаун выбора ведущего
  const [hostOpen, setHostOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  // Список ведущих — только текущий пользователь, без выдуманных имён
  const hosts = user ? [user.displayName] : [];

  useEffect(() => {
    // ВРЕМЕННАЯ ЗАГЛУШКА (чтобы страница не выкидывала на /role)
    setUser({
      id: 'test-id',
      email: 'organizer@test.ru',
      displayName: 'Иван Ведущий',
      role: 'organizer',
    });
  }, []);

  // Закрытие списка ведущего по клику вне него
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) {
        setHostOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time || !host) return;

    const dateObj = new Date(date);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const formattedDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;

    const endHour = String(Number(time.split(':')[0]) + 1).padStart(2, '0');
    const formattedTime = `${time}–${endHour}:00`;

    const newMeeting = {
      id: Date.now().toString(),
      title,
      date: formattedDate,
      time: formattedTime,
      host,
      participants: 0,
      status: 'scheduled' as const,
    };

    const existing = JSON.parse(localStorage.getItem('awareness-days-meetings') || '[]');
    localStorage.setItem('awareness-days-meetings', JSON.stringify([newMeeting, ...existing]));

    window.location.href = '/dashboard';
  };

  const displayDate = date ? new Date(date).toLocaleDateString('ru-RU') : '';

  if (!user) {
    return <main className="loading"><span className="loader" /></main>;
  }

  return (
    <div className="dash-page">
      {/* Шапка */}
      <header className="dash-header">
        <div className="dash-brand">
          <svg className="dash-brand-icon" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 0C5.87827 0 3.84344 0.842855 2.34315 2.34315C0.842855 3.84344 0 5.87827 0 8V36C0 38.1217 0.842855 40.1566 2.34315 41.6569C3.84344 43.1571 5.87827 44 8 44H36C38.1217 44 40.1566 43.1571 41.6569 41.6569C43.1571 40.1566 44 38.1217 44 36V8C44 5.87827 43.1571 3.84344 41.6569 2.34315C40.1566 0.842855 38.1217 0 36 0H8ZM7 15.522C7 14.392 7.916 13.478 9.046 13.478H24.046C25.3116 13.478 26.5254 13.9808 27.4203 14.8757C28.3152 15.7706 28.818 16.9844 28.818 18.25V28.478C28.818 29.606 27.902 30.522 26.772 30.522H11.772C10.5064 30.522 9.29261 30.0192 8.39769 29.1243C7.50276 28.2294 7 27.0156 7 25.75V15.522ZM35.364 14.022C35.516 13.9078 35.6968 13.8382 35.8862 13.8211C36.0756 13.804 36.266 13.8401 36.436 13.9253C36.6059 14.0105 36.7488 14.1415 36.8484 14.3034C36.9481 14.4653 37.0006 14.6519 37 14.842V29.158C37.0006 29.3481 36.9481 29.5347 36.8484 29.6966C36.7488 29.8585 36.6059 29.9895 36.436 30.0747C36.266 30.1599 36.0756 30.196 35.8862 30.1789C35.6968 30.1618 35.516 30.0922 35.364 29.978L31 26.702C30.7454 26.512 30.5386 26.2651 30.3963 25.9811C30.2539 25.6971 30.1798 25.3837 30.18 25.066V18.93C30.18 18.286 30.484 17.68 31 17.294L35.364 14.022Z" fillRule="evenodd" clipRule="evenodd" fill="#3474EC" />
          </svg>
          <span className="dash-brand-text">Цифровые дни</span>
        </div>
        <div className="dash-user" onClick={() => { tokenStorage.clear(); window.location.href = '/role'; }} title="Выйти">
          <div className="dash-avatar">{user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</div>
        </div>
      </header>

      {/* Контент */}
      <main className="dash-content create-content">
        <div className="create-top">
          <button className="back-link" onClick={() => window.location.href = '/dashboard'}>
            <ChevronLeft size={20} />
            <span>Вернуться назад</span>
          </button>
          <h1 className="create-title">Создание встречи</h1>
          <p className="create-subtitle">Заполните информацию о мероприятии</p>
        </div>

        <form className="create-card" onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Название встречи<span>*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="Например, День информирования"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label className="form-label">Описание встречи<span>*</span></label>
            <textarea
              className="form-input form-textarea"
              placeholder="Кратко расскажите, о чём будет встреча..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label className="form-label">Ведущий<span>*</span></label>
            <div className="host-select" ref={hostRef}>
              <button
                type="button"
                className="form-input host-trigger"
                onClick={() => setHostOpen((o) => !o)}
              >
                <span className={host ? 'host-value' : 'host-placeholder'}>
                  {host || 'Выберите ведущего'}
                </span>
                <ChevronDown size={20} className={`select-icon ${hostOpen ? 'open' : ''}`} />
              </button>

              {hostOpen && (
                <div className="host-menu">
                  {hosts.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`host-option ${host === name ? 'selected' : ''}`}
                      onClick={() => { setHost(name); setHostOpen(false); }}
                    >
                      <UserIcon size={24} className="host-option-icon" />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">Дата и время встречи<span>*</span></label>
            <div className="date-time-row">
              <div className="field-box date-field" onClick={() => dateNativeRef.current?.showPicker()}>
                <input
                  type="text"
                  readOnly
                  className="field-text"
                  placeholder="Выберите дату"
                  value={displayDate}
                />
                <svg className="date-icon" width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="38" height="38" rx="10" fill="#EAF1FF" />
                  <path d="M14.2253 21.4109C14.6058 21.4109 14.9707 21.2598 15.2398 20.9907C15.5088 20.7217 15.66 20.3568 15.66 19.9763C15.66 19.5958 15.5088 19.2309 15.2398 18.9619C14.9707 18.6928 14.6058 18.5417 14.2253 18.5417C13.8448 18.5417 13.4799 18.6928 13.2109 18.9619C12.9419 19.2309 12.7907 19.5958 12.7907 19.9763C12.7907 20.3568 12.9419 20.7217 13.2109 20.9907C13.4799 21.2598 13.8448 21.4109 14.2253 21.4109ZM15.6609 24.7689C15.6609 25.1494 15.5098 25.5143 15.2407 25.7833C14.9717 26.0524 14.6068 26.2035 14.2263 26.2035C13.8458 26.2035 13.4809 26.0524 13.2119 25.7833C12.9428 25.5143 12.7917 25.1494 12.7917 24.7689C12.7917 24.3884 12.9428 24.0235 13.2119 23.7545C13.4809 23.4854 13.8458 23.3343 14.2263 23.3343C14.6068 23.3343 14.9717 23.4854 15.2407 23.7545C15.5098 24.0235 15.6609 24.3884 15.6609 24.7689ZM19.5 21.4109C19.8805 21.4109 20.2454 21.2598 20.5144 20.9907C20.7835 20.7217 20.9346 20.3568 20.9346 19.9763C20.9346 19.5958 20.7835 19.2309 20.5144 18.9619C20.2454 18.6928 19.8805 18.5417 19.5 18.5417C19.1195 18.5417 18.7546 18.6928 18.4856 18.9619C18.2165 19.2309 18.0654 19.5958 18.0654 19.9763C18.0654 20.3568 18.2165 20.7217 18.4856 20.9907C18.7546 21.2598 19.1195 21.4109 19.5 21.4109ZM20.9356 24.7689C20.9356 25.1494 20.7844 25.5143 20.5154 25.7833C20.2463 26.0524 19.8814 26.2035 19.501 26.2035C19.1205 26.2035 18.7556 26.0524 18.4865 25.7833C18.2175 25.5143 18.0663 25.1494 18.0663 24.7689C18.0663 24.3884 18.2175 24.0235 18.4865 23.7545C18.7556 23.4854 19.1205 23.3343 19.501 23.3343C19.8814 23.3343 20.2463 23.4854 20.5154 23.7545C20.7844 24.0235 20.9356 24.3884 20.9356 24.7689ZM24.7689 21.4109C25.1494 21.4109 25.5143 21.2598 25.7833 20.9907C26.0524 20.7217 26.2035 20.3568 26.2035 19.9763C26.2035 19.5958 26.0524 19.2309 25.7833 18.9619C25.5143 18.6928 25.1494 18.5417 24.7689 18.5417C24.3884 18.5417 24.0235 18.6928 23.7545 18.9619C23.4854 19.2309 23.3343 19.5958 23.3343 19.9763C23.3343 20.3568 23.4854 20.7217 23.7545 20.9907C24.0235 21.2598 24.3884 21.4109 24.7689 21.4109ZM31 12.7917C31 11.5208 30.4952 10.3021 29.5966 9.40345C28.6979 8.50483 27.4792 8 26.2083 8H12.7917C11.5208 8 10.3021 8.50483 9.40345 9.40345C8.50483 10.3021 8 11.5208 8 12.7917V26.2083C8 27.4792 8.50483 28.6979 9.40345 29.5966C10.3021 30.4952 11.5208 31 12.7917 31H26.2083C27.4792 31 28.6979 30.4952 29.5966 29.5966C30.4952 28.6979 31 27.4792 31 26.2083V12.7917ZM9.91667 15.6667H29.0833V26.2083C29.0833 26.9708 28.7804 27.7021 28.2413 28.2413C27.7021 28.7804 26.9708 29.0833 26.2083 29.0833H12.7917C12.0292 29.0833 11.2979 28.7804 10.7587 28.2413C10.2196 27.7021 9.91667 26.9708 9.91667 26.2083V15.6667ZM12.7917 9.91667H26.2083C26.9708 9.91667 27.7021 10.2196 28.2413 10.7587C28.7804 11.2979 29.0833 12.0292 29.0833 12.7917V13.75H9.91667V12.7917C9.91667 12.0292 10.2196 11.2979 10.7587 10.7587C11.2979 10.2196 12.0292 9.91667 12.7917 9.91667Z" fill="#3474EC" />
                </svg>
                <input
                  ref={dateNativeRef}
                  type="date"
                  className="hidden-native"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="field-box time-field" onClick={() => timeNativeRef.current?.showPicker()}>
                <input
                  type="text"
                  readOnly
                  className="field-text"
                  placeholder="Выберите время"
                  value={time}
                />
                {!time && <span className="time-dash">--:--</span>}
                <Clock size={22} className="time-icon" />
                <input
                  ref={timeNativeRef}
                  type="time"
                  className="hidden-native"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        </form>

        <div className="create-actions">
          <button type="submit" className="dash-btn-primary" onClick={handleSubmit}>
            <Save size={18} />
            <span>Сохранить</span>
          </button>
        </div>
      </main>
    </div>
  );
}

export default CreateMeeting;