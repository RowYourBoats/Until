import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Until',
    short_name: 'Until',
    description: 'Countdown-based task manager and deadline tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#293c64',
    theme_color: '#293c64',
icons: [
  {
    src: '/icons/icon-192x192.png', // Match your actual folder/filename
    sizes: '192x192',
    type: 'image/png',
  },
  {
    src: '/icons/icon-512x512.png',
    sizes: '512x512',
    type: 'image/png',
  },
],
  }
}