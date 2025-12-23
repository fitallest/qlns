
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, User as UserIcon, KeyRound } from 'lucide-react';
import { Modal, Input, Button } from './ui';
import { storageService } from '../services/storageService';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!passForm.oldPass || !passForm.newPass || !passForm.confirmPass) {
        alert("Vui lòng điền đầy đủ thông tin.");
        return;
    }
    if (passForm.newPass !== passForm.confirmPass) {
        alert("Mật khẩu mới không khớp.");
        return;
    }
    if (passForm.newPass.length < 6) {
        alert("Mật khẩu mới phải có ít nhất 6 ký tự.");
        return;
    }

    setLoading(true);
    try {
        await storageService.changePassword(user.id, passForm.oldPass, passForm.newPass);
        alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
        setShowChangePassModal(false);
        onLogout();
    } catch (error: any) {
        alert(error.message || "Đã xảy ra lỗi khi đổi mật khẩu.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-blue-600">SaleFlow Pro</span>
              <span className="ml-4 px-3 py-1 rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                {user.role === UserRole.DIRECTOR ? 'Administrator' : 'Nhân viên kinh doanh'}
              </span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden sm:flex items-center text-sm text-gray-700">
                <UserIcon size={16} className="mr-2" />
                <span className="font-medium">{user.name}</span>
                <span className="ml-1 text-gray-400">({user.id})</span>
              </div>
              
              <button 
                onClick={() => {
                    setPassForm({ oldPass: '', newPass: '', confirmPass: '' });
                    setShowChangePassModal(true);
                }}
                className="p-2 text-gray-500 hover:text-blue-600 transition-colors rounded-full hover:bg-gray-50"
                title="Đổi mật khẩu"
              >
                <KeyRound size={20} />
              </button>

              <button 
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-red-600 transition-colors rounded-full hover:bg-gray-50"
                title="Đăng xuất"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Change Password Modal */}
      <Modal isOpen={showChangePassModal} onClose={() => setShowChangePassModal(false)} title="ĐỔI MẬT KHẨU CÁ NHÂN">
        <div className="p-1 space-y-4">
            <Input 
                type="password" 
                label="Mật khẩu hiện tại" 
                value={passForm.oldPass} 
                onChange={e => setPassForm({...passForm, oldPass: e.target.value})} 
            />
            <div className="border-t border-gray-100 pt-2 space-y-4">
                <Input 
                    type="password" 
                    label="Mật khẩu mới" 
                    value={passForm.newPass} 
                    onChange={e => setPassForm({...passForm, newPass: e.target.value})} 
                />
                <Input 
                    type="password" 
                    label="Xác nhận mật khẩu mới" 
                    value={passForm.confirmPass} 
                    onChange={e => setPassForm({...passForm, confirmPass: e.target.value})} 
                />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <Button variant="ghost" onClick={() => setShowChangePassModal(false)} disabled={loading}>Hủy</Button>
                <Button onClick={handleChangePassword} disabled={loading} className="px-6 font-bold">
                    {loading ? 'Đang xử lý...' : 'XÁC NHẬN ĐỔI'}
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
};
