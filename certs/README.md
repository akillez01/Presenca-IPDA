# Certificados locais para desenvolvimento HTTPS

Coloque aqui os arquivos de certificado usados pelo script `npm run dev:https`.

O script espera encontrar:

- `certs/local-cert.pem`
- `certs/local-key.pem`

Você pode gerar certificados válidos para `localhost` e para o IP da sua rede interna (ex: `192.168.0.17`) usando [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert localhost 192.168.0.17
mv "localhost+2.pem" certs/local-cert.pem
mv "localhost+2-key.pem" certs/local-key.pem
```

Caso prefira `openssl`:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/local-key.pem \
  -out certs/local-cert.pem \
  -subj "/CN=192.168.0.17"
```

Depois de gerar os arquivos, rode:

```bash
npm run dev:https
```

O servidor ficará acessível em `https://localhost:9002` e `https://192.168.0.17:9002` (aceite o certificado nos navegadores do PC e do celular).
