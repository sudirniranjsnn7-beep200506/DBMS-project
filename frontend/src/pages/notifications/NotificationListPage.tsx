// ==============================================================================
// AssetVault: Notification Slide-Over Panel Page Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Replaces the legacy full-page list with the slide-over notification panel.
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationPanel } from '../../components/notifications/NotificationPanel';

export { NotificationPanel } from '../../components/notifications/NotificationPanel';

export const NotificationListPage: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    navigate(-1);
  };

  return <NotificationPanel isOpen={isOpen} onClose={handleClose} />;
};
