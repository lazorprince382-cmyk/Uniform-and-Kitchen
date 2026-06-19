export function getAvatarUrl(user) {
  if (user?.avatar_url) return user.avatar_url;
  if (user?.email) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`;
  }
  return 'https://api.dicebear.com/7.x/initials/svg?seed=User';
}

export default function UserAvatar({ user, className = 'w-9 h-9 rounded-full bg-gray-200 object-cover', alt = '' }) {
  return <img src={getAvatarUrl(user)} alt={alt || user?.full_name || 'Profile'} className={className} />;
}
