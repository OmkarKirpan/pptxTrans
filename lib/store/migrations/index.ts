import { useMigration } from '../index';
import v2AddCommentColor from './v2-add-comment-color';

/**
 * Register all migrations with the store
 * This should be called during app initialization
 */
export function registerMigrations() {
  const { registerMigration } = useMigration();

  // Register migrations in order
  // New migrations should be added here
  [
    v2AddCommentColor,
    // Add future migrations here
  ].forEach(migration => {
    registerMigration(migration);
  });
} 