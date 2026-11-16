# Certifica Vale Desktop

Versão portável para Windows do Certifica Vale. A interface React e a API Express são executadas localmente pelo Electron, enquanto os dados permanecem no TiDB remoto.

## Requisitos para desenvolvimento

- Node.js e npm
- Acesso de rede ao TiDB
- Arquivo `desktop-config.env` criado a partir de `desktop-config.example.env`

O arquivo de configuração contém credenciais e é ignorado pelo Git.

## Comandos

- `npm run typecheck`: valida TypeScript do frontend e backend.
- `npm run desktop:dev`: compila e abre o aplicativo Electron.
- `npm run desktop:dist`: gera o instalador Windows em `release/`.

## Instalação

O instalador NSIS é configurado com `perMachine: false` e `requestedExecutionLevel: asInvoker`. A instalação ocorre no perfil do usuário e não solicita permissão de administrador.

Durante a geração, `desktop-config.env` é incluído como recurso do instalador. Na primeira execução, uma cópia é criada em `%APPDATA%\Certifica Vale\config.env`.

## Segurança

Uma aplicação distribuída que se conecta diretamente ao TiDB precisa transportar uma credencial de banco. Mesmo fora do código-fonte, essa credencial pode ser extraída por um usuário com acesso ao computador. Use no TiDB um usuário exclusivo, com privilégios mínimos, restrição de rede quando possível e rotação periódica da senha.

Para eliminar a distribuição da credencial, seria necessário manter uma API remota entre o aplicativo e o banco.
