#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const htaccessContent = `# Sistema de Presença IPDA - Configurações Plesk
# Desenvolvido por AchillesOS

# Rewrite Engine
RewriteEngine On

# HTTPS Redirect (se não estiver usando SSL do Plesk)
# RewriteCond %{HTTPS} off
# RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Gzip Compression
<IfModule mod_deflate.c>
    # Compress HTML, CSS, JavaScript, Text, XML and fonts
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/vnd.ms-fontobject
    AddOutputFilterByType DEFLATE application/x-font
    AddOutputFilterByType DEFLATE application/x-font-opentype
    AddOutputFilterByType DEFLATE application/x-font-otf
    AddOutputFilterByType DEFLATE application/x-font-truetype
    AddOutputFilterByType DEFLATE application/x-font-ttf
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE font/opentype
    AddOutputFilterByType DEFLATE font/otf
    AddOutputFilterByType DEFLATE font/ttf
    AddOutputFilterByType DEFLATE image/svg+xml
    AddOutputFilterByType DEFLATE image/x-icon
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/javascript
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/xml
    
    # Remove browser bugs (only needed for really old browsers)
    BrowserMatch ^Mozilla/4 gzip-only-text/html
    BrowserMatch ^Mozilla/4\\.0[678] no-gzip
    BrowserMatch \\bMSIE !no-gzip !gzip-only-text/html
    Header append Vary User-Agent
</IfModule>

# Browser Caching
<IfModule mod_expires.c>
    ExpiresActive on
    
    # Images
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/webp "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
    ExpiresByType image/x-icon "access plus 1 year"
    
    # Video
    ExpiresByType video/mp4 "access plus 1 month"
    ExpiresByType video/mpeg "access plus 1 month"
    
    # CSS, JavaScript
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType text/javascript "access plus 1 month"
    
    # Others
    ExpiresByType application/pdf "access plus 1 month"
    ExpiresByType application/x-shockwave-flash "access plus 1 month"
</IfModule>

# Security Headers
<IfModule mod_headers.c>
    # X-Content-Type-Options
    Header always set X-Content-Type-Options nosniff
    
    # X-Frame-Options
    Header always set X-Frame-Options DENY
    
    # X-XSS-Protection
    Header always set X-XSS-Protection "1; mode=block"
    
    # Referrer Policy
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    
    # Content Security Policy (ajuste conforme necessário)
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; frame-ancestors 'none';"
    
    # Remove Server Header
    Header unset Server
    Header unset X-Powered-By
</IfModule>

# Single Page Application (SPA) Routing
# Redirect all requests to index.html for client-side routing
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Handle Angular and other client-side routing
    # Skip real files and directories
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    
    # Skip API routes (se houver)
    RewriteCond %{REQUEST_URI} !^/api/
    
    # Skip assets
    RewriteCond %{REQUEST_URI} !\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$
    
    # Redirect to index.html
    RewriteRule . /index.html [L]
</IfModule>

# Disable directory browsing
Options -Indexes

# Protect sensitive files
<FilesMatch "\\.(env|env\\.local|env\\.production|gitignore|htaccess|htpasswd)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Protect configuration files
<FilesMatch "\\.(json|md|txt|log)$">
    <RequireAll>
        Require all denied
    </RequireAll>
</FilesMatch>

# Allow specific files
<FilesMatch "^(favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json)$">
    <RequireAll>
        Require all granted
    </RequireAll>
</FilesMatch>

# Error pages (opcional)
# ErrorDocument 404 /404.html
# ErrorDocument 500 /500.html

# Charset
AddDefaultCharset UTF-8

# MIME Types
<IfModule mod_mime.c>
    # Webfonts
    AddType application/vnd.ms-fontobject .eot
    AddType font/truetype .ttf
    AddType font/opentype .otf
    AddType application/x-font-woff .woff
    AddType application/font-woff2 .woff2
    
    # Audio
    AddType audio/mp4 .m4a
    AddType audio/ogg .oga
    
    # Video
    AddType video/mp4 .mp4
    AddType video/ogg .ogv
    AddType video/webm .webm
    
    # Images
    AddType image/webp .webp
    AddType image/svg+xml .svg
    
    # Web App Manifest
    AddType application/manifest+json .webmanifest
    AddType application/x-web-app-manifest+json .webapp
    AddType text/cache-manifest .appcache
</IfModule>

# Performance optimizations
<IfModule mod_headers.c>
    # Preload key resources
    <FilesMatch "\\.(css|js)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
    
    # HTML files
    <FilesMatch "\\.html$">
        Header set Cache-Control "public, max-age=0, must-revalidate"
    </FilesMatch>
</IfModule>
`;

const outputDir = path.join(process.cwd(), 'out');
const htaccessPath = path.join(outputDir, '.htaccess');

// Verificar se o diretório out existe
if (!fs.existsSync(outputDir)) {
    console.log('❌ Diretório "out" não encontrado. Execute primeiro: npm run build:plesk');
    process.exit(1);
}

// Criar o arquivo .htaccess
try {
    fs.writeFileSync(htaccessPath, htaccessContent, 'utf8');
    console.log('✅ Arquivo .htaccess criado com sucesso em:', htaccessPath);
    console.log('📋 Configurações incluídas:');
    console.log('   - Redirecionamento SPA');
    console.log('   - Compressão Gzip');
    console.log('   - Cache de browser');
    console.log('   - Headers de segurança');
    console.log('   - Proteção de arquivos sensíveis');
    console.log('   - Otimizações de performance');
} catch (error) {
    console.error('❌ Erro ao criar .htaccess:', error.message);
    process.exit(1);
}
