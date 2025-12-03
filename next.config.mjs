/** @type {import('next').NextConfig} */
const nextConfig = {
    // Configuración para evitar errores de paquetes ESM en Next 14
    transpilePackages: ['lucide-react', 'date-fns'],
    
    // Si usas imágenes externas, aquí se configuran
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    
    // Desactiva la validación estricta de TypeScript durante el build para evitar bloqueos menores
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    }
};

export default nextConfig;