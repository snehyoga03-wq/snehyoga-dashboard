import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes an Indian phone number to start with +91.
 * Removes spaces, dashes, and other non-digit characters.
 * Useful for matching existing users properly in the database.
 */
export function formatPhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && phone.startsWith("+")) return phone;
  return phone; // return as-is if format is unknown/foreign
}
