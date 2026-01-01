import React from 'react';
import { useAuth } from './auth.store';
import { AuthPage } from './AuthPage';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Restoring secure session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return <>{children}</>;
};