import { NextResponse } from 'next/server';
import { db } from '../../../../lib/database';
import { NetworkService } from '../../../../lib/NetworkService';

const networkService = new NetworkService(db);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const userName = decodeURIComponent(name);
    console.log('Fetching network data for user:', userName);

    // Get network data using the service
    const networkData = await networkService.getNetworkByUserName(userName);

    if (!networkData) {
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