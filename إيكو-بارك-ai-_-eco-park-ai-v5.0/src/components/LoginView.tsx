import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, LogIn, Mail, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';
import { Language, UserRole } from '../types/parking';
import { ALL_ROLES, ROLE_LABELS_AR, t } from '../data/i18n';

interface LoginViewProps {
  lang: Language;
  onToggleLang: () => void;
  onGoogleLogin: () => Promise<void>;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onEmailRegister: (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  authNotice: string | null;
}

const SIGNUP_ROLES: UserRole[] = ALL_ROLES.filter((r) => r !== 'Super Admin');

export const LoginView: React.FC<LoginViewProps> = ({
  lang,
  onToggleLang,
  onGoogleLogin,
  onEmailLogin,
  onEmailRegister,
  onForgotPassword,
  authLoading,
  authError,
  authNotice,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Driver');
  const [showPassword, setShowPassword] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  const isAutoApprovedRole = selectedRole === 'Driver' || selectedRole === 'Guest';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalValidationError(t(lang, 'يرجى إدخال البريد الإلكتروني.', 'Please enter your email.'));
      return;
    }

    if (mode === 'reset') {
      await onForgotPassword(trimmedEmail);
      return;
    }

    if (password.length < 6) {
      setLocalValidationError(
        t(lang, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'Password must be at least 6 characters.')
      );
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setLocalValidationError(t(lang, 'يرجى إدخال الاسم الكامل.', 'Please enter your full name.'));
        return;
      }
      if (password !== confirmPassword) {
        setLocalValidationError(
          t(lang, 'كلمتا المرور غير متطابقتين.', 'Passwords do not match.')
        );
        return;
      }
      const effectiveRole: UserRole =
        trimmedEmail.toLowerCase() === 'bdalrhmnhrby703@gmail.com'
          ? 'Super Admin'
          : selectedRole;
      await onEmailRegister(name.trim(), trimmedEmail, password, effectiveRole);
    } else {
      await onEmailLogin(trimmedEmail, password);
    }
  };

  const displayError = localValidationError || authError;

  return (
    <div className="min-h-screen w-full bg-[#08121D] text-slate-100 flex flex-col lg:flex-row">
      {/* Main Brand Panel */}
      <div className="flex-1 flex flex-col justify-between bg-[#091826] p-8 lg:p-16 border-b lg:border-b-0 lg:border-e border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-emerald-400">ECO-PARK AI · TEAM 19</span>
          <button
            onClick={onToggleLang}
            className="rounded-lg border border-white/15 bg-[#0E2235] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-400/50"
          >
            {lang === 'ar' ? 'English (LTR)' : 'العربية (RTL)'}
          </button>
        </div>

        <div className="my-12 max-w-xl">
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-emerald-400">
            {t(lang, 'إيكو-بارك AI', 'Eco-Park AI')}
          </h1>
          <p className="mt-2 font-mono text-lg font-medium text-cyan-400">
            ESG Scope 3 · V2G · BESS Smart Parking
          </p>
          <p className="mt-6 text-lg lg:text-xl leading-relaxed text-slate-200 text-balance">
            {t(
              lang,
              'منظومة المواقف الذكية والمستدامة لتقليل الانبعاثات الكربونية، متوافقة مع مبادرة السعودية الخضراء وإدارة الطاقة BESS.',
              'Smart sustainable parking platform engineered to reduce carbon emissions, aligned with Saudi Green Initiative, V2G, and BESS management.'
            )}
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            <div>
              <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">100%</div>
              <div className="mt-1 text-xs text-slate-400">{t(lang, 'إعفاء رسوم EV', 'EV Tariff Discount')}</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-cyan-400 tabular-nums">2D / 3D</div>
              <div className="mt-1 text-xs text-slate-400">{t(lang, 'محاكاة وحراري حي', 'Live PBR & Thermal')}</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums">9 RBAC</div>
              <div className="mt-1 text-xs text-slate-400">{t(lang, 'صلاحيات وأدوار ذكية', 'Role-Based Access')}</div>
            </div>
          </div>
        </div>

        <div className="space-y-1 text-sm text-slate-400">
          <div className="font-semibold text-slate-200">
            {t(lang, 'تم تنفيذ المشروع بواسطة: Team 19 – تيم 19', 'Executed by: Team 19')}
          </div>
          <div>{t(lang, 'رقم المشروع: 108', 'Project ID: 108')}</div>
          <div>
            {t(
              lang,
              'المعهد العالي للإدارة وتكنولوجيا المعلومات بكفر الشيخ',
              'Higher Institute of Management and Information Technology - Kafr El-Sheikh'
            )}
          </div>
        </div>
      </div>

      {/* Auth Panel */}
      <div className="w-full lg:w-[500px] flex flex-col justify-center bg-[#0D1E2E] p-8 lg:p-12">
        <div className="mx-auto w-full max-w-sm space-y-5">
          {/* Segmented Mode Toggle */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-[#08121D] p-1">
              <button
                type="button"
                onClick={() => {
                  setLocalValidationError(null);
                  setMode('login');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'login'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t(lang, 'تسجيل الدخول', 'Sign In')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalValidationError(null);
                  setMode('register');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  mode === 'register'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t(lang, 'إنشاء حساب جديد', 'Create Account')}
              </button>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-white">
              {mode === 'login'
                ? t(lang, 'تسجيل الدخول', 'Sign In')
                : mode === 'register'
                  ? t(lang, 'إنشاء حساب واختيار الدور', 'Create Account & Select Role')
                  : t(lang, 'استعادة كلمة المرور', 'Reset Password')}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {mode === 'login'
                ? t(lang, 'سجّل الدخول بالبريد الإلكتروني وكلمة المرور أو عبر Google.', 'Sign in with email & password or Google.')
                : mode === 'register'
                  ? t(
                      lang,
                      'يُفعّل دور السائق والضيف تلقائياً، بينما تخضع الأدوار التشغيلية لموافقة الأدمن.',
                      'Driver & Guest roles activate immediately; staff roles require Admin approval.'
                    )
                  : t(lang, 'أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور.', 'Enter your email to receive a password reset link.')}
            </p>
          </div>

          {displayError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-200">
              {displayError}
            </div>
          )}

          {authNotice && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs leading-relaxed text-emerald-200">
              {authNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    {t(lang, 'الاسم الكامل', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t(lang, 'أدخل اسمك الكامل', 'Enter full name')}
                    className="w-full rounded-xl border border-white/10 bg-[#08121D] px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    {t(lang, 'الدور الوظيفي في المنظومة (RBAC)', 'Account Role (RBAC)')}
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-white/10 bg-[#08121D] px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  >
                    {SIGNUP_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {lang === 'ar' ? ROLE_LABELS_AR[role] : role}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                    <UserCheck
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isAutoApprovedRole ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <span className={isAutoApprovedRole ? 'text-emerald-300' : 'text-amber-300'}>
                      {isAutoApprovedRole
                        ? t(
                            lang,
                            'قبول تلقائي فوري بدون انتظار موافقة الإدارة.',
                            'Instant automatic activation (no admin approval required).'
                          )
                        : t(
                            lang,
                            'يتطلب قبول أو رفض من المشرف العام (bdalrhmnhrby703@gmail.com).',
                            'Requires approval or rejection by Super Admin.'
                          )}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                {t(lang, 'البريد الإلكتروني', 'Email Address')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-white/10 bg-[#08121D] px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                required
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t(lang, 'كلمة المرور', 'Password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-white/10 bg-[#08121D] px-4 py-2.5 pe-10 text-sm text-white outline-none focus:border-emerald-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t(lang, 'تأكيد كلمة المرور', 'Confirm Password')}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-[#08121D] px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400"
                  required
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setLocalValidationError(null);
                    setMode('reset');
                  }}
                  className="text-xs text-cyan-400 hover:underline"
                >
                  {t(lang, 'نسيت كلمة المرور؟', 'Forgot password?')}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {mode === 'login' && <LogIn className="h-4 w-4" />}
              {mode === 'register' && <UserPlus className="h-4 w-4" />}
              {mode === 'reset' && <KeyRound className="h-4 w-4" />}
              {authLoading
                ? t(lang, 'جاري التنفيذ...', 'Processing...')
                : mode === 'login'
                  ? t(lang, 'تسجيل الدخول', 'Sign In')
                  : mode === 'register'
                    ? t(lang, 'إنشاء حساب', 'Create Account')
                    : t(lang, 'إرسال رابط الاستعادة', 'Send Reset Link')}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-white/10" />
            <span className="mx-3 text-xs text-slate-500">{t(lang, 'أو', 'OR')}</span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-[#10283D] px-4 py-3 text-sm font-semibold text-white transition hover:border-emerald-400 hover:bg-[#143450] disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            {t(lang, 'الدخول بواسطة Google', 'Continue with Google')}
          </button>

          {mode === 'reset' && (
            <div className="pt-2 text-center text-xs text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setLocalValidationError(null);
                  setMode('login');
                }}
                className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-semibold"
              >
                <Mail className="h-3.5 w-3.5" />
                {t(lang, 'العودة لتسجيل الدخول', 'Back to Sign In')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
