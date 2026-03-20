import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
