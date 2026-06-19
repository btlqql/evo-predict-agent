import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: []
};

export default nextConfig;
