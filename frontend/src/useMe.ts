import { useQuery } from '@tanstack/react-query';

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
  public_flags: number;
  flags: number;
  banner: string | null;
  accent_color: number | null;
  global_name: string | null;
  avatar_decoration_data: unknown;
  collectibles: unknown;
  banner_color: string | null;
  clan: unknown;
  primary_guild: unknown;
  mfa_enabled: boolean;
  locale: string;
  premium_type: number;
}

export function useMe() {
  const { data, isLoading, error } = useQuery<DiscordUser | null>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/me');
      if (!res.ok) return null;
      const data = await res.json();
      return data && !data.error ? data as DiscordUser : null;
    },
  });
  return { user: data, isLoading, error };
} 