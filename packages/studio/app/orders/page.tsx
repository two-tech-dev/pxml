'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  image?: string
}

interface Order {
  id: string
  date: string
  total: number
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled'
  items: OrderItem[]
  shippingAddress?: string
}

const statusColors: Record<Order['status'], string> = {
  processing: 'bg-amber-100 text-amber-800',
  shipped: 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/checkout')
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Order History</h1>

      {orders.length === 0 ? (
        <p className="text-slate-500">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expanded.has(order.id)
            return (
              <div
                key={order.id}
                className="border rounded-lg p-4 shadow-sm bg-white"
              >
                {/* Order header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-800">
                    Order #{order.id}
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatDate(order.date)}
                  </span>
                </div>

                {/* Columns: Order Placed, Total, Ship To, Status */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                  <div>
                    <div className="text-slate-500">Order Placed</div>
                    <div>{formatDate(order.date)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Cost</div>
                    <div className="font-bold">${order.total.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Ship To</div>
                    <div>{order.shippingAddress ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        statusColors[order.status]
                      }`}
                    >
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Thumbnail strip */}
                <div className="flex items-center gap-1 mb-2">
                  {order.items.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="w-10 h-10 bg-slate-200 rounded overflow-hidden"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                          {item.name[0]}
                        </div>
                      )}
                    </div>
                  ))}
                  {order.items.length > 5 && (
                    <span className="text-xs text-slate-400 ml-1">
                      +{order.items.length - 5} more
                    </span>
                  )}
                </div>

                {/* Expandable items list */}
                <button
                  onClick={() => toggleExpand(order.id)}
                  className="text-blue-600 text-sm hover:underline focus:outline-none"
                >
                  {isExpanded ? 'Hide items' : 'View items'} ({order.items.length})
                </button>
                {isExpanded && (
                  <ul className="mt-2 border-t pt-2 space-y-1">
                    {order.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {item.name} x{item.quantity}
                        </span>
                        <span className="font-medium">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/products"
          className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}