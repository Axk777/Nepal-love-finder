
import React, { useState } from 'react';
import { Button, Input, Select, GlassCard, Icons } from '../components/UI';
import { Role } from '../types';
import { APP_NAME } from '../constants';

interface AuthProps {
  onLogin: (email: string, pass: string) => Promise<any>;
  onSignup: (data: any) => Promise<any>;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onSignup }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState<Role>(Role.KTA);
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await onLogin(email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        await onSignup({ 
          email, 
          password, 
          displayName, 
          age: parseInt(age), 
          role 
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      
      <div className="mb-8 text-center animate-fade-in-up z-10">
        <div className="bg-white/20 backdrop-blur-md p-4 rounded-full shadow-lg inline-block mb-4 border border-white/30">
            <Icons.Heart className="text-white w-12 h-12 fill-current drop-shadow-md" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-md">{APP_NAME}</h1>
        <p className="text-white/80 mt-2 font-medium">Find your match, safely & securely.</p>
      </div>

      <GlassCard className="w-full max-w-md p-6 sm:p-8 shadow-2xl z-10">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        
        {error && (
            <div className={`p-4 rounded-xl text-sm mb-4 flex items-start gap-3 shadow-sm border
                ${error.includes("EMAIL_NOT_CONFIRMED") 
                    ? "bg-yellow-50 border-yellow-200 text-yellow-800" 
                    : "bg-red-50 border-red-200 text-red-700"
                }`}>
            <Icons.Alert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
                <span className="font-bold block mb-1">
                    {error.includes("EMAIL_NOT_CONFIRMED") ? "Action Required" : "Error"}
                </span>
                {error.includes("EMAIL_NOT_CONFIRMED") ? (
                    <span>
                        Please verify your email address. Check your inbox (and spam folder) for the confirmation link from Supabase.
                    </span>
                ) : error}
            </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <Input 
                label="Display Name" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)} 
                required 
                placeholder="e.g. HimalBoy"
              />
              <div className="flex gap-4">
                <Input 
                  label="Age" 
                  type="number" 
                  value={age} 
                  onChange={e => setAge(e.target.value)} 
                  required 
                  min="13"
                  className="w-full"
                />
                <Select 
                  label="I am a"
                  value={role}
                  onChange={e => setRole(e.target.value as Role)}
                  options={[
                    { label: 'Kta (Boy)', value: Role.KTA },
                    { label: 'Kti (Girl)', value: Role.KTI }
                  ]}
                  className="w-full"
                />
              </div>
            </>
          )}

          <Input 
            label="Email" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            placeholder="hello@example.com"
          />
          
          <Input 
            label="Password" 
            type={showPassword ? "text" : "password"} 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            placeholder="••••••"
            rightElement={
              <button onClick={togglePasswordVisibility} type="button" className="text-gray-500 hover:text-gray-700 focus:outline-none">
                {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
              </button>
            }
          />

          {!isLogin && (
             <Input 
                label="Confirm Password" 
                type={showPassword ? "text" : "password"} 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                placeholder="••••••"
             />
          )}

          <Button type="submit" fullWidth isLoading={loading} className="mt-6 py-4 text-lg shadow-xl">
            {isLogin ? 'Login' : 'Join Now'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(''); setConfirmPassword(''); }}
              className="text-nepaliRed font-bold hover:underline transition-colors ml-1"
            >
              {isLogin ? 'Sign Up Free' : 'Login Here'}
            </button>
          </p>
        </div>
      </GlassCard>
      
      {!isLogin && (
        <p className="mt-6 text-xs text-white/60 max-w-xs text-center px-4 font-light">
            By joining, you agree to our safety guidelines. 
            Respect others and stay safe.
        </p>
      )}
    </div>
  );
};
