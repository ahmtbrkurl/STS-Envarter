import { createContext, useContext, useState } from 'react';
import { setToken, clearToken, api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthed, setIsAuthed] = useState(!!sessionStorage.getItem('envanter_token'));
  const [userName, setUserName] = useState(sessionStorage.getItem('envanter_user') || '');

  async function login(token, name) {
    const ok = await api.checkToken(token);
    if (!ok) return false;
    setToken(token);
    sessionStorage.setItem('envanter_user', name);
    setUserName(name);
    setIsAuthed(true);
    return true;
  }

  function logout() {
    clearToken();
    sessionStorage.removeItem('envanter_user');
    setIsAuthed(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthed, userName, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
