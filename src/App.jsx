import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./Login";
import Home from "./Home"; 



function App() {
  return (
    <Router>
      <Routes>
        {/* Default route → Login page */}
        <Route path="/" element={<Login />} />

        {/* After login → Home page */}
        <Route path="/home" element={<Home />} />
        
      </Routes>
    </Router>
  );
}

export default App;