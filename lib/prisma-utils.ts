import { PrismaClient } from '@prisma/client';
// Import FarcasterUser from the central types file
import type { FarcasterUser } from '@/types'; 

// Initialize Prisma Client (ensure this instance is reused across your app)
// See: https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Ensure the prisma instance is re-used during hot-reloading in development
  // Avoids exhausting database connections
  const globalWithPrisma = global as typeof global & {
    prisma: PrismaClient;
  };
  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient({
      // Optionally log Prisma operations in development
      // log: ['query', 'info', 'warn', 'error'], 
    });
  }
  prisma = globalWithPrisma.prisma;
}

export default prisma;

/**
 * Saves or updates user information based on Farcaster context.
 * 
 * @param userData The user data obtained from Farcaster context.
 * @returns The created or updated user record.
 */
export const saveOrUpdateUser = async (userData: FarcasterUser) => {
  if (!userData || typeof userData.fid !== 'number') {
    console.error("Invalid user data provided to saveOrUpdateUser", userData);
    throw new Error("Valid user data with FID is required.");
  }

  const { fid, username, displayName, pfpUrl } = userData;

  try {
    const user = await prisma.user.upsert({
      where: { fid: fid }, // Find user by Farcaster ID
      update: {
        // Fields to update if the user already exists
        username: username,
        displayName: displayName,
        pfpUrl: pfpUrl,
        updatedAt: new Date(), // Explicitly set updatedAt on update
      },
      create: {
        // Fields to set if creating a new user
        fid: fid,
        username: username,
        displayName: displayName,
        pfpUrl: pfpUrl,
      },
    });
    console.log(`User ${user.fid} saved/updated successfully.`);
    return user;
  } catch (error) {
    console.error("Error saving or updating user:", error);
    // Re-throw or handle error as appropriate for your application
    throw error;
  }
};

// Add other Prisma utility functions here as needed (e.g., fetching hunts, saving moves) 