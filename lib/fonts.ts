// lib/fonts.ts

// Function to load Geist Mono SemiBold
export const getGeistMonoSemiBoldFont = async (): Promise<ArrayBuffer> => {
    // When fetching from the `public` directory in a server environment (like a Route Handler),
    // you need to construct an absolute URL or a path relative to the server's root.
    // `import.meta.url` can be tricky depending on the runtime and bundler.
    // For files in `public`, the most reliable way is to use the base URL of your application.

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  
    // const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    //   ? process.env.NEXT_PUBLIC_APP_URL // For Vercel deployments
    //   : 'http://localhost:3000'; // For local and other deployments (ensure NEXT_PUBLIC_APP_URL is set)
  
    const fontUrl = new URL('/GeistMono-SemiBold.ttf', baseUrl);
  
    try {
      const response = await fetch(fontUrl.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.statusText} from ${fontUrl.toString()}`);
      }
      return response.arrayBuffer();
    } catch (error) {
      console.error("Error fetching font:", error);
      // Fallback or re-throw, depending on how critical the font is.
      // For OG images, it's critical, so re-throwing is appropriate.
      throw new Error(`Could not load font GeistMono-SemiBold.ttf. ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // You can remove the Inter font function or keep it if you plan to use it elsewhere.
  // export const getInterRegularFont = async () => {
  //   const baseUrl = process.env.VERCEL_URL
  //     ? `https://${process.env.VERCEL_URL}`
  //     : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  //   const fontUrl = new URL('/Inter-Regular.ttf', baseUrl);
  //   const response = await fetch(fontUrl.toString());
  //   if (!response.ok) {
  //     throw new Error(`Failed to fetch font: ${response.statusText}`);
  //   }
  //   return response.arrayBuffer();
  // };