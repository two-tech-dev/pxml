import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 shadow-md">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-2xl font-bold text-orange-400">
            AmazonLite
          </Link>
          <div className="hidden md:flex items-center bg-gray-700 rounded-md px-3 py-1">
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm focus:outline-none w-52"
            />
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/cart"
            className="flex items-center gap-1 hover:text-orange-400 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            <span className="text-sm">Cart</span>
          </Link>
          <Link
            href="/products"
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium transition"
          >
            Shop Now
          </Link>
          <Link
            href="/login"
            className="text-sm hover:text-orange-400 transition"
          >
            Sign In
          </Link>
        </nav>
      </header>

      <section className="flex flex-col items-center justify-center text-center py-24 px-6 bg-gradient-to-br from-gray-800 to-gray-900">
        <h1 className="text-5xl font-bold mb-4">
          Welcome to <span className="text-orange-400">AmazonLite</span>
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mb-8">
          Discover amazing products at great prices.
        </p>
        <div className="flex gap-4">
          <Link
            href="/products"
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-lg text-lg font-semibold transition"
          >
            Shop Now
          </Link>
          <Link
            href="/login"
            className="border border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white px-8 py-4 rounded-lg text-lg font-semibold transition"
          >
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}