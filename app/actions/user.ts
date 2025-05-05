'use server';

import { saveOrUpdateUser } from "@/lib/prisma-utils";
import type { FarcasterUser } from "@/types";

/**
 * Server Action to save or update user data in the database.
 * 
 * @param userData The user data obtained from Farcaster context.
 * @returns An object indicating success or an error message.
 */
export const saveUserAction = async (userData: FarcasterUser): Promise<{ success: boolean; error?: string; userId?: number }> => {
  try {
    console.log("[Server Action] Attempting to save user:", userData);
    const savedUser = await saveOrUpdateUser(userData);
    console.log("[Server Action] User saved successfully:", savedUser.id);
    return { success: true, userId: savedUser.id };
  } catch (error) {
    console.error("[Server Action] Error saving user:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error saving user" };
  }
}; 