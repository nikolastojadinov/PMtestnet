import React from 'react';
import { PiSDKProvider } from './components/PiSDKProvider';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import MainLayout from './MainLayout';
import WelcomePopup from './components/WelcomePopup';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PiSDKProvider>
          <MainLayout />
          <WelcomePopup />
        </PiSDKProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
