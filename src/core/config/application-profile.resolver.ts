import type {
  ApplicationRegistry,
  RegisteredApplication,
} from './application-adapter.types';

export function validateApplicationRegistry(registry: ApplicationRegistry): void {
  for (const [id, entry] of Object.entries(registry)) {
    if (id !== entry.profile.id || id !== entry.adapter.id) {
      throw new Error(
        `Application registry entry "${id}" must match both profile.id and adapter.id`,
      );
    }

    if (entry.adapter.profile !== entry.profile) {
      throw new Error(`Application registry entry "${id}" must share one profile reference`);
    }
  }
}

/** Resolves a caller-supplied APP_PROFILE value through an explicit static map. */
export function resolveApplicationProfile(
  appProfile: string | undefined,
  registry: ApplicationRegistry,
): RegisteredApplication {
  if (appProfile === undefined || appProfile.trim().length === 0) {
    throw new Error('APP_PROFILE is required');
  }

  const resolved = registry[appProfile];
  if (resolved === undefined) {
    const known = Object.keys(registry).sort();
    const suffix = known.length === 0 ? 'no profiles are registered' : `known profiles: ${known.join(', ')}`;
    throw new Error(`Unknown APP_PROFILE "${appProfile}"; ${suffix}`);
  }

  return resolved;
}

export function listApplicationProfiles(registry: ApplicationRegistry): readonly string[] {
  return Object.keys(registry).sort();
}
