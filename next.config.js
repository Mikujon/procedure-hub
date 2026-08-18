/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb', // allow attachment uploads through server actions
    },
    // bullmq statically references optional backends (e.g. @valkey/valkey-glide)
    // that aren't installed — we only use the ioredis backend. Keeping bullmq
    // external to the server bundle instead of letting webpack try to resolve
    // every optional branch avoids a "Module not found" build warning.
    serverComponentsExternalPackages: ['bullmq'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // tenant logos / avatars from blob storage
    ],
  },
};

module.exports = nextConfig;
