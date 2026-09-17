import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Role } from '../../types.ts';
import {
  BookOpen,
  Shield,
  UserCheck,
  GraduationCap,
  BarChart3,
  LogIn,
  LogOut,
  Users,
  FileText,
  ChevronDown,
  Bookmark,
  Clock,
  Heart,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'catalog' | 'my-shelf' | 'borrows' | 'dashboard' | 'audit' | 'users';
  onTabChange: (tab: 'catalog' | 'my-shelf' | 'borrows' | 'dashboard' | 'audit' | 'users') => void;
  onOpenUpload: () => void;
  pendingBorrowCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenUpload,
  pendingBorrowCount = 0,
}) => {
  const { user, firebaseUser, role, demoRole, signInWithGoogle, switchDemoRole, signOut } = useAuth();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const getRoleBadge = (r: Role) => {
    switch (r) {
      case 'admin':
        return { label: 'Quản trị viên', bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: Shield };
      case 'librarian':
        return { label: 'Thủ thư', bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: UserCheck };
      case 'student':
      default:
        return { label: 'Sinh viên', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: GraduationCap };
    }
  };

  const currentBadge = getRoleBadge(role);
  const CurrentIcon = currentBadge.icon;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('catalog')}>
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">THƯ VIỆN SỐ</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  V1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Trường Cao đẳng Công nghệ & Đào tạo</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => onTabChange('catalog')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'catalog'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Kho tài liệu</span>
            </button>

            {/* Kệ sách của tôi (Tất cả người dùng) */}
            <button
              onClick={() => onTabChange('my-shelf')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                activeTab === 'my-shelf'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Kệ sách của tôi</span>
            </button>

            {/* Quản lý đơn mượn (Thủ thư & Admin) */}
            {(role === 'librarian' || role === 'admin') && (
              <button
                onClick={() => onTabChange('borrows')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 relative ${
                  activeTab === 'borrows'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Duyệt mượn sách</span>
                {pendingBorrowCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                    {pendingBorrowCount}
                  </span>
                )}
              </button>
            )}

            {(role === 'librarian' || role === 'admin') && (
              <button
                onClick={() => onTabChange('dashboard')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            )}

            {(role === 'librarian' || role === 'admin') && (
              <button
                onClick={() => onTabChange('audit')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'audit'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Nhật ký</span>
              </button>
            )}

            {role === 'admin' && (
              <button
                onClick={() => onTabChange('users')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'users'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Phân quyền</span>
              </button>
            )}
          </nav>

          {/* Right Action: Persona Switcher & Auth */}
          <div className="flex items-center space-x-2.5">
            {/* Nút thêm sách nếu là Thủ thư hoặc Admin */}
            {(role === 'librarian' || role === 'admin') && (
              <button
                onClick={onOpenUpload}
                className="hidden sm:inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-colors"
              >
                + Nhập sách PDF
              </button>
            )}

            {/* Chuyển đổi vai trò kiểm thử (Persona Switcher) */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${currentBadge.bg} transition-all`}
                title="Nhấn để đổi vai trò kiểm thử hệ thống"
              >
                <CurrentIcon className="w-3.5 h-3.5" />
                <span>{currentBadge.label}</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-xs text-slate-500 font-medium">
                    Chuyển đổi vai trò trải nghiệm:
                  </div>
                  <button
                    onClick={() => {
                      switchDemoRole('student');
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center space-x-2 hover:bg-slate-50 ${
                      role === 'student' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-medium">Sinh viên (Học sinh)</div>
                      <div className="text-[11px] text-slate-400">Tra cứu, đọc online & gửi đơn mượn</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      switchDemoRole('librarian');
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center space-x-2 hover:bg-slate-50 ${
                      role === 'librarian' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="font-medium">Cán bộ Thủ thư</div>
                      <div className="text-[11px] text-slate-400">Upload PDF, duyệt đơn mượn, xuất CSV</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      switchDemoRole('admin');
                      setShowRoleDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center space-x-2 hover:bg-slate-50 ${
                      role === 'admin' ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-rose-600" />
                    <div>
                      <div className="font-medium">Quản trị viên (Admin)</div>
                      <div className="text-[11px] text-slate-400">Xem audit logs, phân quyền tài khoản</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Google Login / Logout */}
            {firebaseUser ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600">
                  {firebaseUser.photoURL ? (
                    <img src={firebaseUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    firebaseUser.email?.charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  onClick={signOut}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Sign-In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
