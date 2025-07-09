import { NetworkService } from './NetworkService';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
  },
  friendship: {
    findMany: jest.fn(),
  },
  referral: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('NetworkService', () => {
  let networkService: NetworkService;

  beforeEach(() => {
    jest.clearAllMocks();
    networkService = new NetworkService(mockPrismaClient);
  });

  describe('getNetworkByUserName', () => {
    it('should return null when user is not found', async () => {
      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await networkService.getNetworkByUserName('nonexistent');

      expect(result).toBeNull();
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { name: 'nonexistent' },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });
    });

    it('should return network data when user exists', async () => {
      const mockUser = {
        id: 1,
        name: 'user1',
        createdAt: new Date('2023-01-01'),
      };

      const mockFriendships = [
        {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          status: 'ACTIVE',
          createdAt: new Date('2023-01-02'),
          user1: { id: 1, name: 'user1' },
          user2: { id: 2, name: 'friend1' },
        },
      ];

      const mockReferralsGiven = [
        {
          id: 1,
          referrerId: 1,
          referredId: 3,
          createdAt: new Date('2023-01-03'),
          referred: { id: 3, name: 'referred1' },
        },
      ];

      const mockReferralsReceived = [
        {
          id: 2,
          referrerId: 4,
          referredId: 1,
          createdAt: new Date('2023-01-04'),
          referrer: { id: 4, name: 'referrer1' },
        },
      ];

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrismaClient.friendship.findMany as jest.Mock).mockResolvedValue(mockFriendships);
      (mockPrismaClient.referral.findMany as jest.Mock)
        .mockResolvedValueOnce(mockReferralsGiven)
        .mockResolvedValueOnce(mockReferralsReceived);

      const result = await networkService.getNetworkByUserName('user1');

      expect(result).toEqual({
        user: mockUser,
        friends: [
          {
            id: 2,
            name: 'friend1',
            status: 'ACTIVE',
            createdAt: new Date('2023-01-02'),
          },
        ],
        referrals: {
          given: [
            {
              id: 3,
              name: 'referred1',
              referredAt: new Date('2023-01-03'),
            },
          ],
          received: [
            {
              id: 4,
              name: 'referrer1',
              referredAt: new Date('2023-01-04'),
            },
          ],
        },
      });
    });

    it('should handle friendship where user is user2', async () => {
      const mockUser = {
        id: 2,
        name: 'user2',
        createdAt: new Date('2023-01-01'),
      };

      const mockFriendships = [
        {
          id: 1,
          user1Id: 1,
          user2Id: 2,
          status: 'ACTIVE',
          createdAt: new Date('2023-01-02'),
          user1: { id: 1, name: 'friend1' },
          user2: { id: 2, name: 'user2' },
        },
      ];

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrismaClient.friendship.findMany as jest.Mock).mockResolvedValue(mockFriendships);
      (mockPrismaClient.referral.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await networkService.getNetworkByUserName('user2');

      expect(result?.friends).toEqual([
        {
          id: 1,
          name: 'friend1',
          status: 'ACTIVE',
          createdAt: new Date('2023-01-02'),
        },
      ]);
    });

    it('should handle empty relationships', async () => {
      const mockUser = {
        id: 1,
        name: 'user1',
        createdAt: new Date('2023-01-01'),
      };

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrismaClient.friendship.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.referral.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await networkService.getNetworkByUserName('user1');

      expect(result).toEqual({
        user: mockUser,
        friends: [],
        referrals: {
          given: [],
          received: [],
        },
      });
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');
      (mockPrismaClient.user.findUnique as jest.Mock).mockRejectedValue(mockError);

      await expect(networkService.getNetworkByUserName('user1')).rejects.toThrow('Database error');
      expect(console.error).toHaveBeenCalledWith('Error in getNetworkByUserName:', mockError);
    });
  });
}); 