"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { sdk } from "@farcaster/frame-sdk";
// Remove direct import of save function from provider
// import { saveOrUpdateUser } from "@/lib/prisma-utils";

// Import the specific context type from frame-core
import { FrameContext } from "@farcaster/frame-core/dist/context";

// Remove the local FarcasterUser type if not needed elsewhere
// export type FarcasterUser = { ... };

// Define the new context value shape based on the template
type FarcasterProviderContextType = {
  isLoaded: boolean;
  // Provide the whole FrameContext, which might contain the user object
  frameContext: FrameContext | null; 
  error: string | null;
  // Optionally provide actions if needed, similar to template
  // actions: typeof sdk.actions | null;
};

const FarcasterContext = createContext<FarcasterProviderContextType | undefined>(
  undefined // Start as undefined to enforce provider usage
);

// Update the hook name/return type if desired, or keep as is and adapt usage
export const useFarcaster = (): FarcasterProviderContextType => {
  const context = useContext(FarcasterContext);
  if (context === undefined) {
    throw new Error("useFarcaster must be used within a FarcasterProvider");
  }
  return context;
};

export default function FarcasterProvider({ 
  children 
}: { 
  children: ReactNode 
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  // Store the full FrameContext now
  const [frameContext, setFrameContext] = useState<FrameContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Remove state for derived user object
  // const [user, setUser] = useState<FarcasterUser | null>(null);

  useEffect(() => {
    async function initFarcaster() {
      try {
        console.log("Initializing Farcaster SDK...");
        // Attempt to get the full context
        const contextResult = await sdk.context;
        console.log("Raw SDK Context Result:", contextResult);

        if (contextResult) {
            // Type assertion to FrameContext
            const typedContext = contextResult as FrameContext;
            console.log("Setting FrameContext state:", typedContext);
            setFrameContext(typedContext); 
        } else {
            console.error("Failed to load Farcaster context (result was null/undefined)");
            setError("Failed to load Farcaster context");
            setFrameContext(null);
        }

        // Call ready *after* attempting to set context, before setting isLoaded
        await sdk.actions.ready();
        await sdk.actions.addFrame();
        console.log("Farcaster SDK is ready.");

      } catch (err) {
        console.error("SDK initialization error:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize SDK");
        setFrameContext(null); // Ensure context is null on error
      } finally {
         // Ensure isLoaded is set regardless of success/failure
         setIsLoaded(true); 
         console.log("FarcasterProvider finished initialization.");
      }
    }

    // Check if already loaded to prevent re-running
    if (!isLoaded) {
        initFarcaster();
    }

  }, [isLoaded]); // Depend on isLoaded to ensure it runs only until loaded

  // Provide the new context value structure
  return (
    <FarcasterContext.Provider value={{ isLoaded, frameContext, error }}>
      {children}
    </FarcasterContext.Provider>
  );
} 