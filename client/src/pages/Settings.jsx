import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Palette, Shield, User } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import UserAvatar from '../components/UserAvatar';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SCHOOL } from '../config/school';

const MAX_AVATAR_BYTES = 400 * 1024;

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { themeId, setThemeId, themes } = useTheme();
  const fileRef = useRef(null);

  const [settings, setSettings] = useState({ school: {}, notifications: {} });
  const [profileName, setProfileName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [message, setMessage] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);

  useEffect(() => {
    api.system.settings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.full_name || '');
      setAvatarPreview(user.avatar_url || null);
    }
  }, [user]);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flash('error', 'Please choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      flash('error', 'Photo must be under 400 KB. Try a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile({
        full_name: profileName.trim(),
        avatar_url: avatarPreview,
      });
      updateUser(updated);
      flash('success', 'Profile updated.');
    } catch (err) {
      flash('error', err.message || 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const resetAvatar = () => {
    setAvatarPreview(null);
  };

  const savePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      flash('error', 'New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      flash('success', 'Password changed successfully.');
    } catch (err) {
      flash('error', err.message || 'Could not change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const saveSystem = async () => {
    setSavingSystem(true);
    try {
      await api.system.updateSettings(settings);
      flash('success', 'School settings saved.');
    } catch (err) {
      flash('error', err.message || 'Could not save settings.');
    } finally {
      setSavingSystem(false);
    }
  };

  const previewUser = {
    ...user,
    full_name: profileName || user?.full_name,
    avatar_url: avatarPreview,
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Profile, appearance, and system preferences" />

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Profile */}
        <div className="card p-6 space-y-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-school-navy" />
            <h2 className="font-semibold text-lg">My profile</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <UserAvatar
                  user={previewUser}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-gray-100"
                />
                <button
                  type="button"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-school-navy text-white flex items-center justify-center shadow-md hover:bg-school-navy-light"
                  onClick={() => fileRef.current?.click()}
                  title="Change photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoPick}
                />
              </div>
              <button type="button" className="text-xs text-gray-500 hover:text-gray-800" onClick={resetAvatar}>
                Use default avatar
              </button>
            </div>

            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                <input
                  className="input-field"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input className="input-field bg-gray-50 text-gray-500" value={user?.email || ''} disabled />
                <p className="text-xs text-gray-400 mt-1">Contact an admin to change your login email.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  className="input-field bg-gray-50 text-gray-500"
                  value={user?.role_name || 'Staff'}
                  disabled
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={saveProfile}
                disabled={savingProfile || !profileName.trim()}
              >
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Themes */}
        <div className="card p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-school-navy" />
            <h2 className="font-semibold text-lg">Appearance</h2>
          </div>
          <p className="text-sm text-gray-500">Choose a colour theme for the desk. Saved on this device.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {themes.map((t) => {
              const active = themeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    active
                      ? 'border-school-red bg-school-red/5 ring-2 ring-school-red/20'
                      : 'border-gray-200 hover:border-school-navy/40'
                  }`}
                >
                  <div className="flex gap-1.5 mb-3">
                    {t.preview.map((color) => (
                      <span
                        key={color}
                        className="w-8 h-8 rounded-lg border border-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="font-medium text-sm text-gray-900 flex items-center gap-1">
                    {t.name}
                    {active && <Check className="w-4 h-4 text-school-red" />}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Password */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-school-navy" />
            <h2 className="font-semibold text-lg">Security</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              className="input-field"
              autoComplete="current-password"
              value={passwordForm.current_password}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, current_password: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              className="input-field"
              autoComplete="new-password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              className="input-field"
              autoComplete="new-password"
              value={passwordForm.confirm_password}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
              }
            />
          </div>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={savePassword}
            disabled={
              savingPassword ||
              !passwordForm.current_password ||
              !passwordForm.new_password
            }
          >
            {savingPassword ? 'Updating…' : 'Change password'}
          </button>
        </div>

        {/* School */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-lg">School &amp; stock</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desk / store name</label>
            <input
              className="input-field"
              placeholder={SCHOOL.name}
              value={settings.school?.name || settings.company?.name || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  school: { ...settings.school, name: e.target.value },
                })
              }
            />
            <p className="text-xs text-gray-400 mt-1">Shown on reports and internal labels.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low stock alert threshold</label>
            <input
              className="input-field"
              type="number"
              min={1}
              value={settings.school?.lowStockThreshold ?? settings.company?.lowStockThreshold ?? 20}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  school: { ...settings.school, lowStockThreshold: +e.target.value },
                })
              }
            />
            <p className="text-xs text-gray-400 mt-1">Items at or below this quantity appear as low stock.</p>
          </div>
          <button type="button" className="btn-primary w-full" onClick={saveSystem} disabled={savingSystem}>
            {savingSystem ? 'Saving…' : 'Save school settings'}
          </button>
        </div>

        {/* Notifications */}
        <div className="card p-6 space-y-4 lg:col-span-2">
          <h2 className="font-semibold text-lg">Notifications</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.notifications?.lowStockAlerts ?? true}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, lowStockAlerts: e.target.checked },
                })
              }
            />
            <span>
              <span className="text-sm font-medium text-gray-800 block">Low stock alerts</span>
              <span className="text-xs text-gray-500">Notify when inventory drops below the threshold.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.notifications?.emailAlerts ?? true}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, emailAlerts: e.target.checked },
                })
              }
            />
            <span>
              <span className="text-sm font-medium text-gray-800 block">General email alerts</span>
              <span className="text-xs text-gray-500">System messages and issuance summaries by email.</span>
            </span>
          </label>
          <button type="button" className="btn-primary" onClick={saveSystem} disabled={savingSystem}>
            {savingSystem ? 'Saving…' : 'Save notification preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
