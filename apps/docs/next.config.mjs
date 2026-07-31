import nextra from 'nextra'
 
const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx'
})
 
export default withNextra({
  output: 'export',
  basePath: process.env.GITHUB_ACTIONS ? '/VibeGL-Core' : '',
  images: {
    unoptimized: true
  },
  reactStrictMode: true,
  transpilePackages: ['@vibe-gl/core', '@vibe-gl/math-utils'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
})
