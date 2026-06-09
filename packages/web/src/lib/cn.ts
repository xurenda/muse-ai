import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 Tailwind 类名，后写覆盖前写 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
