import { configuredOrigin } from './web-policy';
export const WEB_ORIGIN = configuredOrigin(process.env.EXPO_PUBLIC_ZIK_API_ORIGIN, __DEV__);
export function requireOrigin(): string {
  if (!WEB_ORIGIN) throw new Error('Online services are not configured for this build. Your local Vault remains available.');
  return WEB_ORIGIN;
}
