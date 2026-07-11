'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type FormErrors = Record<string, string>

type CartItem = {
  id: number | string
  name: string
  price: number
  quantity: number
  image?: string
}

type CartData = {
  items: CartItem[]
  total: number
}

export default function Checkout({ summary }: { summary?: React.ReactNode }) {
  const router = useRouter()
  const [cart, setCart] = useState<CartData | null>(null)
  const [loadingCart, setLoadingCart] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  // form fields (mock payment: cardNumber, expiry, cvv – not sent to backend)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')

  const [errors, setErrors] = useState<FormErrors>({})

  const fetchCart = useCallback(async () => {
    try {
      setLoadingCart(true)
      const res = await fetch('/api/cart')
      if (!res.ok) throw new Error('Failed to load cart')
      const data = await res.json()
      setCart(data)
    } catch {
      setCart(null)
    } finally {
      setLoadingCart(false)
    }
  }, [])

  useEffect(() => {
    if (!summary) fetchCart()
    else setLoadingCart(false)
  }, [summary, fetchCart])

  // calculate totals
  const subtotal = (cart?.items ?? []).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const shipping = subtotal > 50 ? 0 : 5.99
  const tax = subtotal * 0.08
  const total = subtotal + shipping + tax

  function validate(): FormErrors {
    const errs: FormErrors = {}

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = 'Valid email required'
    if (!fullName.trim()) errs.fullName = 'Full name required'
    if (!address.trim()) errs.address = 'Address required'
    if (!city.trim()) errs.city = 'City required'
    if (!zip.trim() || !/^\d{5}(-\d{4})?$/.test(zip.trim()))
      errs.zip = 'Valid ZIP code required'

    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          shipping: { fullName, address, city, zip },
          // payment is mock, not sent
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Checkout failed' }))
        throw new Error(data.error || 'Checkout failed')
      }
      router.push('/orders')
    } catch (err: any) {
      setServerError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  // inline UI elements
  function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
        {children}
      </div>
    )
  }

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-lg font-semibold text-gray-900 mb-4">{children}</h3>
  }

  function Field({ id, label, error, children }: {
    id: string
    label: string
    error?: string
    children: React.ReactNode
  }) {
    return (
      <div>
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {children}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  function Input({ id, value, onChange, placeholder, type = 'text', maxLength }: {
    id: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    maxLength?: number
  }) {
    return (
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={inputClass}
        autoComplete="off"
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h2>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Left column – form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 space-y-6"
          noValidate
        >
          {/* Contact */}
          <Card>
            <SectionTitle>Contact</SectionTitle>
            <Field id="email" label="Email address" error={errors.email}>
              <Input id="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            </Field>
          </Card>

          {/* Shipping */}
          <Card>
            <SectionTitle>Shipping address</SectionTitle>
            <div className="space-y-4">
              <Field id="fullName" label="Full name" error={errors.fullName}>
                <Input id="fullName" value={fullName} onChange={setFullName} placeholder="John Smith" />
              </Field>
              <Field id="address" label="Address" error={errors.address}>
                <Input id="address" value={address} onChange={setAddress} placeholder="123 Main St" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="city" label="City" error={errors.city}>
                  <Input id="city" value={city} onChange={setCity} placeholder="New York" />
                </Field>
                <Field id="zip" label="ZIP code" error={errors.zip}>
                  <Input id="zip" value={zip} onChange={setZip} placeholder="10001" maxLength={10} />
                </Field>
              </div>
            </div>
          </Card>

          {/* Payment (mock – visual only) */}
          <Card>
            <SectionTitle>Payment</SectionTitle>
            <div className="space-y-4">
              <Field id="cardNumber" label="Card number">
                <Input id="cardNumber" value={cardNumber} onChange={setCardNumber} placeholder="4242 4242 4242 4242" maxLength={19} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field id="expiry" label="Expiry date">
                  <Input id="expiry" value={expiry} onChange={setExpiry} placeholder="MM/YY" maxLength={5} />
                </Field>
                <Field id="cvv" label="CVV">
                  <Input id="cvv" value={cvv} onChange={setCvv} placeholder="123" maxLength={4} />
                </Field>
              </div>
            </div>
          </Card>

          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Place order button – yellow, full-width */}
          <button
            type="submit"
            disabled={submitting || loadingCart}
            className="w-full rounded-lg bg-yellow-500 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Processing…' : 'Place your order'}
          </button>
        </form>

        {/* Right column – order summary */}
        <div className="lg:col-span-1 mt-8 lg:mt-0">
          <div className="sticky top-8 space-y-6">
            <Card>
              <SectionTitle>Order Summary</SectionTitle>

              {/* If summary prop provided, render it; otherwise render cart */}
              {summary ? (
                <>{summary}</>
              ) : loadingCart ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
                  ))}
                  <div className="h-6 animate-pulse rounded bg-gray-100 mt-4" />
                </div>
              ) : !cart || cart.items.length === 0 ? (
                <p className="text-sm text-gray-500">Your cart is empty.</p>
              ) : (
                <>
                  <ul className="divide-y divide-gray-200">
                    {cart.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-3">
                        <div className="h-12 w-12 flex-shrink-0 rounded bg-gray-100" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Subtotal</dt>
                      <dd className="text-gray-900">${subtotal.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Shipping</dt>
                      <dd className="text-gray-900">{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Tax (8%)</dt>
                      <dd className="text-gray-900">${tax.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-base">
                      <dt>Total</dt>
                      <dd>${total.toFixed(2)}</dd>
                    </div>
                  </dl>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}