import { useMe } from './useMe';

export default function Header() {
  const { user, isLoading: userLoading } = useMe();

  return (
    <header className="w-full flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-800 shadow">
      <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Discord Trivia Bot</h1>
      <div className="flex items-center gap-4">
        {userLoading ? (
          <span className="text-gray-900 dark:text-gray-100">Loading...</span>
        ) : user ? (
          <>
            {user.avatar && (
              <img
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                alt="avatar"
                className="w-10 h-10 rounded-full border"
              />
            )}
            <span className="font-medium text-gray-900 dark:text-gray-100">{user.global_name}</span>
            <a
              href="/auth/logout"
              className="px-3 py-1 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition text-sm"
            >
              Logout
            </a>
          </>
        ) : (
          <a
            href="/auth/discord"
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-base font-semibold shadow hover:bg-blue-700 dark:hover:bg-blue-600 transition"
          >
            Login with Discord
          </a>
        )}
      </div>
    </header>
  );
} 