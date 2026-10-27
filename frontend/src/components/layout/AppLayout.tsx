// ==============================================================================
// AssetVault: Modern AppLayout Shell
// Course: BCSE307L Database Systems (Fall 2026-27)
// Collapsible/pinnable sidebar, 56px blurred glass topbar, and max-1400px scrollable main area
// ==============================================================================

import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { GeminiChatWidget } from '../ai/GeminiChatWidget';
import { SendGmailModal } from '../notifications/SendGmailModal';

const LOCAL_STORAGE_COLLAPSE_KEY = 'assetvault_sidebar_collapsed';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  // Pinnable sidebar state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(LOCAL_STORAGE_COLLAPSE_KEY) === 'true';
    }
    return false;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LOCAL_STORAGE_COLLAPSE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar: 64px collapsed, 240px expanded */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar: 56px Blurred Glass */}
        <Navbar onMobileMenuToggle={() => setIsMobileOpen(true)} />

        {/* Scrollable Main Area (Max 1400px Centered) */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[1400px] w-full mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Floating Multi-Turn Gemini Chatbot */}
      <GeminiChatWidget />

      {/* Direct Gmail Notification & License Email Modal */}
      <SendGmailModal />
    </div>
  );
};
