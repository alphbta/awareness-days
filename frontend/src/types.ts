export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'member' | 'organizer' | string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export type AuthMode = 'login' | 'register';
export type RoleType = 'member' | 'organizer';