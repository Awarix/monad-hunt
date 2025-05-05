import { Metadata } from 'next';

export const metadata: Metadata = {
  // Updated title and description
  title: 'Treasure Hunt', 
  description: 'Find the treasure in this classic treasure hunt game.', 
  openGraph: {
    // Updated OG title, description, and image path
    title: 'Treasure Hunt', 
    description: 'Find the treasure in this classic treasure hunt game.', 
    images: [`https://monad-treasure-hunt.vercel.app/iconUrl.png`] 
  },
  other: {
    'fc:frame': JSON.stringify({
      version: 'next', // Assuming this version is still correct
      // Updated image path
      imageUrl: `https://monad-treasure-hunt.vercel.app/iconUrl.png`, 
      // iconUrl: `${appUrl}/iconUrl.png`, 
      button: {
        // Updated button title and action name
        title: 'Start Hunting', // Using a clear call to action
        action: {
          type: 'launch_frame', // Assuming type remains the same
          url: 'https://monad-treasure-hunt.vercel.app',
          name: 'Treasure Hunt', // Updated name
          // Updated splash image and color from farcaster.json
          splashImageUrl: `https://monad-treasure-hunt.vercel.app/logo200.png`, 
          splashBackgroundColor: '#111622' 
        }
      }
    })
  }
}; 