import React from 'react';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
};
