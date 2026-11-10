import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingCard } from '@/components/ui';

interface ProtectedRouteProps {
  requiredPermission?: string;
  requiredRole?: string;
  fallbackPath?: string;
}

export function ProtectedRoute({
  requiredPermission,
  requiredRole,
  fallbackPath = '/auth',
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <LoadingCard message="Carregando..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    requiredPermission &&
    user?.role !== 'admin' &&
    !hasPermission(requiredPermission)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

