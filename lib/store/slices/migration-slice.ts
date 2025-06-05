import { StateCreator } from 'zustand';
import { Migration, MigrationState } from '../types';

// Initial state for migrations
const initialState: Omit<MigrationState, 'registerMigration' | 'migrateToLatest'> = {
  currentVersion: 1, // Start with version 1
  migrations: [],
};

export const createMigrationSlice: StateCreator<
  MigrationState,
  [],
  [],
  MigrationState
> = (set, get) => ({
  ...initialState,

  /**
   * Register a new migration
   * @param migration Migration to register
   */
  registerMigration: (migration: Migration) => {
    set((state) => ({
      migrations: [...state.migrations, migration].sort((a, b) => a.version - b.version)
    }));
  },

  /**
   * Migrate state to the latest version
   * @param state State to migrate
   * @returns Migrated state
   */
  migrateToLatest: (state: any) => {
    const { migrations, currentVersion } = get();
    let resultState = { ...state };

    // Get migrations that need to be applied
    const pendingMigrations = migrations
      .filter(migration => migration.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    if (pendingMigrations.length === 0) {
      return resultState;
    }

    // Apply each migration in sequence
    for (const migration of pendingMigrations) {
      try {
        resultState = migration.up(resultState);
        console.log(`Applied migration to version ${migration.version}`);
      } catch (error) {
        console.error(`Error applying migration to version ${migration.version}:`, error);
        // Stop at first error
        break;
      }
    }

    // Update the current version to the last successfully applied migration
    const lastAppliedVersion = pendingMigrations[pendingMigrations.length - 1].version;
    set({ currentVersion: lastAppliedVersion });

    return resultState;
  }
}); 