import { test, expect, describe } from 'bun:test';
import { z } from 'zod';

// Import the schemas from controller (we'll need to extract them to a separate module)
// For now, we'll recreate them here
const createSessionSchema = z.object({
  session_name: z.string().min(1, "Session name is required"),
  original_file_name: z.string().optional(),
  source_language_code: z.string().min(1, "Source language is required"),
  target_language_codes: z.array(z.string().min(1)).min(1, "At least one target language is required"),
  slide_count: z.number().int().positive().optional(),
});

const updateSessionSchema = z.object({
  session_name: z.string().min(1).optional(),
  original_file_name: z.string().optional(),
  source_language_code: z.string().min(1).optional(),
  target_language_codes: z.array(z.string().min(1)).min(1).optional(),
  slide_count: z.number().int().positive().optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).optional(),
  last_opened_at: z.string().datetime({ offset: true }).optional(),
});

describe('Model Validation', () => {
  describe('createSessionSchema', () => {
    test('should validate valid complete input', () => {
      const validData = {
        session_name: 'Test Session',
        original_file_name: 'test.pptx',
        source_language_code: 'en',
        target_language_codes: ['es', 'fr', 'de'],
        slide_count: 10,
      };

      const result = createSessionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    test('should validate minimal required input', () => {
      const validData = {
        session_name: 'Minimal Session',
        source_language_code: 'en',
        target_language_codes: ['es'],
      };

      const result = createSessionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    test('should reject missing session_name', () => {
      const invalidData = {
        source_language_code: 'en',
        target_language_codes: ['es'],
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(1);
        expect(result.error.issues[0].path).toEqual(['session_name']);
        expect(result.error.issues[0].message).toBe('Required');
      }
    });

    test('should reject empty session_name', () => {
      const invalidData = {
        session_name: '',
        source_language_code: 'en',
        target_language_codes: ['es'],
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Session name is required');
      }
    });

    test('should reject missing source_language_code', () => {
      const invalidData = {
        session_name: 'Test Session',
        target_language_codes: ['es'],
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['source_language_code']);
      }
    });

    test('should reject empty source_language_code', () => {
      const invalidData = {
        session_name: 'Test Session',
        source_language_code: '',
        target_language_codes: ['es'],
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Source language is required');
      }
    });

    test('should reject missing target_language_codes', () => {
      const invalidData = {
        session_name: 'Test Session',
        source_language_code: 'en',
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['target_language_codes']);
      }
    });

    test('should reject empty target_language_codes array', () => {
      const invalidData = {
        session_name: 'Test Session',
        source_language_code: 'en',
        target_language_codes: [],
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('At least one target language is required');
      }
    });

    test('should reject empty strings in target_language_codes', () => {
      const invalidData = {
        session_name: 'Test Session',
        source_language_code: 'en',
        target_language_codes: ['es', '', 'fr'],
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['target_language_codes', 1]);
      }
    });

    test('should reject negative slide_count', () => {
      const invalidData = {
        session_name: 'Test Session',
        source_language_code: 'en',
        target_language_codes: ['es'],
        slide_count: -5,
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['slide_count']);
      }
    });

    test('should reject zero slide_count', () => {
      const invalidData = {
        session_name: 'Test Session',
        source_language_code: 'en',
        target_language_codes: ['es'],
        slide_count: 0,
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('should reject non-integer slide_count', () => {
      const invalidData = {
        session_name: 'Test Session',
        source_language_code: 'en',
        target_language_codes: ['es'],
        slide_count: 5.5,
      };

      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('updateSessionSchema', () => {
    test('should validate partial update with session_name', () => {
      const validData = {
        session_name: 'Updated Session Name',
      };

      const result = updateSessionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    test('should validate partial update with status', () => {
      const validData = {
        status: 'in_progress' as const,
      };

      const result = updateSessionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    test('should validate all updatable fields', () => {
      const validData = {
        session_name: 'Updated Session',
        original_file_name: 'updated.pptx',
        source_language_code: 'fr',
        target_language_codes: ['en', 'de'],
        slide_count: 15,
        status: 'completed' as const,
        last_opened_at: '2024-01-01T12:00:00.000Z',
      };

      const result = updateSessionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    test('should validate valid datetime format for last_opened_at', () => {
      const validData = {
        last_opened_at: '2024-01-01T12:00:00.000Z',
      };

      const result = updateSessionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('should reject invalid datetime format for last_opened_at', () => {
      const invalidData = {
        last_opened_at: '2024-01-01 12:00:00',
      };

      const result = updateSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['last_opened_at']);
      }
    });

    test('should validate all valid status values', () => {
      const statuses = ['draft', 'in_progress', 'completed', 'archived'] as const;

      statuses.forEach(status => {
        const validData = { status };
        const result = updateSessionSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    test('should reject invalid status values', () => {
      const invalidData = {
        status: 'invalid_status',
      };

      const result = updateSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['status']);
      }
    });

    test('should reject empty session_name when provided', () => {
      const invalidData = {
        session_name: '',
      };

      const result = updateSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['session_name']);
      }
    });

    test('should reject empty source_language_code when provided', () => {
      const invalidData = {
        source_language_code: '',
      };

      const result = updateSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('should reject empty target_language_codes array when provided', () => {
      const invalidData = {
        target_language_codes: [],
      };

      const result = updateSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    test('should accept empty object (no updates)', () => {
      const result = updateSessionSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });
});