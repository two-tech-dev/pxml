'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Button from '@/components/ui/layout/Button'
import Card from '@/components/ui/layout/Card'

interface CartItem {
  id: string
  title: string
  price: number
  qty: number
  image: string
}

interface CartProps {
  items?: CartItem[]
  onQtyChange?: (id: string, qty: number) => void
  onRemove?: (id: string) => void
  onCheckout?: () => void
}

export default function Cart({
  items: initialItems,
  onQtyChange: externalQtyChange,
  onRemove: externalRemove,
  onCheckout: externalCheckout,
}: CartProps) {
  const [items, setItems] = useState<CartItem[]>(initialItems || [])
  const [loading, setLoading] = useState(!initialItems)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!initialItems) {
      fetchCart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCart = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cart')
      if (!res.ok) {
        throw new Error('Failed to fetch cart')
      }
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load cart. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQtyChange = useCallback(
    (id: string, newQty: number) => {
      if (externalQtyChange) {
        externalQtyChange(id, newQty)
        return
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, qty: newQty } : item
        )
      )
      fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, qty: newQty }),
      }).catch(() => fetchCart())
    },
    [externalQtyChange, fetchCart]
  )

  const handleRemove = useCallback(
    (id: string) => {
      if (externalRemove) {
        externalRemove(id)
        return
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
      fetch('/api/cart', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(() => fetchCart())
    },
    [externalRemove, fetchCart]
  )

  const handleCheckout = useCallback(() => {
    if (externalCheckout) {
      externalCheckout()
    } else {
      router.push('/checkout')
    }
  }, [externalCheckout, router])

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  )
  const shipping = subtotal > 0 ? (subtotal >= 100 ? 0 : 9.99) : 0
  const total = subtotal + shipping

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <Button variant="outline" onClick={fetchCart}>
          Retry
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg
          className="w-24 h-24 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Your cart is empty
        </h2>
        <p className="text-gray-500 mb-6">
          Looks like you haven&apos;t added anything yet.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onQtyChange={handleQtyChange}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <Card className="p-6 h-fit">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Summary
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
            </div>
            {subtotal > 0 && subtotal < 100 && (
              <p className="text-xs text-gray-500">
                Free shipping on orders over $100
              </p>
            )}
            <hr />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
          <Button
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3"
            onClick={handleCheckout}
          >
            Proceed to Checkout
          </Button>
        </Card>
      </div>
    </div>
  )
}

function CartItemCard({
  item,
  onQtyChange,
  onRemove,
}: {
  item: CartItem
  onQtyChange: (id: string, qty: number) => void
  onRemove: (id: string) => void
}) {
  const handleIncrement = () => onQtyChange(item.id, item.qty + 1)
  const handleDecrement = () => {
    if (item.qty > 1) {
      onQtyChange(item.id, item.qty - 1)
    }
  }

  return (
    <Card className="flex flex-col sm:flex-row items-center gap-4 p-4">
      <div className="relative w-24 h-24 flex-shrink-0">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover rounded-md"
          sizes="96px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-medium text-gray-900 truncate">
          {item.title}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          ${item.price.toFixed(2)} each
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          className="p-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
          disabled={item.qty <= 1}
          aria-label="Decrease quantity"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </button>
        <span className="w-8 text-center font-medium">{item.qty}</span>
        <button
          onClick={handleIncrement}
          className="p-1 rounded border border-gray-300 hover:bg-gray-100"
          aria-label="Increase quantity"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold text-gray-900">
          ${(item.price * item.qty).toFixed(2)}
        </p>
        <button
          onClick={() => onRemove(item.id)}
          className="mt-1 text-sm text-red-500 hover:text-red-700 transition-colors"
          aria-label={`Remove ${item.title} from cart`}
        >
          Remove
        </button>
      </div>
    </Card>
  )
}