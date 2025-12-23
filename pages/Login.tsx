
import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { User } from '../types';
import { Button, Input } from '../components/ui';
import { LayoutDashboard, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
        const user = await storageService.login(code, password);
        if (user) {
          onLogin(user);
        } else {
          setError('Mã nhân viên hoặc mật khẩu không đúng.');
        }
    } catch (err) {
        setError('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="rounded-full bg-blue-100 p-3">
            <LayoutDashboard className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">NASANI SaleFlow Pro</h2>
        <p className="mt-2 text-center text-sm text-gray-600">Hệ thống quản lý dữ liệu Online</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input 
              label="Mã nhân viên" 
              placeholder="Nhập mã nhân viên..."
              value={code} 
              onChange={(e) => setCode(e.target.value)} 
              autoFocus
              disabled={isLoading}
            />
            <Input 
              label="Mật khẩu" 
              type="password"
              placeholder="Nhập mật khẩu"
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading} 
            />
            
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" size="md" disabled={isLoading}>
              {isLoading ? <><Loader2 className="animate-spin mr-2" size={18}/> Đang kết nối...</> : 'Đăng nhập hệ thống'}
            </Button>
          </form>
        </div>
      </div>

      {/* Developer Credit Footer */}
      <div className="mt-12 sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <a 
            href="https://zalo.me/0909876817" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group inline-flex flex-col items-center justify-center px-8 py-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_0_15px_rgba(59,130,246,0.15)] border border-white/60 hover:scale-105 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all duration-500 cursor-pointer"
        >
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-1.5 group-hover:text-blue-500 transition-colors">
                Phần mềm được phát triển bởi
            </span>
            <span className="text-lg sm:text-xl font-black uppercase tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm">
                Cao Nhất Phi - Nasani
            </span>
        </a>
      </div>
    </div>
  );
};
