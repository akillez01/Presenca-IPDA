import type { NextConfig } from 'next';

// Detectar se é build para Plesk
const isPleskBuild = process.env.BUILD_TARGET === 'plesk' || process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Configurações básicas
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configuração webpack para resolver problemas de dependências Node.js
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Excluir módulos Node.js do bundle do cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        child_process: false,
      };
    }
    
    return config;
  },
  
  // Configurações de imagem otimizadas para Plesk
  images: {
    unoptimized: true, // Necessário para static export
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Otimizações específicas para Plesk
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Output configurado para Plesk (static export)
  output: isPleskBuild ? 'export' : undefined,
  trailingSlash: isPleskBuild,
  skipTrailingSlashRedirect: isPleskBuild,
  
  // Configurações de assets para Plesk
  assetPrefix: isPleskBuild ? '' : undefined,
  basePath: '',
  
  // Headers de segurança (apenas para builds não-Plesk)
  async headers() {
    if (isPleskBuild) return []; // Headers não funcionam com export
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Rewrites (apenas para builds não-Plesk)
  async rewrites() {
    if (isPleskBuild) return []; // Rewrites não funcionam com export
    
    return {
      fallback: [
        {
          source: '/:path*',
          destination: '/index.html',
        },
      ],
    };
  },

  // Configurações de performance otimizadas
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      'recharts'
    ],
  },

  // Turbopack config (nova configuração)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // Configurações específicas para servidor estático (Plesk)
  ...(isPleskBuild && {
    distDir: 'out',
    generateBuildId: async () => {
      return `plesk-build-${Date.now()}`;
    },
  }),
};

export default nextConfig;
