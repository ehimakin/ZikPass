export const STORE_TYPES = ['Convenience store', 'Supermarket', 'Newsagent', 'Off-licence', 'Pharmacy', 'Other'] as const;
export const SERVICES = { digital: 'In-person ID checks', cards: 'Physical Zik Cards' } as const;
export const SETUP_TASKS = { contact: 'Confirm your store contact and address', training: 'Review the staff ID-check guide', counter: 'Plan your counter setup and card stock' } as const;
export type SetupTask = keyof typeof SETUP_TASKS;
export type ApplicationInput = {
  storeName: string; address: string; storeType: string; googlePlaceId: string;
  contactName: string; email: string; role: string; services: (keyof typeof SERVICES)[];
  consent: boolean; authority: boolean;
};
export type PartnerApplication = {
  id: string; details: ApplicationInput; status: 'submitted' | 'setup' | 'ready';
  createdAt: string; updatedAt: string; completedTasks: SetupTask[];
};
export const emptyApplication: ApplicationInput = { storeName: '', address: '', storeType: '', googlePlaceId: '', contactName: '', email: '', role: '', services: ['digital', 'cards'], consent: false, authority: false };
export function applicationIssue(input: ApplicationInput, step?: number): string | null {
  if (step === undefined || step === 0) {
    if (!input.storeName.trim() || input.storeName.length > 120 || !input.address.trim() || input.address.length > 300) return 'Enter your business name and full store address.';
    if (!(STORE_TYPES as readonly string[]).includes(input.storeType)) return 'Choose your store type.';
    if (input.googlePlaceId.length > 300) return 'Choose a valid Google listing or enter your details manually.';
  }
  if (step === undefined || step === 1) {
    if (!input.contactName.trim() || input.contactName.length > 120 || !['Owner', 'Manager', 'Authorised representative'].includes(input.role)) return 'Enter your name and choose your role.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) return 'Enter a valid work email.';
    if (!input.authority) return 'Confirm that you can apply on behalf of this store.';
  }
  if (step === undefined || step === 2) {
    if (!input.services.length || input.services.length > 2 || input.services.some(service => !Object.hasOwn(SERVICES, service))) return 'Choose at least one service.';
  }
  if ((step === undefined || step === 3) && !input.consent) return 'Agree to the use of your details for this application.';
  return null;
}
