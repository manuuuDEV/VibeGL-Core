/**
 * Next.js configuration: enable static export output for Next 14+
 * This makes `next build` produce a static `out/` directory that can be deployed to GitHub Pages.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
};

module.exports = nextConfig;
