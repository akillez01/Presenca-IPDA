# Guia rápido: ativar HTTPS local para captura de foto

A captura de fotos via navegador (webcam ou câmera do celular) só funciona em contextos seguros (HTTPS ou `localhost`). Use este passo a passo para habilitar HTTPS no ambiente de desenvolvimento e permitir que o formulário de cadastro abra a câmera tanto no computador quanto no celular.

## 1. Gerar certificados locais

Crie uma pasta com os certificados esperados pelo projeto (já existe em `certs/`).

### Opção A — mkcert (recomendado)

```bash
mkcert localhost 192.168.0.17
mv "localhost+2.pem" certs/local-cert.pem
mv "localhost+2-key.pem" certs/local-key.pem
```

> Ajuste o IP para o endereço da máquina na sua rede local.

### Opção B — OpenSSL

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/local-key.pem \
  -out certs/local-cert.pem \
  -subj "/CN=192.168.0.17"
```

## 2. Instalar o certificado no PC e no celular

- No computador, abra o arquivo `.pem` gerado pelo mkcert e adicione-o ao repositório de certificados confiáveis.
- No celular (Android): exporte o certificado raiz gerado pelo mkcert (`mkcert -CAROOT`) e instale via **Configurações → Segurança → Criptografia e credenciais → Instalar certificado**.
- No iOS: envie o certificado por e-mail/Airdrop, instale em **Ajustes → Geral → Gerenciamento de VPN e dispositivo**, depois **Ajustes → Sobre → Ajustes de Certificado** para confiar.

## 3. Subir o Next.js em HTTPS

Com os arquivos `certs/local-cert.pem` e `certs/local-key.pem` prontos, execute:

```bash
npm run dev:https
```

Isso inicia o server em `https://localhost:9002` e `https://192.168.0.17:9002`.

## 4. Acessar do PC e do celular

- No computador, abra `https://localhost:9002`.
- No celular conectado à mesma rede, use `https://192.168.0.17:9002` e aceite o certificado.

## 5. Verificar a câmera no formulário

Abra a página `/register` e clique em **Usar câmera**. Se a conexão estiver segura, o navegador solicitará permissão para a webcam/câmera e a pré-visualização será exibida.

> Se o botão permanecer desabilitado, confira a mensagem abaixo do componente — ela indica se falta HTTPS ou permissão de hardware.

Pronto! Com HTTPS ativo, a captura de fotos funciona tanto na webcam do PC quanto no navegador do celular.
