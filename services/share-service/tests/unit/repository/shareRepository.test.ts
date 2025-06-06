import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createShare,
  listSharesBySessionId,
  revokeShareByJti,
  findActiveShareByJti,
  getSessionByIdAndOwner,
} from '../../../src/db/shareRepository';
import { createMockSupabaseClient, mockDbSuccess, mockDbError } from '../../mocks/supabase';
import { validCreateShareData, shareRecordFixture, sessionFixture } from '../../fixtures/shareData';
import { SharePermission } from '../../../src/models/share';

describe('Share Repository', () => {
  let mockSupabase: any;
  let mockMethods: any;

  beforeEach(() => {
    const mock = createMockSupabaseClient();
    mockSupabase = mock.supabase;
    mockMethods = mock.mocks;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createShare', () => {
    test('should successfully create a share record', async () => {
      const expectedRecord = { ...shareRecordFixture };
      
      mockMethods.single.mockResolvedValue(mockDbSuccess(expectedRecord));

      const result = await createShare(mockSupabase, validCreateShareData);

      expect(mockSupabase.from).toHaveBeenCalledWith('session_shares');
      expect(mockMethods.insert).toHaveBeenCalledWith({
        session_id: validCreateShareData.session_id,
        share_token_jti: validCreateShareData.share_token_jti,
        permissions: validCreateShareData.permissions,
        expires_at: validCreateShareData.expires_at.toISOString(),
        created_by: validCreateShareData.created_by,
        name: validCreateShareData.name,
        share_url: validCreateShareData.share_url,
      });
      expect(mockMethods.single).toHaveBeenCalled();
      expect(result).toEqual(expectedRecord);
    });

    test('should handle optional fields correctly', async () => {
      const dataWithoutOptionals = {
        ...validCreateShareData,
        name: undefined,
        share_url: undefined,
      };
      
      mockMethods.single.mockResolvedValue(mockDbSuccess(shareRecordFixture));

      await createShare(mockSupabase, dataWithoutOptionals);

      expect(mockMethods.insert).toHaveBeenCalledWith({
        session_id: dataWithoutOptionals.session_id,
        share_token_jti: dataWithoutOptionals.share_token_jti,
        permissions: dataWithoutOptionals.permissions,
        expires_at: dataWithoutOptionals.expires_at.toISOString(),
        created_by: dataWithoutOptionals.created_by,
        name: undefined,
        share_url: undefined,
      });
    });

    test('should throw error on database failure', async () => {
      mockMethods.single.mockResolvedValue(mockDbError('Database connection failed'));

      await expect(createShare(mockSupabase, validCreateShareData))
        .rejects.toThrow('Failed to create share record: Database connection failed');
    });

    test('should throw error when no data is returned', async () => {
      mockMethods.single.mockResolvedValue(mockDbSuccess(null));

      await expect(createShare(mockSupabase, validCreateShareData))
        .rejects.toThrow('Failed to create share record: No data returned.');
    });

    test('should handle constraint violations', async () => {
      mockMethods.single.mockResolvedValue(mockDbError('duplicate key value violates unique constraint'));

      await expect(createShare(mockSupabase, validCreateShareData))
        .rejects.toThrow('Failed to create share record: duplicate key value violates unique constraint');
    });
  });

  describe('listSharesBySessionId', () => {
    test('should return list of active shares for session and user', async () => {
      const expectedShares = [shareRecordFixture];
      
      mockMethods.is.mockResolvedValue(mockDbSuccess(expectedShares));

      const result = await listSharesBySessionId(
        mockSupabase, 
        'session-123', 
        'user-123'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('session_shares');
      expect(mockMethods.select).toHaveBeenCalledWith('*');
      expect(mockMethods.eq).toHaveBeenCalledWith('session_id', 'session-123');
      expect(mockMethods.eq).toHaveBeenCalledWith('created_by', 'user-123');
      expect(mockMethods.is).toHaveBeenCalledWith('revoked_at', null);
      expect(mockMethods.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(expectedShares);
    });

    test('should return empty array when no shares found', async () => {
      mockMethods.is.mockResolvedValue(mockDbSuccess([]));

      const result = await listSharesBySessionId(
        mockSupabase, 
        'session-123', 
        'user-123'
      );

      expect(result).toEqual([]);
    });

    test('should handle shares without share_url gracefully', async () => {
      const shareWithoutUrl = { ...shareRecordFixture, share_url: null };
      mockMethods.is.mockResolvedValue(mockDbSuccess([shareWithoutUrl]));

      const result = await listSharesBySessionId(
        mockSupabase, 
        'session-123', 
        'user-123'
      );

      expect(result).toEqual([shareWithoutUrl]);
    });

    test('should throw error on database failure', async () => {
      mockMethods.is.mockResolvedValue(mockDbError('Database query failed'));

      await expect(listSharesBySessionId(mockSupabase, 'session-123', 'user-123'))
        .rejects.toThrow('Failed to list shares: Database query failed');
    });

    test('should handle null data gracefully', async () => {
      mockMethods.is.mockResolvedValue(mockDbSuccess(null));

      const result = await listSharesBySessionId(
        mockSupabase, 
        'session-123', 
        'user-123'
      );

      expect(result).toEqual([]);
    });
  });

  describe('revokeShareByJti', () => {
    test('should successfully revoke a share', async () => {
      const revokedShare = { 
        ...shareRecordFixture, 
        revoked_at: new Date().toISOString() 
      };
      
      mockMethods.single.mockResolvedValue(mockDbSuccess(revokedShare));

      const result = await revokeShareByJti(
        mockSupabase, 
        'jti-123', 
        'user-123'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('session_shares');
      expect(mockMethods.update).toHaveBeenCalledWith({ 
        revoked_at: expect.any(String) 
      });
      expect(mockMethods.eq).toHaveBeenCalledWith('share_token_jti', 'jti-123');
      expect(mockMethods.eq).toHaveBeenCalledWith('created_by', 'user-123');
      expect(mockMethods.is).toHaveBeenCalledWith('revoked_at', null);
      expect(result).toEqual(revokedShare);
    });

    test('should throw error when share not found', async () => {
      mockMethods.single.mockResolvedValue(mockDbSuccess(null));

      await expect(revokeShareByJti(mockSupabase, 'jti-123', 'user-123'))
        .rejects.toThrow('Failed to revoke share: Share not found, not owned by user, or already revoked.');
    });

    test('should throw error when user is not owner', async () => {
      mockMethods.single.mockResolvedValue(mockDbError('No rows updated'));

      await expect(revokeShareByJti(mockSupabase, 'jti-123', 'wrong-user'))
        .rejects.toThrow('Failed to revoke share: No rows updated');
    });

    test('should throw error on database failure', async () => {
      mockMethods.single.mockResolvedValue(mockDbError('Database update failed'));

      await expect(revokeShareByJti(mockSupabase, 'jti-123', 'user-123'))
        .rejects.toThrow('Failed to revoke share: Database update failed');
    });

    test('should set revoked_at timestamp correctly', async () => {
      const revokedShare = { 
        ...shareRecordFixture, 
        revoked_at: new Date().toISOString() 
      };
      
      mockMethods.single.mockResolvedValue(mockDbSuccess(revokedShare));

      await revokeShareByJti(mockSupabase, 'jti-123', 'user-123');

      const updateCall = mockMethods.update.mock.calls[0][0];
      expect(updateCall.revoked_at).toBeDefined();
      expect(new Date(updateCall.revoked_at)).toBeInstanceOf(Date);
    });
  });

  describe('findActiveShareByJti', () => {
    test('should find active share by JTI', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(shareRecordFixture));

      const result = await findActiveShareByJti(mockSupabase, 'jti-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('session_shares');
      expect(mockMethods.select).toHaveBeenCalledWith('*');
      expect(mockMethods.eq).toHaveBeenCalledWith('share_token_jti', 'jti-123');
      expect(mockMethods.is).toHaveBeenCalledWith('revoked_at', null);
      expect(mockMethods.maybeSingle).toHaveBeenCalled();
      expect(result).toEqual(shareRecordFixture);
    });

    test('should return null when share not found', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(null));

      const result = await findActiveShareByJti(mockSupabase, 'nonexistent-jti');

      expect(result).toBeNull();
    });

    test('should return null for revoked shares', async () => {
      // The query filters for revoked_at IS NULL, so revoked shares won't be returned
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(null));

      const result = await findActiveShareByJti(mockSupabase, 'revoked-jti');

      expect(result).toBeNull();
    });

    test('should handle PGRST116 error gracefully', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbError('No rows found', 'PGRST116'));

      const result = await findActiveShareByJti(mockSupabase, 'jti-123');

      expect(result).toBeNull();
    });

    test('should throw error for other database errors', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbError('Connection timeout', 'CONNECTION_ERROR'));

      await expect(findActiveShareByJti(mockSupabase, 'jti-123'))
        .rejects.toThrow('Database error finding share: Connection timeout');
    });

    test('should return data when found', async () => {
      const shareData = { ...shareRecordFixture };
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(shareData));

      const result = await findActiveShareByJti(mockSupabase, 'jti-123');

      expect(result).toEqual(shareData);
    });
  });

  describe('getSessionByIdAndOwner', () => {
    test('should find session owned by user', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(sessionFixture));

      const result = await getSessionByIdAndOwner(
        mockSupabase, 
        'session-123', 
        'user-123'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('translation_sessions');
      expect(mockMethods.select).toHaveBeenCalledWith('id, user_id');
      expect(mockMethods.eq).toHaveBeenCalledWith('id', 'session-123');
      expect(mockMethods.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockMethods.maybeSingle).toHaveBeenCalled();
      expect(result).toEqual(sessionFixture);
    });

    test('should return null when session not found', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(null));

      const result = await getSessionByIdAndOwner(
        mockSupabase, 
        'nonexistent-session', 
        'user-123'
      );

      expect(result).toBeNull();
    });

    test('should return null when user does not own session', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(null));

      const result = await getSessionByIdAndOwner(
        mockSupabase, 
        'session-123', 
        'wrong-user'
      );

      expect(result).toBeNull();
    });

    test('should handle PGRST116 error gracefully', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbError('No rows found', 'PGRST116'));

      const result = await getSessionByIdAndOwner(
        mockSupabase, 
        'session-123', 
        'user-123'
      );

      expect(result).toBeNull();
    });

    test('should throw error for other database errors', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbError('Connection failed', 'CONNECTION_ERROR'));

      await expect(getSessionByIdAndOwner(mockSupabase, 'session-123', 'user-123'))
        .rejects.toThrow('Database error fetching session: Connection failed');
    });

    test('should query correct table and columns', async () => {
      mockMethods.maybeSingle.mockResolvedValue(mockDbSuccess(sessionFixture));

      await getSessionByIdAndOwner(mockSupabase, 'session-123', 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('translation_sessions');
      expect(mockMethods.select).toHaveBeenCalledWith('id, user_id');
    });
  });

  describe('Database Integration Scenarios', () => {
    test('should handle concurrent share creation for same session', async () => {
      const share1 = { ...shareRecordFixture, share_token_jti: 'jti-1' };
      const share2 = { ...shareRecordFixture, share_token_jti: 'jti-2' };
      
      mockMethods.single
        .mockResolvedValueOnce(mockDbSuccess(share1))
        .mockResolvedValueOnce(mockDbSuccess(share2));

      const [result1, result2] = await Promise.all([
        createShare(mockSupabase, { ...validCreateShareData, share_token_jti: 'jti-1' }),
        createShare(mockSupabase, { ...validCreateShareData, share_token_jti: 'jti-2' }),
      ]);

      expect(result1.share_token_jti).toBe('jti-1');
      expect(result2.share_token_jti).toBe('jti-2');
    });

    test('should handle complex permission arrays', async () => {
      const multiPermissionData = {
        ...validCreateShareData,
        permissions: [SharePermission.VIEW, SharePermission.COMMENT],
      };
      
      mockMethods.single.mockResolvedValue(mockDbSuccess({
        ...shareRecordFixture,
        permissions: [SharePermission.VIEW, SharePermission.COMMENT],
      }));

      const result = await createShare(mockSupabase, multiPermissionData);

      expect(result.permissions).toEqual([SharePermission.VIEW, SharePermission.COMMENT]);
    });

    test('should maintain data consistency across operations', async () => {
      const shareData = { ...shareRecordFixture };
      
      // First create
      mockMethods.single.mockResolvedValueOnce(mockDbSuccess(shareData));
      await createShare(mockSupabase, validCreateShareData);

      // Then list
      mockMethods.is.mockResolvedValueOnce(mockDbSuccess([shareData]));
      const shares = await listSharesBySessionId(mockSupabase, shareData.session_id, shareData.created_by);

      // Then revoke
      const revokedShare = { ...shareData, revoked_at: new Date().toISOString() };
      mockMethods.single.mockResolvedValueOnce(mockDbSuccess(revokedShare));
      await revokeShareByJti(mockSupabase, shareData.share_token_jti, shareData.created_by);

      // Then verify it's not found as active
      mockMethods.maybeSingle.mockResolvedValueOnce(mockDbSuccess(null));
      const foundShare = await findActiveShareByJti(mockSupabase, shareData.share_token_jti);

      expect(shares).toHaveLength(1);
      expect(foundShare).toBeNull();
    });
  });
});