import { db, checkDatabaseConnection } from './database';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $queryRaw: jest.fn(),
  })),
}));

describe('Database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('db instance', () => {
    it('should export a db instance', () => {
      expect(db).toBeDefined();
      expect(typeof db).toBe('object');
    });

    it('should have $queryRaw method', () => {
      expect(db.$queryRaw).toBeDefined();
      expect(typeof db.$queryRaw).toBe('function');
    });
  });

  describe('checkDatabaseConnection', () => {
    it('should return success status when database connection is successful', async () => {
      // Mock successful database query
      (db.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const result = await checkDatabaseConnection();

      expect(result).toEqual({
        status: 'connected',
        message: 'Database connection successful',
      });
      expect(db.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    });

    it('should return error status when database connection fails', async () => {
      // Mock database query error
      const mockError = new Error('Database connection failed');
      (db.$queryRaw as jest.Mock).mockRejectedValue(mockError);

      const result = await checkDatabaseConnection();

      expect(result).toEqual({
        status: 'error',
        message: 'Database connection failed',
      });
      expect(db.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    });

    it('should log error when database connection fails', async () => {
      // Mock database query error
      const mockError = new Error('Connection timeout');
      (db.$queryRaw as jest.Mock).mockRejectedValue(mockError);

      await checkDatabaseConnection();

      expect(console.error).toHaveBeenCalledWith('Database connection failed:', mockError);
    });
  });
}); 