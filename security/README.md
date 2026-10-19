# Acesso por proximidade — v0.29

As regras do Realtime Database deixam de permitir leitura pública de `/mapa`. A interface só assina os dados após confirmar a conta administradora ou gravar uma presença aceita pelo servidor.

- Administrador: o UID precisa ter `administradores/UID === true`; o servidor dispensa a presença GPS.
- Usuário comum: precisa de autenticação Firebase, coordenadas dentro de uma célula privada autorizada, precisão informada de até 100 m e timestamp gerado pelo servidor. A leitura e as gravações colaborativas expiram após 45 segundos sem renovação.
- `/mapaAcesso` contém as células privadas. Só administradores leem ou alteram a área. O solicitante calcula a chave da célula a partir do próprio GPS; não baixa a geometria para pedir autorização.
- As células são aceitas somente quando seus quatro cantos estão dentro de 3 km de um ponto amostrado das vias. A malha de aproximadamente 111 m é conservadora na borda: pode negar alguns pontos ainda próximos do limite. O critério é proximidade de vias, não perímetro legal da refinaria.
- O cliente renova a presença com GPS recente, bloqueia sem GPS confiável/rede, limpa as referências privadas ao revogar a autorização e remove o cache antigo do mapa em localStorage. Não grava novos mapas em cache local. A localização é sobrescrita, não cria histórico; há remoção onDisconnect e revogação ao perder acesso.
- As bases originais passam para `/mapa/base`; ruas oficiais, pontos e gravações permanecem nos caminhos atuais. Não publique esses dados, exportações nem a cobertura privada no GitHub. Os arquivos em `security-private` são material de migração, não código público.
- Salvar refinamentos como administrador também recalcula `/mapaAcesso` para acompanhar as vias. Os perfis comuns não podem alterar a área nem promover a própria conta.

## Limites relevantes

A regra no servidor verifica as coordenadas recebidas, mas GPS de navegador/celular pode ser simulado. Isto não comprova identidade, emprego ou presença física inviolável. Para proteção contra usuários deliberadamente hostis, acrescentar contas aprovadas e controles de dispositivo/atestado ou rede corporativa. Dados legitimamente exportados ou tornados públicos em versões anteriores não podem ser recolhidos com uma regra nova.

O SDK web mantém dados anteriormente recebidos em memória enquanto a página existe; a revogação limpa as referências da aplicação e interrompe a assinatura, mas não pode desfazer uma cópia que o usuário já tenha feito. A proteção do servidor impede novas leituras sem autorização e sem presença válida. Versões antigas abertas precisam ser encerradas/recarregadas.

## Testes

`node tests/access-gate.cjs` verifica a geometria conservadora e o bloqueio por padrão, recusa do servidor, expiração e administrador.

`firebase emulators:exec --only database --project demo-alunorte-access --config security/firebase.emulator.json 'node tests/access-rules.cjs'` testa as regras reais com dados sintéticos. Requer Firebase CLI e Java; nunca usar credenciais simuladas contra produção. Os testes cobrem leitura pública negada, proximidade válida, precisão, adulteração de célula/coordenadas, expiração, tentativa de autopromoção e preservação da colaboração autorizada.

Atualizações precisam manter `meta[name=mapa-revision]` e `app-version.json` com a mesma revisão para os aplicativos Android verificarem a versão.
