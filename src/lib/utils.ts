import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Lives here rather than under shared/ because it is the path shadcn's registry writes into every
 * component it generates (`aliases.utils` in components.json). Keeping the real file where the
 * generator expects it means `npx shadcn add ...` output compiles unedited.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
