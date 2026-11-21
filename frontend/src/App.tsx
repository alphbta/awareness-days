import LoginPage from './LoginPage';
import RoleSelect from './RoleSelect';
import OrganizerDashboard from './OrganizerDashboard';
import CreateMeeting from './CreateMeeting';
import JoinMeeting from './JoinMeeting'; // <-- Страница проверки оборудования и подключения

function App() {
  const path = window.location.pathname;

  if (path === '/role') return <RoleSelect />;
  if (path === '/dashboard/create') return <CreateMeeting />;
  if (path === '/dashboard/join') return <JoinMeeting />; // <-- Проверка оборудования / комната встречи
  if (path === '/dashboard') return <OrganizerDashboard />;

  return <LoginPage />;
}

export default App;