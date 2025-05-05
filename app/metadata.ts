import { Metadata } from 'next';

export const metadata: Metadata = {
  // Updated title and description
  title: 'Treasure Hunt', 
  description: 'Find the treasure in this classic treasure hunt game.', 
  openGraph: {
    // Updated OG title, description, and image path
    title: 'Treasure Hunt', 
    description: 'Find the treasure in this classic treasure hunt game.', 
    images: [`https://monad-hunt.vercel.app/icon.png`] 
  },
  other: {
    'fc:frame': JSON.stringify({
      version: 'next', // Assuming this version is still correct
      // Updated image path
      imageUrl: `https://monad-hunt.vercel.app/icon.png`, 
      // iconUrl: `${appUrl}/iconUrl.png`, 
      button: {
        // Updated button title and action name
        title: 'Start Hunting', // Using a clear call to action
        action: {
          type: 'launch_frame', // Assuming type remains the same
          url: 'https://monad-hunt.vercel.app',
          name: 'Treasure Hunt', // Updated name
          // Updated splash image and color from farcaster.json
          splashImageUrl: `https://monad-hunt.vercel.app/splash.png`, 
          splashBackgroundColor: '#111622' 
        }
      }
    })
  }
}; 