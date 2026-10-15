
import { useState } from "react";
import { supabase } from "./supabaseClient";
import "./Login.css";

export default function Login({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (isSignup && name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (isSignup && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        const { data, error: signupError } =
          await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
            },
          });

        if (signupError) throw signupError;

        if (!data.session) {
          setSuccess(
            "Account created! Check your email for a confirmation link, then log in."
          );
          setIsSignup(false);
          setPassword("");
          return;
        }

        // If email confirmation is disabled,
        // Supabase may sign the user in immediately.
        if (data.session && onLogin) {
          onLogin(data.user);
        }
      } else {
        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

        if (loginError) throw loginError;

        if (onLogin) {
          onLogin(data.user);
        }
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo">✳</div>
          <span>AI CivicCare</span>
        </div>

        <div className="login-hero">
          <div className="login-illustration">
            <div className="illustration-sun" />
            <div className="illustration-cloud cloud-one" />
            <div className="illustration-cloud cloud-two" />
            <div className="illustration-building building-one" />
            <div className="illustration-building building-two" />
            <div className="illustration-building building-three" />
            <div className="illustration-ground" />
          </div>

          <div className="login-eyebrow">
            YOUR CITY. YOUR VOICE.
          </div>

          <h1>
            Better cities
            <br />
            begin with <em>you.</em>
          </h1>

          <p>
            Report neighbourhood issues, follow their
            progress, and help make your community better.
          </p>
        </div>

        <div className="login-left-footer">
          A little care goes a long way. ♡
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <div className="login-welcome-icon">✿</div>

            <h2>
              {isSignup ? "Join CivicCare" : "Welcome back"}
            </h2>

            <p>
              {isSignup
                ? "Create your citizen account to get started."
                : "Sign in to continue making a difference."}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <div className="login-field">
                <label htmlFor="signup-name">
                  Full name
                </label>

                <input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-email">
                Email address
              </label>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">
                Password
              </label>

              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={
                    isSignup
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="login-success" role="status">
                {success}
              </div>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isSignup
                ? "Create account →"
                : "Sign in →"}
            </button>
          </form>

          <div className="login-switch">
            {isSignup
              ? "Already have an account?"
              : "New to CivicCare?"}

            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
                setSuccess("");
              }}
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </div>

          <p className="login-disclaimer">
            AI CivicCare · A smarter way to care for your city
          </p>
        </div>
      </div>
    </div>
  );
}
