import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import MainLayout from './MainLayout';
import WelcomePopup from '@/components/WelcomePopup';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainLayout />
        <WelcomePopup />
      </AuthProvider>
    </LanguageProvider>
  );
}
