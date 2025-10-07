import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./Login";
import Home from "./Home"; 
import Profile from "./Profile";


function App() {
  return (
    <Router>
      <Routes>
        {/* Default route → Login page */}
        <Route path="/" element={<Login />} />

        {/* After login → Home page */}
        <Route path="/home" element={<Home />} />
        
         {/* ✅ Profile page route */}
        <Route path="/profile" element={<Profile />} />
       
        
      </Routes>
    </Router>
  );
}

export default App;