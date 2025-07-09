import { PrismaClient } from '@prisma/client';

export interface NetworkUser {
  id: number;
  name: string;
  createdAt: Date;
}

export interface NetworkFriend {
  id: number;
  name: string;
  status: string;
  createdAt: Date;
}

export interface NetworkReferral {
  id: number;
  name: string;
  referredAt: Date;
}

export interface NetworkData {
  user: NetworkUser;
  friends: NetworkFriend[];
  referrals: {
    given: NetworkReferral[];
    received: NetworkReferral[];
  };
}

export class NetworkService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get network data for a user by name
   */
  async getNetworkByUserName(userName: string): Promise<NetworkData | null> {
    try {
      // Find the user
      const user = await this.prisma.user.findUnique({
        where: { name: userName },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      if (!user) {
        return null;
      }

      // Get all data in parallel
      const [friendships, referralsGiven, referralsReceived] = await Promise.all([
        this.getUserFriendships(user.id),
        this.getUserReferralsGiven(user.id),
        this.getUserReferralsReceived(user.id),
      ]);

      return {
        user,
        friends: friendships,
        referrals: {
          given: referralsGiven,
          received: referralsReceived,
        },
      };
    } catch (error) {
      console.error('Error in getNetworkByUserName:', error);
      throw error;
    }
  }

  /**
   * Get user's friendships
   */
  private async getUserFriendships(userId: number): Promise<NetworkFriend[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
          },
        },
        user2: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return friendships.map(friendship => {
      const friend = friendship.user1Id === userId ? friendship.user2 : friendship.user1;
      return {
        id: friend.id,
        name: friend.name,
        status: friendship.status,
        createdAt: friendship.createdAt,
      };
    });
  }

  /**
   * Get referrals given by the user
   */
  private async getUserReferralsGiven(userId: number): Promise<NetworkReferral[]> {
    const referrals = await this.prisma.referral.findMany({
      where: {
        referrerId: userId,
      },
      include: {
        referred: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return referrals.map(referral => ({
      id: referral.referred.id,
      name: referral.referred.name,
      referredAt: referral.createdAt,
    }));
  }

  /**
   * Get referrals received by the user
   */
  private async getUserReferralsReceived(userId: number): Promise<NetworkReferral[]> {
    const referrals = await this.prisma.referral.findMany({
      where: {
        referredId: userId,
      },
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return referrals.map(referral => ({
      id: referral.referrer.id,
      name: referral.referrer.name,
      referredAt: referral.createdAt,
    }));
  }
} 