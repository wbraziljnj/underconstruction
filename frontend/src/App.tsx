import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/auth';
import LoginPage from './pages/LoginPage';
import AppShell from './layout/AppShell';
import HomePage from './pages/HomePage';
import ObraPage from './pages/ObraPage';
import CadastrosPage from './pages/CadastrosPage';
import FasesPage from './pages/FasesPage';
import FaturaPage from './pages/FaturaPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 16 }}>Carregando...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/home" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to={user ? '/home' : '/login'} replace />} />

      <Route element={user ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/obra" element={<ObraPage />} />
        <Route path="/cadastros" element={<CadastrosPage />} />
        <Route path="/fases" element={<FasesPage />} />
        <Route path="/fatura" element={<FaturaPage />} />
      </Route>
      <Route path="*" element={<div style={{ padding: 16 }}>404</div>} />
    </Routes>
  );
}
