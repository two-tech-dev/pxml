'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Both fields are required.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLogin ? 'login' : 'register',
          email,
          password
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      router.push('/products')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {isLogin ? 'Welcome back' : 'Create account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="peer w-full px-4 pt-6 pb-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 placeholder-transparent"
              placeholder="Email"
              aria-label="Email"
              aria-invalid={!!error}
              autoComplete="email"
            />
            <label
              htmlFor="email"
              className="absolute left-4 top-2 text-sm text-slate-500 peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:top-2 peer-focus:text-sm peer-focus:text-indigo-600 transition-all"
            >
              Email
            </label>
          </div>

          <div className="relative">
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="peer w-full px-4 pt-6 pb-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 placeholder-transparent"
              placeholder="Password"
              aria-label="Password"
              aria-invalid={!!error}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <label
              htmlFor="password"
              className="absolute left-4 top-2 text-sm text-slate-500 peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:top-2 peer-focus:text-sm peer-focus:text-indigo-600 transition-all"
            >
              Password
            </label>
          </div>

          {error && (
            <p className="text-red-500 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center text-sm space-y-2">
          {isLogin && (
            <Link
              href="/forgot-password"
              className="text-indigo-600 hover:underline"
            >
              Forgot password?
            </Link>
          )}
          <button
            type="button"
            className="text-slate-600 hover:text-slate-900"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
            }}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}