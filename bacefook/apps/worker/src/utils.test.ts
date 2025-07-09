import {
  isRegisterEvent,
  isReferralEvent,
  isAddFriendEvent,
  isUnfriendEvent,
  isConnectionEvent,
  parseTransaction,
} from './utils';

describe('Utils', () => {
  describe('isRegisterEvent', () => {
    it('should return true for valid register event', () => {
      const event = { type: 'register', name: 'John' };
      expect(isRegisterEvent(event)).toBe(true);
    });

    it('should return false for invalid type', () => {
      const event = { type: 'invalid', name: 'John' };
      expect(isRegisterEvent(event)).toBe(false);
    });

    it('should return false for missing name', () => {
      const event = { type: 'register' };
      expect(isRegisterEvent(event)).toBe(false);
    });

    it('should return false for invalid name type', () => {
      const event = { type: 'register', name: 123 };
      expect(isRegisterEvent(event)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isRegisterEvent(null)).toBe(false);
      expect(isRegisterEvent(undefined)).toBe(false);
    });
  });

  describe('isReferralEvent', () => {
    it('should return true for valid referral event', () => {
      const event = { type: 'referral', referredBy: 'Alice', user: 'Bob' };
      expect(isReferralEvent(event)).toBe(true);
    });

    it('should return false for invalid type', () => {
      const event = { type: 'invalid', referredBy: 'Alice', user: 'Bob' };
      expect(isReferralEvent(event)).toBe(false);
    });

    it('should return false for missing referredBy', () => {
      const event = { type: 'referral', user: 'Bob' };
      expect(isReferralEvent(event)).toBe(false);
    });

    it('should return false for missing user', () => {
      const event = { type: 'referral', referredBy: 'Alice' };
      expect(isReferralEvent(event)).toBe(false);
    });

    it('should return false for invalid field types', () => {
      const event = { type: 'referral', referredBy: 123, user: 456 };
      expect(isReferralEvent(event)).toBe(false);
    });
  });

  describe('isAddFriendEvent', () => {
    it('should return true for valid addfriend event', () => {
      const event = { type: 'addfriend', user1_name: 'Alice', user2_name: 'Bob' };
      expect(isAddFriendEvent(event)).toBe(true);
    });

    it('should return false for invalid type', () => {
      const event = { type: 'invalid', user1_name: 'Alice', user2_name: 'Bob' };
      expect(isAddFriendEvent(event)).toBe(false);
    });

    it('should return false for missing user1_name', () => {
      const event = { type: 'addfriend', user2_name: 'Bob' };
      expect(isAddFriendEvent(event)).toBe(false);
    });

    it('should return false for missing user2_name', () => {
      const event = { type: 'addfriend', user1_name: 'Alice' };
      expect(isAddFriendEvent(event)).toBe(false);
    });

    it('should return false for invalid field types', () => {
      const event = { type: 'addfriend', user1_name: 123, user2_name: 456 };
      expect(isAddFriendEvent(event)).toBe(false);
    });
  });

  describe('isUnfriendEvent', () => {
    it('should return true for valid unfriend event', () => {
      const event = { type: 'unfriend', user1_name: 'Alice', user2_name: 'Bob' };
      expect(isUnfriendEvent(event)).toBe(true);
    });

    it('should return false for invalid type', () => {
      const event = { type: 'invalid', user1_name: 'Alice', user2_name: 'Bob' };
      expect(isUnfriendEvent(event)).toBe(false);
    });

    it('should return false for missing fields', () => {
      const event1 = { type: 'unfriend', user2_name: 'Bob' };
      const event2 = { type: 'unfriend', user1_name: 'Alice' };
      expect(isUnfriendEvent(event1)).toBe(false);
      expect(isUnfriendEvent(event2)).toBe(false);
    });
  });

  describe('isConnectionEvent', () => {
    it('should return true for all valid event types', () => {
      const registerEvent = { type: 'register', name: 'John' };
      const referralEvent = { type: 'referral', referredBy: 'Alice', user: 'Bob' };
      const addFriendEvent = { type: 'addfriend', user1_name: 'Alice', user2_name: 'Bob' };
      const unfriendEvent = { type: 'unfriend', user1_name: 'Alice', user2_name: 'Bob' };

      expect(isConnectionEvent(registerEvent)).toBe(true);
      expect(isConnectionEvent(referralEvent)).toBe(true);
      expect(isConnectionEvent(addFriendEvent)).toBe(true);
      expect(isConnectionEvent(unfriendEvent)).toBe(true);
    });

    it('should return false for invalid events', () => {
      const invalidEvent = { type: 'invalid', data: 'test' };
      expect(isConnectionEvent(invalidEvent)).toBe(false);
    });
  });

  describe('parseTransaction', () => {
    it('should parse valid JSON register event', () => {
      const jsonString = '{"type":"register","name":"John"}';
      const result = parseTransaction(jsonString);
      expect(result).toEqual({ type: 'register', name: 'John' });
    });

    it('should parse valid JSON referral event', () => {
      const jsonString = '{"type":"referral","referredBy":"Alice","user":"Bob"}';
      const result = parseTransaction(jsonString);
      expect(result).toEqual({ type: 'referral', referredBy: 'Alice', user: 'Bob' });
    });

    it('should parse valid JSON addfriend event', () => {
      const jsonString = '{"type":"addfriend","user1_name":"Alice","user2_name":"Bob"}';
      const result = parseTransaction(jsonString);
      expect(result).toEqual({ type: 'addfriend', user1_name: 'Alice', user2_name: 'Bob' });
    });

    it('should parse valid JSON unfriend event', () => {
      const jsonString = '{"type":"unfriend","user1_name":"Alice","user2_name":"Bob"}';
      const result = parseTransaction(jsonString);
      expect(result).toEqual({ type: 'unfriend', user1_name: 'Alice', user2_name: 'Bob' });
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{"type":"register","name":}';
      expect(() => parseTransaction(invalidJson)).toThrow('Failed to parse transaction');
    });

    it('should throw error for valid JSON but invalid event', () => {
      const invalidEvent = '{"type":"invalid","data":"test"}';
      expect(() => parseTransaction(invalidEvent)).toThrow('Invalid transaction format');
    });

    it('should throw error for empty string', () => {
      expect(() => parseTransaction('')).toThrow('Failed to parse transaction');
    });

    it('should throw error for non-JSON string', () => {
      expect(() => parseTransaction('not json')).toThrow('Failed to parse transaction');
    });
  });
}); 