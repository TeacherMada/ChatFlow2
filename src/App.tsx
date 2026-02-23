import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import FlowBuilder from './components/FlowBuilder';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [selectedFlow, setSelectedFlow] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('chatflow_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('chatflow_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedFlow(null);
    localStorage.removeItem('chatflow_user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (selectedFlow) {
    return <FlowBuilder flow={selectedFlow} onBack={() => setSelectedFlow(null)} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} onSelectFlow={setSelectedFlow} />;
}

