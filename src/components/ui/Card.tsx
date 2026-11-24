import type { ReactNode } from 'react'

type CardProps = {
  className?: string
  children: ReactNode
}

export function Card({ className = '', children }: CardProps) {
  return (
    <div
      className={`glass rounded-3xl ${className}`}
    >
      {children}
    </div>
  )
}
