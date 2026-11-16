# Certifica Vale Desktop

Cliente Electron do Certifica Vale. A interface é executada localmente e consome exclusivamente a API HTTPS publicada em `https://certvalesenaidesktopapi.vercel.app`.

## Arquitetura de segurança

- O instalador não contém credenciais do TiDB nem `JWT_SECRET`.
- Nenhum servidor ou porta local é aberto.
- O token de acesso é criptografado pelo `safeStorage` do Electron, protegido pelo Windows.
- A configuração legada `%APPDATA%\Certifica Vale\config.env` é removida automaticamente ao iniciar a versão 2.
- A interface usa o protocolo interno seguro `certifica://app`.

## Comandos

- `npm run typecheck`: valida o TypeScript.
- `npm test`: executa os testes.
- `npm run desktop:dev`: compila e inicia o Electron.
- `npm run desktop:dist`: gera o instalador Windows em `release-secure/`.

## Instalação

O instalador NSIS utiliza o perfil do usuário (`perMachine: false`) e não requer elevação administrativa. Como não existe servidor HTTP local, o aplicativo não precisa de liberação de firewall para conexões de entrada.
