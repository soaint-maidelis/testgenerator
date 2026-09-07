import type { AppProfile } from './app-profile.types';

/** Technical application boundary kept separate from declarative profile data. */
export interface ApplicationAdapter {
  readonly id: string;
  readonly profile: AppProfile;
}

export interface RegisteredApplication {
  readonly profile: AppProfile;
  readonly adapter: ApplicationAdapter;
}

export type ApplicationRegistry = Readonly<Record<string, RegisteredApplication>>;
