# Alterações

## 2026-10-30 — Mapa automático: trava do jogo na troca de hunt

**O que mudou.** O mapa automático continua desligado por padrão, lê o guia de hunts, exige cerca de 8% a mais de XP de treinador na hunt candidata (`MesaHuntRank.pick`) e envia `{ t: 'hunt.select', slug }`. A decisão de trocar deixou de depender só do carimbo `centroLivreEm` (pausa no centro após dano), que na caça quase nunca zera e impedia a troca. Agora a Mesa alinha-se à trava do pokeidle.io: com cena de combate ativa, a troca pode sair entre ondas (`waveClear` / sequência de onda); com Modo Economia ou Modo Ultra (`semCena`), campo vazio não libera e continua valendo o carimbo do servidor. Também bloqueia enquanto `trocaHuntLivreEm` (pausa do jogo após entrar numa área) não passou. No Safari, a troca fica bloqueada até a conta sair manualmente. O rótulo do melhor farm na baía segue sendo só XP/h e ouro/h; a troca exige limiar, travas e comando.

**Por quê.** O mapa automático não trocava na prática durante a caça porque a condição antiga quase nunca era satisfeita.

**Arquivos de produto.** `dashboard/src/preload/hunt-page-switch-gate.js` (novo), `hunt-page-state.js`, `hunt-page.js`, `hunt-bridge.js`, `dashboard/src/main/hunt-hook.js`, `dashboard/src/renderer/hunt-rank.js`, `auto-hunt.js`, `hunt-rank.test.js`, `dashboard/package.json`.

**Testes.** `node --test` em `hunt-rank.test.js` (7/7) e `npm test` (40/40). Troca ao vivo com conta logada no Electron: **não confirmada**.
