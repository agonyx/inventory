import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <h2 className="mt-3 text-xl font-semibold text-gray-900">
        Page not found
      </h2>
      <p className="mt-2 text-sm text-gray-500 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
      >
        <Home size={16} />
        Go Home
      </Link>
    </div>
  );
}
