'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Container from '@/components/ui/layout/Container'

const Navbar = () => (
  <nav className="bg-white shadow border-b">
    <Container>
      <div className="flex items-center justify-between h-16">
        <Link href="/" className="text-xl font-semibold">
          Home
        </Link>
        <Link
          href="/cart"
          className="text-blue-600 font-medium hover:underline"
        >
          Cart
        </Link>
      </div>
    </Container>
  </nav>
)

const Spinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600" />
  </div>
)

const ErrorMessage = ({ message }: { message: string }) => (
  <div
    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
    role="alert"
  >
    {message}
  </div>
)

const EmptyState = () => (
  <div className="text-center py-16 text-gray-500">
    No products available. Check back later.
  </div>
)

const ProductCard = ({
  product,
  onAddToCart,
}: {
  product: any
  onAddToCart: (id: number) => void
}) => (
  <div className="border rounded-lg overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow">
    <div className="aspect-square bg-gray-100">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="object-cover w-full h-full"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400">
          <svg
            className="w-12 h-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-900 truncate">
        {product.name}
      </h2>
      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
        {product.description}
      </p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xl font-bold text-gray-900">
          ${Number(product.price).toFixed(2)}
        </span>
        <button
          onClick={() => onAddToCart(product.id)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition text-sm font-medium"
        >
          Add to Cart
        </button>
      </div>
    </div>
  </div>
)

export default function ProductGrid() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products')
        if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`)
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Invalid response format')
        setProducts(data)
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const addToCart = async (productId: number) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (!res.ok) throw new Error('Failed to add to cart')
      alert('Added to cart!')
    } catch {
      alert('Could not add to cart. Please try again.')
    }
  }

  return (
    <>
      <Navbar />
      <Container className="py-8">
        {loading && <Spinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && products.length === 0 && <EmptyState />}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </Container>
    </>
  )
}