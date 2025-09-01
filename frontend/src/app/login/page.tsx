'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';

// Generate fixed star positions to avoid hydration mismatch
const generateStars = () => {
  const stars = [];
  for (let i = 0; i < 100; i++) {
    // Use deterministic values based on index to avoid Math.random()
    const pseudoRandom1 = (i * 7919) % 1000 / 1000; // pseudo random 0-1
    const pseudoRandom2 = (i * 7873) % 1000 / 1000; // pseudo random 0-1
    const pseudoRandom3 = (i * 7841) % 1000 / 1000; // pseudo random 0-1
    const pseudoRandom4 = (i * 7829) % 1000 / 1000; // pseudo random 0-1
    const pseudoRandom5 = (i * 7817) % 1000 / 1000; // pseudo random 0-1
    const pseudoRandom6 = (i * 7789) % 1000 / 1000; // pseudo random 0-1
    
    // Determine star type for different twinkle effects
    const starType = i % 5; // 5 different star types
    
    stars.push({
      id: i,
      left: pseudoRandom1 * 100,
      top: pseudoRandom2 * 100,
      size: pseudoRandom3 * 3 + 1,
      delay: pseudoRandom4 * 4,
      duration: (pseudoRandom1 + pseudoRandom2) * 3 + 2,
      twinkleDelay: pseudoRandom5 * 2,
      opacity: pseudoRandom6 * 0.7 + 0.3, // 0.3 to 1.0
      type: starType
    });
  }
  return stars;
};

const STARS = generateStars();

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<'email' | 'username'>('email');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login } = useAuth();

  // Clear input when switching login method
  const handleLoginMethodChange = (method: 'email' | 'username') => {
    setLoginMethod(method);
    setEmailOrUsername('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Basic input check first
      if (!emailOrUsername.trim()) {
        setError(loginMethod === 'email' ? 'กรุณากรอกอีเมล' : 'กรุณากรอกชื่อผู้ใช้');
        return;
      }

      if (!password.trim()) {
        setError('กรุณากรอกรหัสผ่าน');
        return;
      }

      // Prepare login credentials based on method
      const credentials = loginMethod === 'email' 
        ? { email: emailOrUsername.trim(), password }
        : { username: emailOrUsername.trim(), password };

      // Attempt login
      const result = await login(credentials);
      
      if (result.success) {
        console.log('✅ Login successful, redirecting to dashboard...');
        // Small delay to ensure auth state is updated
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute requireAuth={false}>
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Satellite Earth Background */}
      <div className="absolute inset-0 z-0">
        {/* Earth Layer */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3CradialGradient id='earth' cx='50%25' cy='40%25' r='60%25'%3E%3Cstop offset='0%25' stop-color='%23001122'/%3E%3Cstop offset='40%25' stop-color='%23003366'/%3E%3Cstop offset='70%25' stop-color='%23004488'/%3E%3Cstop offset='100%25' stop-color='%23000000'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23earth)'/%3E%3C/svg%3E")`
          }}
        ></div>
        
        {/* Stars Layer */}
        <div className="absolute inset-0 opacity-60">
          {STARS.map((star) => {
            // Different star classes for different twinkle effects
            const starClasses = [
              'animate-twinkle-slow',
              'animate-twinkle-fast', 
              'animate-twinkle-random',
              'animate-sparkle',
              'animate-glow'
            ];
            
            return (
              <div
                key={star.id}
                className={`absolute rounded-full bg-white ${starClasses[star.type]}`}
                style={{
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  opacity: star.opacity,
                  animationDelay: `${star.twinkleDelay}s`,
                  animationDuration: `${star.duration}s`,
                  boxShadow: star.type === 3 || star.type === 4 ? '0 0 6px rgba(255, 255, 255, 0.8)' : 'none'
                }}
              ></div>
            );
          })}
        </div>

        {/* Satellite Path Layer */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>
          <div className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        {/* Floating Satellites */}
        <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-cyan-400 rounded-sm animate-float" style={{animationDelay: '0s'}}></div>
        <div className="absolute top-3/4 left-1/4 w-3 h-3 bg-blue-400 rounded-sm animate-float" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-purple-400 rounded-sm animate-float" style={{animationDelay: '3s'}}></div>

        {/* Grid Overlay */}
        <div className="absolute inset-0 opacity-10">
          <div 
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(34, 211, 238, 0.2) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(34, 211, 238, 0.2) 1px, transparent 1px)
              `,
              backgroundSize: 'calc(100% / 12) calc(100% / 8)'
            }}
          ></div>
        </div>

        {/* Atmospheric Glow */}
        <div className="absolute inset-0 bg-gradient-radial from-cyan-900/20 via-transparent to-transparent"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-black/40 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">TerraHost</h1>
            <p className="text-gray-400">ยินดีต้อนรับกลับมา</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-red-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.860-.833-2.63 0L3.184 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Login Method Toggle */}
            <div className="mb-4">
              <div className="flex rounded-lg bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => handleLoginMethodChange('email')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                    loginMethod === 'email'
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  อีเมล
                </button>
                <button
                  type="button"
                  onClick={() => handleLoginMethodChange('username')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                    loginMethod === 'username'
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  ชื่อผู้ใช้
                </button>
              </div>
            </div>

            {/* Email/Username Input */}
            <div>
              <label htmlFor="emailOrUsername" className="block text-sm font-medium text-gray-200 mb-2">
                {loginMethod === 'email' ? 'อีเมล' : 'ชื่อผู้ใช้'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {loginMethod === 'email' ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  )}
                </div>
                <input
                  id="emailOrUsername"
                  name="emailOrUsername"
                  type={loginMethod === 'email' ? 'email' : 'text'}
                  autoComplete={loginMethod === 'email' ? 'email' : 'username'}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-600 rounded-lg bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-400 transition-all duration-200"
                  placeholder={loginMethod === 'email' ? 'your@email.com' : 'ชื่อผู้ใช้ของคุณ'}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-10 py-3 border border-gray-600 rounded-lg bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-400 transition-all duration-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-gray-600 bg-black/20 border-gray-600 rounded focus:ring-gray-500 focus:ring-2"
                />
                <span className="ml-2 text-sm text-gray-200">จำฉันไว้</span>
              </label>
              <a href="#" className="text-sm text-gray-300 hover:text-gray-100 transition-colors">
                ลืมรหัสผ่าน?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-gray-700 to-gray-900 text-white py-3 px-4 rounded-lg font-medium shadow-lg hover:from-gray-600 hover:to-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </div>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <span className="text-gray-400 text-sm">
              ยังไม่มีบัญชี?{' '}
              <a href="/register" className="text-gray-300 hover:text-gray-100 font-medium transition-colors">
                สมัครสมาชิก
              </a>
            </span>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-r from-gray-600 to-gray-800 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full opacity-20 blur-xl"></div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes twinkle-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes twinkle-fast {
          0%, 100% { opacity: 0.5; }
          25% { opacity: 1; }
          75% { opacity: 0.2; }
        }
        @keyframes twinkle-random {
          0% { opacity: 0.4; }
          20% { opacity: 1; }
          40% { opacity: 0.6; }
          60% { opacity: 0.9; }
          80% { opacity: 0.3; }
          100% { opacity: 0.7; }
        }
        @keyframes sparkle {
          0%, 100% { 
            opacity: 0.6; 
            transform: scale(1) rotate(0deg);
            filter: brightness(1);
          }
          25% { 
            opacity: 1; 
            transform: scale(1.5) rotate(90deg);
            filter: brightness(1.5);
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.2) rotate(180deg);
            filter: brightness(1.2);
          }
          75% { 
            opacity: 1; 
            transform: scale(1.3) rotate(270deg);
            filter: brightness(1.4);
          }
        }
        @keyframes glow {
          0%, 100% { 
            opacity: 0.5;
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
            transform: scale(1);
          }
          50% { 
            opacity: 1;
            box-shadow: 0 0 15px rgba(255, 255, 255, 1), 0 0 25px rgba(255, 255, 255, 0.5);
            transform: scale(1.4);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-twinkle-slow {
          animation: twinkle-slow 4s infinite ease-in-out;
        }
        .animate-twinkle-fast {
          animation: twinkle-fast 1.5s infinite ease-in-out;
        }
        .animate-twinkle-random {
          animation: twinkle-random 3s infinite ease-in-out;
        }
        .animate-sparkle {
          animation: sparkle 2.5s infinite ease-in-out;
        }
        .animate-glow {
          animation: glow 3.5s infinite ease-in-out;
        }
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
    </ProtectedRoute>
  );
}
