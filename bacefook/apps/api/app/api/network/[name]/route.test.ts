// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn(),
  },
}));

// Mock the database and NetworkService
jest.mock('../../../../lib/database', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
    },
    friendship: {
      findMany: jest.fn(),
    },
    referral: {
      findMany: jest.fn(),
    },
  },
}));

const mockGetNetworkByUserName = jest.fn();
jest.mock('../../../../lib/NetworkService', () => ({
  NetworkService: jest.fn().mockImplementation(() => ({
    getNetworkByUserName: mockGetNetworkByUserName,
  })),
}));

import { GET, OPTIONS } from './route';
import { NextResponse } from 'next/server';
import { NetworkService } from '../../../../lib/NetworkService';

describe('Network API Route', () => {
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock NextResponse
    mockResponse = {
      headers: {
        set: jest.fn(),
      },
    };
    (NextResponse.json as jest.Mock).mockReturnValue(mockResponse);
  });

  describe('GET', () => {
    it('should return network data for existing user', async () => {
      const mockNetworkData = {
        user: {
          id: 1,
          name: 'user1',
          createdAt: new Date('2023-01-01'),
        },
        friends: [
          {
            id: 2,
            name: 'friend1',
            status: 'ACTIVE',
            createdAt: new Date('2023-01-02'),
          },
        ],
        referrals: {
          given: [],
          received: [],
        },
      };

      mockGetNetworkByUserName.mockResolvedValue(mockNetworkData);

      const mockParams = Promise.resolve({ name: 'user1' });
      const request = new Request('http://localhost/api/network/user1');

      const result = await GET(request, { params: mockParams });

      expect(mockGetNetworkByUserName).toHaveBeenCalledWith('user1');
      expect(NextResponse.json).toHaveBeenCalledWith(mockNetworkData);
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });

    it('should return 404 for non-existing user', async () => {
      mockGetNetworkByUserName.mockResolvedValue(null);

      const mockParams = Promise.resolve({ name: 'nonexistent' });
      const request = new Request('http://localhost/api/network/nonexistent');

      const result = await GET(request, { params: mockParams });

      expect(mockGetNetworkByUserName).toHaveBeenCalledWith('nonexistent');
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'User not found' },
        { status: 404 }
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should handle URL encoded names', async () => {
      const mockNetworkData = {
        user: {
          id: 1,
          name: 'user name with spaces',
          createdAt: new Date('2023-01-01'),
        },
        friends: [],
        referrals: {
          given: [],
          received: [],
        },
      };

      mockGetNetworkByUserName.mockResolvedValue(mockNetworkData);

      const mockParams = Promise.resolve({ name: 'user%20name%20with%20spaces' });
      const request = new Request('http://localhost/api/network/user%20name%20with%20spaces');

      const result = await GET(request, { params: mockParams });

      expect(mockGetNetworkByUserName).toHaveBeenCalledWith('user name with spaces');
      expect(NextResponse.json).toHaveBeenCalledWith(mockNetworkData);
    });

    it('should handle service errors', async () => {
      const mockError = new Error('Database connection failed');
      mockGetNetworkByUserName.mockRejectedValue(mockError);

      const mockParams = Promise.resolve({ name: 'user1' });
      const request = new Request('http://localhost/api/network/user1');

      const result = await GET(request, { params: mockParams });

      expect(console.error).toHaveBeenCalledWith('Error fetching network data:', mockError);
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Failed to fetch network data' },
        { status: 500 }
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });
  });

  describe('OPTIONS', () => {
    it('should return CORS headers for preflight requests', async () => {
      const mockOptionsResponse = {
        headers: {
          set: jest.fn(),
        },
      };

      // Mock NextResponse constructor
      (NextResponse as any) = jest.fn().mockImplementation(() => mockOptionsResponse);

      const result = await OPTIONS();

      expect(mockOptionsResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockOptionsResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockOptionsResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });
  });
}); 