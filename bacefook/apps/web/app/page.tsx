import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Bacefook</h1>
          <p className="mt-2 text-sm text-gray-600">
            Social Network Relationship Viewer
          </p>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Explore Network Relationships
          </h2>
          <p className="text-gray-600 mb-6">
            Enter a user&apos;s name to see their friendship network and connections.
          </p>
          
          <Link 
            href="/network" 
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-center block"
          >
            View Network Relationships
          </Link>
        </div>
      </div>
    </div>
  );
}
