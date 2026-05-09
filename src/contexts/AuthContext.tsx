import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Mot de passe admin hardcodé
const ADMIN_PASSWORD = '1234azertyuiop';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté (localStorage)
    const authStatus = localStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = async (password: string) => {
    // Vérifier le mot de passe
    if (password !== ADMIN_PASSWORD) {
      throw new Error('Mot de passe incorrect');
    }
    
    // Sauvegarder l'état de connexion
    localStorage.setItem('admin_authenticated', 'true');
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    
    // Rediriger vers le site web principal
    window.location.href = 'https://sienna-otter-965443.hostingersite.com/';
  };

  const value = {
    isAuthenticated,
    loading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
