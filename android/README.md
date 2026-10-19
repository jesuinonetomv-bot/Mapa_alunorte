# Mapa Alunorte — Android 0.2.1

Primeiro APK para testes em Android 8.0 ou superior. Aplicativo Android com WebView do sistema, carregando exclusivamente o site oficial `https://jesuinonetomv-bot.github.io/Mapa_alunorte/`. Atualizações do site aparecem no aplicativo sem reinstalar o APK. A conta de administrador pode ser usada normalmente, mas a sessão do navegador não é transferida.

Inclui permissão de localização durante o uso, suporte a localização aproximada ou precisa, tela acesa, tela de erro com nova tentativa, exportação JSON pelo seletor de arquivos do Android e confirmação ao sair. Links externos abrem no navegador. Sem acesso a arquivos locais, tráfego HTTP dentro do WebView, permissões de armazenamento ou localização em segundo plano.

Esta versão precisa de internet e do Android System WebView atualizado. Não inclui mapa offline ou serviço de navegação em segundo plano. Os dados do Firebase continuam no projeto atual; os APKS não contêm credenciais de administrador.

## Instalação e teste

1. Abra o APK no Android e autorize a instalação por esse aplicativo quando solicitado pelo sistema.
2. Abra Mapa Alunorte com internet. Ao solicitar GPS, permita localização durante o uso; prefira localização precisa.
3. Teste origem/destino, rota nas ruas desenhadas, ângulos de visão e acompanhamento GPS caminhando em local apropriado.
4. Teste login de administrador, persistência após fechar/reabrir, adicionar ponto e exportar JSON.
5. Confira a mensagem de falha abrindo sem rede e o retorno após reconectar. Verifique o comportamento ao minimizar e voltar.

Validação realizada na geração: compilação Java/DEX/recursos Android, alinhamento ZIP e assinatura APK. Ainda é necessário teste físico de GPS, bússola, WebGL e autenticação em um celular; não houve emulador disponível na geração.

## Compilação reproduzível

Requer JDK 17 com módulo jdk.compiler, Android SDK Platform 35, Build Tools 35.0.0, Bash e zip. Aceite os termos do SDK no ambiente de compilação.

Defina `ANDROID_SDK_ROOT`, `ALUNORTE_KEYSTORE` (caminho privado do .jks) e `ALUNORTE_STORE_PASSWORD`. Execute `bash android/build.sh` da raiz. Saída: `android/build/Mapa-Alunorte-0.2.1.apk`.

Mantenha o keystore e a senha fora do GitHub. Guarde o pacote privado de assinatura entregue com esta versão: futuras atualizações exigem a mesma chave. Incremente `versionCode` e `versionName` no manifesto em novas versões. Identificador Android: `br.com.mapaalunorte`.


## Versão 0.2.1 — voz nativa

Inclui síntese de voz em português pelo mecanismo TTS instalado no Android, com foco temporário de áudio e interrupção ao minimizar o app. Não usa microfone. Instale por cima da versão anterior, mantendo a mesma chave de assinatura e o mesmo identificador. Use Menu → Orientações de voz → Testar voz. É necessária uma voz em português disponível no Android e volume de mídia audível.

O site v0.27 acrescenta bloqueio total/parcial, indicação laranja de lentidão e chegada estimada pela velocidade GPS suavizada. Bloqueios antigos continuam totais. Interdição de um lado permite passagem em ambos os sentidos na malha atual; não representa mão única. Em movimento, a chegada usa distância restante/velocidade observada e não é uma garantia de trânsito futuro. Parado, sem velocidade válida ou com sinal impreciso, não é apresentado horário de chegada.

Verificações desta versão: testes de regras de bloqueio, distância real versus custo de lentidão, ETA, deduplicação e intervalo da voz; compilação e assinatura Android. Ainda requer teste no celular para voz, foco de áudio, GPS e bússola.



## Atualizações do mapa na versão 0.2.1

O aplicativo carrega o HTML sem reutilizar a versão em cache. Verifica app-version.json ao voltar para o primeiro plano e periodicamente enquanto aberto. Recarrega quando não há navegação, gravação, bloqueio em edição ou rascunho. O menu inclui Atualizar mapa agora; durante uso ativo, pede confirmação antes de encerrar a sessão e descartar alterações não salvas. Não apaga cookies, login ou dados locais.

Em toda atualização futura do site, mantenha a meta mapa-revision e app-version.json com a mesma nova revisão. O APK exibe Android 0.2.1 e a versão web carregada no menu. A versão Android 0.2.1 precisa ser instalada uma vez por cima da anterior para habilitar a verificação.
