import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Gear, SpeciesId, Trait } from './game';

const TOKEN_KEY = 'pet-battle.session-token';
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
const API_BASE_URL = configuredBaseUrl ?? (Platform.OS === 'web' ? '' : 'https://petbattle.mapleai.top');

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt?: string;
};

export type CloudPet = {
  id: string;
  name: string;
  species: string;
  element: '烈焰' | '潮汐' | '森林';
  level: number;
  hp: number;
  attack: number;
  speciesId: SpeciesId;
  breedId?: string;
  breedName?: string;
  traits: Trait[];
  equipment: Record<string, Gear>;
  image?: string;
};

export type GameState = {
  player: { coins: number; tickets: number; energy: number; checkedIn: boolean };
  pet: CloudPet | null;
  cards: Array<{ id: string; petId: string; rarity: string; locked: boolean; acquiredAt: string }>;
  inventory: Gear[];
};

let sessionToken: string | null = null;

function endpoint(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function assetUrl(path?: string) {
  if (!path || path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  const response = await fetch(endpoint(path), { ...options, headers });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail ?? '服务器暂时不可用，请稍后重试');
  return payload as T;
}

async function storeToken(token: string | null) {
  sessionToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function restoreSession(): Promise<AuthUser | null> {
  sessionToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (!sessionToken) return null;
  try {
    return await request<AuthUser>('/api/auth/me');
  } catch {
    await storeToken(null);
    return null;
  }
}

export async function authenticate(mode: 'login' | 'register', username: string, password: string, displayName?: string) {
  const result = await request<{ token: string; user: AuthUser }>(`/api/auth/${mode}`, {
    method: 'POST',
    body: JSON.stringify({ username, password, display_name: displayName || undefined }),
  });
  await storeToken(result.token);
  return result.user;
}

export async function logout() {
  try {
    await request<void>('/api/auth/logout', { method: 'POST' });
  } finally {
    await storeToken(null);
  }
}

export const fetchGameState = () => request<GameState>('/api/game/state');

export async function saveCloudPet(pet: Omit<CloudPet, 'id'>) {
  return request<{ pet: CloudPet; cards: GameState['cards'] }>('/api/game/pet', {
    method: 'PUT',
    body: JSON.stringify(pet),
  });
}

export const claimCloudCheckIn = () => request<{ message: string; player: GameState['player'] }>('/api/game/check-in', { method: 'POST' });

export const drawCloudEquipment = () => request<{ gear: Gear; player: Omit<GameState['player'], 'checkedIn'> }>('/api/game/equipment/draw', { method: 'POST' });

export const runCloudAdventure = (stageId: string) => request<{
  won: boolean;
  gear: Gear | null;
  coins: number;
  power: number;
  player: Omit<GameState['player'], 'checkedIn'>;
}>('/api/game/adventure', { method: 'POST', body: JSON.stringify({ stageId }) });
