import { NextResponse } from 'next/server';
import { db } from '../../../../lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const userName = decodeURIComponent(name);
    console.log('Fetching network data for user:', userName);

    // Find the user
    const user = await db.user.findUnique({
      where: {
        name: userName,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    console.log('User found:', user);

    if (!user) {
      const notFoundResponse = NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
      
      // Add CORS headers
      notFoundResponse.headers.set('Access-Control-Allow-Origin', '*');
      notFoundResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      notFoundResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return notFoundResponse;
    }

    // Get user's friends
    const friendships = await db.friendship.findMany({
      where: {
        OR: [
          { user1Id: user.id },
          { user2Id: user.id },
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

    // Format friends data
    const friends = friendships.map(friendship => {
      const friend = friendship.user1Id === user.id ? friendship.user2 : friendship.user1;
      return {
        id: friend.id,
        name: friend.name,
        status: friendship.status,
        createdAt: friendship.createdAt,
      };
    });

    // Get referrals given by the user
    const referralsGiven = await db.referral.findMany({
      where: {
        referrerId: user.id,
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

    // Get referrals received by the user
    const referralsReceived = await db.referral.findMany({
      where: {
        referredId: user.id,
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

    // Format the response
    const networkData = {
      user: {
        id: user.id,
        name: user.name,
        createdAt: user.createdAt,
      },
      friends: friends,
      referrals: {
        given: referralsGiven.map(referral => ({
          id: referral.referred.id,
          name: referral.referred.name,
          referredAt: referral.createdAt,
        })),
        received: referralsReceived.map(referral => ({
          id: referral.referrer.id,
          name: referral.referrer.name,
          referredAt: referral.createdAt,
        })),
      },
    };

    const response = NextResponse.json(networkData);
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  } catch (error) {
    console.error('Error fetching network data:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorResponse = NextResponse.json(
      { error: 'Failed to fetch network data' },
      { status: 500 }
    );
    
    // Add CORS headers to error response too
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  
  // Add CORS headers for preflight request
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
} 