
import React, { useEffect, useState } from 'react';
import { useAuth } from './auth.store';

export const AuthPage: React.FC = () => {
  const {
    signIn,
    signUp,
    submitting,
    error: authError,
    notice: authNotice,
    clearMessages,
  } = useAuth();

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflowY;
    const previousScrollbarGutter = document.documentElement.style.scrollbarGutter;
    document.body.style.overflowY = 'hidden';
    document.documentElement.style.scrollbarGutter = 'auto';

    return () => {
      document.body.style.overflowY = previousBodyOverflow;
      document.documentElement.style.scrollbarGutter = previousScrollbarGutter;
    };
  }, []);
  
  // Mode State
  const [isSignUp, setIsSignUp] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [businessName, setBusinessName] = useState('');

  // Validation State
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // --- DETERMINISTIC VALIDATION LOGIC ---
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. Business Name (Sign Up Only)
    if (isSignUp) {
        if (!businessName.trim()) {
            errors.businessName = "Business / Shop Name is required";
        }
    }

    // 2. Email (Always)
    if (!email.trim()) {
        errors.email = "Email is required";
    } else if (!email.includes('@')) {
        errors.email = "Invalid email format";
    }

    // 3. Password (Always)
    if (!pass) {
        errors.password = "Password cannot be empty";
    } else if (pass.length < 6) {
        errors.password = "Password must be at least 6 characters";
    }

    // 4. Confirm Password (Sign Up Only)
    if (isSignUp) {
        if (!confirmPass) {
            errors.confirmPass = "Confirm password is required";
        } else if (confirmPass !== pass) {
            errors.confirmPass = "Passwords do not match";
        }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // --- FORM HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Fail Fast
    if (!validate()) {
        return;
    }

    try {
      if (isSignUp) {
          await signUp(email, pass, businessName);
      } else {
          await signIn(email, pass);
      }
    } catch (e) {
      // Error is handled by store and displayed via `authError` prop
    }
  };

  // --- FIELD HELPERS ---
  const clearError = (field: string) => {
      if (authError || authNotice) clearMessages();
      if (validationErrors[field]) {
          setValidationErrors(prev => {
              const next = { ...prev };
              delete next[field];
              return next;
          });
      }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-slate-100 px-4 py-3 font-sans text-slate-900 sm:py-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-slate-300/50 blur-3xl" />
      <div className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)]">
        
        {/* Header */}
        <div className="shrink-0 border-b border-blue-500/30 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-600 px-5 py-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-white shadow-sm backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5V8.75A1.75 1.75 0 0 1 5.75 7h12.5A1.75 1.75 0 0 1 20 8.75V19.5M2.5 19.5h19M8 7V4.5h8V7M8 11h2m4 0h2m-8 4h2m4 0h2" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold tracking-[0.08em] text-white sm:text-2xl">BALER BUISNESS</h1>
        </div>

        {/* Form */}
        <div className="min-h-0 overflow-y-auto p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              {isSignUp ? "Enter your details to get started." : "Sign in to continue to your business dashboard."}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            
            {/* Business Name (Sign Up Only) */}
            {isSignUp && (
                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 sm:text-sm">Business / Shop Name</label>
                    <input
                        type="text"
                        autoComplete="organization"
                        autoFocus
                        className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${validationErrors.businessName ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'}`}
                        placeholder="e.g. Gupta Traders"
                        value={businessName}
                        onChange={e => { setBusinessName(e.target.value); clearError('businessName'); }}
                        disabled={submitting}
                    />
                    {validationErrors.businessName && (
                        <p className="mt-1 text-xs font-medium text-red-600">{validationErrors.businessName}</p>
                    )}
                </div>
            )}

            {/* Email */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 sm:text-sm">Email Address</label>
              <input
                type="email"
                autoComplete="email"
                autoFocus={!isSignUp}
                className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${validationErrors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'}`}
                placeholder="name@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); clearError('email'); }}
                disabled={submitting}
              />
              {validationErrors.email && (
                  <p className="mt-1 text-xs font-medium text-red-600">{validationErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 sm:text-sm">Password</label>
              <input
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${validationErrors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'}`}
                placeholder="••••••••"
                value={pass}
                onChange={e => { setPass(e.target.value); clearError('password'); }}
                disabled={submitting}
              />
              {validationErrors.password && (
                  <p className="mt-1 text-xs font-medium text-red-600">{validationErrors.password}</p>
              )}
            </div>

            {/* Confirm Password (Sign Up Only) */}
            {isSignUp && (
                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 sm:text-sm">Confirm Password</label>
                    <input
                        type="password"
                        autoComplete="new-password"
                        className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${validationErrors.confirmPass ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'}`}
                        placeholder="••••••••"
                        value={confirmPass}
                        onChange={e => { setConfirmPass(e.target.value); clearError('confirmPass'); }}
                        disabled={submitting}
                    />
                    {validationErrors.confirmPass && (
                        <p className="mt-1 text-xs font-medium text-red-600">{validationErrors.confirmPass}</p>
                    )}
                </div>
            )}

            {/* Global API Error */}
            {authError && (
              <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                <span aria-hidden="true">⚠</span>
                <span>{authError}</span>
              </div>
            )}

            {authNotice && (
              <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                <span aria-hidden="true">✓</span>
                <span>{authNotice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-4 border-t border-slate-100 pt-4 text-center text-xs text-slate-500 sm:text-sm">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                  type="button"
                  onClick={() => {
                      setIsSignUp(!isSignUp);
                      setValidationErrors({});
                      clearMessages();
                      setBusinessName('');
                      setEmail('');
                      setPass('');
                      setConfirmPass('');
                  }}
                  className="font-bold text-blue-600 transition hover:text-blue-700 hover:underline focus:outline-none"
              >
                  {isSignUp ? "Sign In" : "Sign Up"}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
