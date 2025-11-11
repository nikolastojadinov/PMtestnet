import React from 'react';
import { PiSDKProvider } from './components/PiSDKProvider';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import MainLayout from './MainLayout';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PiSDKProvider>
          <MainLayout />
        </PiSDKProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
