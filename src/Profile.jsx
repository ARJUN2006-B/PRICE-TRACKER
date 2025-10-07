import React from 'react';
import './Home.css';
const Profile = () => {
  // Placeholder user data - replace with actual state/props in a real application
  const user = {
    name: "John Doe",
    email: "john.doe@example.com",
    memberSince: "October 2024",
    totalAlerts: 42,
    trackedItems: 15
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
        <p>Manage your account and preferences.</p>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          {/* A simple circular avatar placeholder */}
          <span role="img" aria-label="user-avatar">👤</span>
        </div>
        
        <div className="user-details">
          <h2>{user.name}</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Member Since:</strong> {user.memberSince}</p>
        </div>

        <div className="stats-grid">
          <div className="stat-box">
            <h3>{user.trackedItems}</h3>
            <p>Items Tracked</p>
          </div>
          <div className="stat-box">
            <h3>{user.totalAlerts}</h3>
            <p>Price Alerts Received</p>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h2>Settings & Preferences</h2>
        <ul>
          <li><button className="settings-button">Manage Tracked Products</button></li>
          <li><button className="settings-button">Change Password</button></li>
          <li><button className="settings-button">Notification Settings</button></li>
          <li><button className="settings-button logout">Log Out</button></li>
        </ul>
      </div>
      
    </div>
  );
};

export default Profile;