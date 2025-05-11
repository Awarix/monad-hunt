import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Treasure Hunt', 
  description: 'Find the treasure in this classic treasure hunt game.', 
  openGraph: {
    title: 'Treasure Hunt', 
    description: 'Find the treasure in this classic treasure hunt game.', 
    images: [`https://monad-hunt.vercel.app/logo.jpg`] 
  },
  other: {
    'fc:frame': JSON.stringify({
      version: 'next', 
      imageUrl: `https://monad-hunt.vercel.app/logo.jpg`, 
      button: {
        title: 'Start Hunting', 
        action: {
          type: 'launch_frame', 
          url: 'https://monad-hunt.vercel.app',
          name: 'Treasure Hunt', 
          splashImageUrl: `https://monad-hunt.vercel.app/logo.jpg`, 
          splashBackgroundColor: '#111622' 
        }
      }
    })
  }
}; 