import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Replaced 'allowedDevOrigins' with the correct 'serverActions' configuration
  experimental: {
    serverActions: {
      allowedOrigins: [
        '9000-firebase-studio-1780486853598.cluster-wurh6gchdjcjmwrw2tqtufvhss.cloudworkstations.dev',
        '*.cloudworkstations.dev'
      ]
    }
  },
  allowedDevOrigins: ["192.168.1.36"],
};


export default nextConfig;