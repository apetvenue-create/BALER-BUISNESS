
import React, { useState } from 'react';
import { useAuth } from './auth.store';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, loading, error: authError } = useAuth();
  
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
      if (validationErrors[field]) {
          setValidationErrors(prev => {
              const next = { ...prev };
              delete next[field];
              return next;
          });
      }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4 font-sans text-gray-900">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white tracking-wide">Financial Manager</h1>
          <p className="text-blue-100 text-sm mt-1">
              {isSignUp ? "Create your secure account" : "Secure Enterprise Access"}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Business Name (Sign Up Only) */}
            {isSignUp && (
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Business / Shop Name</label>
                    <input
                        type="text"
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${validationErrors.businessName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                        placeholder="e.g. Gupta Traders"
                        value={businessName}
                        onChange={e => { setBusinessName(e.target.value); clearError('businessName'); }}
                        disabled={loading}
                    />
                    {validationErrors.businessName && (
                        <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.businessName}</p>
                    )}
                </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${validationErrors.email ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                placeholder="user@company.com"
                value={email}
                onChange={e => { setEmail(e.target.value); clearError('email'); }}
                disabled={loading}
              />
              {validationErrors.email && (
                  <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${validationErrors.password ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                placeholder="••••••••"
                value={pass}
                onChange={e => { setPass(e.target.value); clearError('password'); }}
                disabled={loading}
              />
              {validationErrors.password && (
                  <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.password}</p>
              )}
            </div>

            {/* Confirm Password (Sign Up Only) */}
            {isSignUp && (
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                    <input
                        type="password"
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${validationErrors.confirmPass ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                        placeholder="••••••••"
                        value={confirmPass}
                        onChange={e => { setConfirmPass(e.target.value); clearError('confirmPass'); }}
                        disabled={loading}
                    />
                    {validationErrors.confirmPass && (
                        <p className="text-red-500 text-xs mt-1 font-medium">{validationErrors.confirmPass}</p>
                    )}
                </div>
            )}

            {/* Global API Error */}
            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium">
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center text-sm text-gray-600">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                  type="button"
                  onClick={() => {
                      setIsSignUp(!isSignUp);
                      setValidationErrors({});
                      setBusinessName('');
                      setEmail('');
                      setPass('');
                      setConfirmPass('');
                  }}
                  className="font-bold text-blue-600 hover:underline focus:outline-none"
              >
                  {isSignUp ? "Sign In" : "Sign Up"}
              </button>
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Transaction Manager. Authorized personnel only.
          </p>
        </div>
      </div>
    </div>
  );
};
