// src/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault(); // prevent page refresh

    // simple login validation (replace with real auth later)
    if (email === "test@example.com" && password === "12345") {
      alert("Login successful!");
      navigate("/home");
    } else {
      alert("Invalid email or password!");
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    alert("Signup successful!");
    // After signup, switch back to login form
    setIsLogin(true);
  };

  return (
    <div className="container">
      <div className="form-box">
        <h1 className="title">{isLogin ? "Login Form" : "Signup Form"}</h1>

        <form className="input-group" onSubmit={isLogin ? handleLogin : handleSignup}>
          {!isLogin && (
            <input
              type="text"
              className="input-field"
              placeholder="Full Name"
              required
            />
          )}
          <input
            type="email"
            className="input-field"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input-field"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {isLogin ? (
            <>
              <a href="#" className="forgot">
                Forgot password?
              </a>
              <button type="submit" className="submit-btn">
                Login
              </button>
              <p className="switch-text">
                Not a member?{" "}
                <span onClick={() => setIsLogin(false)}>Signup now</span>
              </p>
            </>
          ) : (
            <>
              <button type="submit" className="submit-btn">
                Signup
              </button>
              <p className="switch-text">
                Already have an account?{" "}
                <span onClick={() => setIsLogin(true)}>Login now</span>
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
