/* =========================================================================
   kiosk.js — Modo Público / Modo Usuário do Robô Interativo
   Este arquivo é compartilhado por index.htm e quizes.html.
   Ele cuida de:
     1) Ativar/represtar o modo tela cheia (kiosk) em qualquer uma das páginas
     2) Mostrar uma animação de convite quando o sistema fica ocioso
     3) Exigir senha para realmente sair do Modo Público
   Tudo funciona 100% offline (sem depender de internet).
   ========================================================================= */
(function(){
  "use strict";

  var CHAVE_MODO   = "roboEscolar_modoPublico";
  var CHAVE_SENHA  = "roboEscolar_senha";      // mesma senha já usada na Área do Professor
  var TEMPO_OCIOSO = 40000;                    // 40s sem interação -> convite

  var elBotaoFlutuante = null;
  var elOverlaySair     = null;
  var elOverlayConvite  = null;
  var elOverlayReentrar = null;
  var timerOcioso       = null;

  /* ---------------- estilos injetados (self-contained) ---------------- */
  function injetarEstilos(){
    if(document.getElementById("kiosk-style")) return;
    var css = "" +
    "body.kiosk-ativo, body.kiosk-ativo *{ cursor:url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NiIgaGVpZ2h0PSI0NiIgdmlld0JveD0iMCAwIDQ2IDQ2Ij4KPHBvbHlnb24gcG9pbnRzPSI0LDIgNCwzOCAxNCwzMCAyMCw0MiAyNiwzOSAyMCwyNyA0MCwyNyIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSIjMmUyOTRlIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBvbHlnb24gcG9pbnRzPSI0LDIgNCwzOCAxNCwzMCAyMCw0MiAyNiwzOSAyMCwyNyA0MCwyNyIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmY2ZjU5IiBzdHJva2Utd2lkdGg9IjEuMiIvPgo8L3N2Zz4=') 4 2, auto !important; }" +
    "body.kiosk-ativo *::selection{ background:transparent; }" +
    ".kiosk-btn-sair{ position:fixed; bottom:10px; right:10px; width:34px; height:34px;" +
      " border-radius:50%; background:rgba(46,41,78,.12); color:rgba(46,41,78,.55);" +
      " border:none; font-size:16px; display:flex; align-items:center; justify-content:center;" +
      " cursor:pointer; z-index:99998; transition:.2s background,.2s opacity; opacity:.35; }" +
    ".kiosk-btn-sair:hover{ opacity:1; background:rgba(46,41,78,.22); }" +
    ".kiosk-overlay{ position:fixed; inset:0; z-index:99999; display:flex; align-items:center;" +
      " justify-content:center; padding:20px; background:rgba(46,41,78,.72); backdrop-filter:blur(3px);" +
      " font-family:'Nunito','Baloo 2',sans-serif; animation:kioskFade .25s ease; }" +
    "@keyframes kioskFade{ from{opacity:0;} to{opacity:1;} }" +
    ".kiosk-card{ background:#fff; border-radius:26px; padding:30px 26px; max-width:360px; width:100%;" +
      " text-align:center; box-shadow:0 18px 40px -18px rgba(0,0,0,.5); }" +
    ".kiosk-card h3{ font-family:'Baloo 2',sans-serif; color:#2e294e; margin:0 0 8px; font-size:1.25rem; }" +
    ".kiosk-card p{ color:#5b5480; font-size:.92rem; line-height:1.5; margin:0 0 14px; }" +
    ".kiosk-card input{ width:100%; padding:12px 14px; border-radius:14px; border:2px solid #eae6f7;" +
      " font-size:1rem; text-align:center; margin-bottom:10px; font-family:'Nunito',sans-serif; }" +
    ".kiosk-card .kiosk-erro{ color:#e8543d; font-size:.82rem; min-height:18px; margin-bottom:6px; }" +
    ".kiosk-card button{ width:100%; padding:12px; border-radius:14px; border:none; font-weight:800;" +
      " font-family:'Baloo 2',sans-serif; font-size:.98rem; cursor:pointer; margin-top:6px; }" +
    ".kiosk-btn-primario{ background:#3dbfae; color:#fff; }" +
    ".kiosk-btn-secundario{ background:#f7f5ff; color:#2e294e; }" +
    ".kiosk-convite{ text-align:center; color:#fff; cursor:pointer; }" +
    ".kiosk-convite .kiosk-robo-emoji{ font-size:min(30vw,190px); display:block;" +
      " animation:kioskBounce 1.1s ease-in-out infinite; filter:drop-shadow(0 14px 18px rgba(0,0,0,.35)); }" +
    "@keyframes kioskBounce{ 0%,100%{ transform:translateY(0) rotate(-4deg);} 50%{ transform:translateY(-26px) rotate(4deg);} }" +
    ".kiosk-convite .kiosk-msg{ font-family:'Baloo 2',sans-serif; font-size:1.5rem; margin-top:10px; }" +
    ".kiosk-convite .kiosk-msg2{ font-family:'Nunito',sans-serif; font-size:1.05rem; opacity:.9; margin-top:6px; }" +
    "@media (min-width:900px){" +
      " body.kiosk-ativo .robo-grande{ transform:scale(1.65); margin:26px 0 44px; }" +
      " body.kiosk-ativo #tela-boasvindas .card{ max-width:760px; padding:52px 48px; }" +
    "}";
    var tag = document.createElement("style");
    tag.id = "kiosk-style";
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ---------------- utilidades ---------------- */
  function estaAtivo(){ return localStorage.getItem(CHAVE_MODO) === "1"; }

  function garantirSenhaPadrao(){
    if(!localStorage.getItem(CHAVE_SENHA)){
      localStorage.setItem(CHAVE_SENHA, "123456");
    }
  }

  function estaEmTelaCheia(){
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }

  function pedirTelaCheia(){
    var el = document.documentElement;
    var pedir = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if(!pedir){ return; }
    try{
      var r = pedir.call(el);
      if(r && r.catch){ r.catch(function(){ mostrarOverlayReentrar(); }); }
    }catch(e){ mostrarOverlayReentrar(); }
  }

  function sairDaTelaCheiaNativa(){
    var sair = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if(sair){ try{ sair.call(document); }catch(e){} }
  }

  /* ---------------- botão flutuante de saída (discreto) ---------------- */
  function criarBotaoFlutuante(){
    if(elBotaoFlutuante) return;
    elBotaoFlutuante = document.createElement("button");
    elBotaoFlutuante.className = "kiosk-btn-sair";
    elBotaoFlutuante.type = "button";
    elBotaoFlutuante.title = "Sair do Modo Público";
    elBotaoFlutuante.textContent = "🔒";
    elBotaoFlutuante.addEventListener("click", function(){ abrirOverlaySair(); });
    document.body.appendChild(elBotaoFlutuante);
  }
  function removerBotaoFlutuante(){
    if(elBotaoFlutuante && elBotaoFlutuante.parentNode){ elBotaoFlutuante.parentNode.removeChild(elBotaoFlutuante); }
    elBotaoFlutuante = null;
  }

  /* ---------------- overlay: pedir senha para sair ---------------- */
  function abrirOverlaySair(){
    fecharOverlayConvite();
    if(elOverlaySair) return;
    elOverlaySair = document.createElement("div");
    elOverlaySair.className = "kiosk-overlay";
    elOverlaySair.innerHTML =
      '<div class="kiosk-card">' +
        '<h3>🔒 Sair do Modo Público</h3>' +
        '<p>Digite a senha para sair da tela cheia. Se foi sem querer, toque em "Continuar no Modo Público".</p>' +
        '<input type="password" id="kiosk-senha-input" placeholder="Senha" inputmode="numeric">' +
        '<div class="kiosk-erro" id="kiosk-senha-erro"></div>' +
        '<button class="kiosk-btn-primario" id="kiosk-btn-confirmar">Sair do Modo Público</button>' +
        '<button class="kiosk-btn-secundario" id="kiosk-btn-continuar">Continuar no Modo Público</button>' +
      '</div>';
    document.body.appendChild(elOverlaySair);

    var input = document.getElementById("kiosk-senha-input");
    var erro  = document.getElementById("kiosk-senha-erro");

    function tentarSair(){
      garantirSenhaPadrao();
      var senhaSalva = localStorage.getItem(CHAVE_SENHA);
      if(input.value === senhaSalva){
        desativarModoPublico();
      }else{
        erro.textContent = "Senha incorreta. Tente novamente.";
        input.value = "";
        input.focus();
      }
    }

    document.getElementById("kiosk-btn-confirmar").addEventListener("click", tentarSair);
    input.addEventListener("keydown", function(e){ if(e.key === "Enter") tentarSair(); });
    document.getElementById("kiosk-btn-continuar").addEventListener("click", function(){
      fecharOverlaySair();
      pedirTelaCheia();
      registrarAtividade();
    });
    setTimeout(function(){ input.focus(); }, 50);
  }
  function fecharOverlaySair(){
    if(elOverlaySair && elOverlaySair.parentNode){ elOverlaySair.parentNode.removeChild(elOverlaySair); }
    elOverlaySair = null;
  }

  /* ---------------- overlay: reentrar em tela cheia (quando o navegador bloqueia o pedido automático) ---------------- */
  function mostrarOverlayReentrar(){
    if(elOverlayReentrar || !estaAtivo()) return;
    elOverlayReentrar = document.createElement("div");
    elOverlayReentrar.className = "kiosk-overlay";
    elOverlayReentrar.innerHTML =
      '<div class="kiosk-card">' +
        '<h3>🤖 Modo Público</h3>' +
        '<p>Toque no botão abaixo para entrar em tela cheia.</p>' +
        '<button class="kiosk-btn-primario" id="kiosk-btn-reentrar">Entrar em Tela Cheia</button>' +
        '<button class="kiosk-btn-secundario" id="kiosk-btn-sair-em-vez">Sair do Modo Público</button>' +
      '</div>';
    document.body.appendChild(elOverlayReentrar);
    document.getElementById("kiosk-btn-reentrar").addEventListener("click", function(){
      fecharOverlayReentrar();
      pedirTelaCheia();
    });
    document.getElementById("kiosk-btn-sair-em-vez").addEventListener("click", function(){
      fecharOverlayReentrar();
      abrirOverlaySair();
    });
  }
  function fecharOverlayReentrar(){
    if(elOverlayReentrar && elOverlayReentrar.parentNode){ elOverlayReentrar.parentNode.removeChild(elOverlayReentrar); }
    elOverlayReentrar = null;
  }

  /* ---------------- overlay: convite por inatividade ---------------- */
  function abrirOverlayConvite(){
    if(elOverlayConvite || elOverlaySair || elOverlayReentrar) return;
    elOverlayConvite = document.createElement("div");
    elOverlayConvite.className = "kiosk-overlay";
    elOverlayConvite.innerHTML =
      '<div class="kiosk-convite">' +
        '<span class="kiosk-robo-emoji">🤖</span>' +
        '<div class="kiosk-msg">Olá! Eu sou o Robô Interativo!</div>' +
        '<div class="kiosk-msg2">Clique em qualquer lugar para brincar 👋</div>' +
      '</div>';
    elOverlayConvite.addEventListener("click", fecharOverlayConvite);
    document.body.appendChild(elOverlayConvite);
  }
  function fecharOverlayConvite(){
    if(elOverlayConvite && elOverlayConvite.parentNode){ elOverlayConvite.parentNode.removeChild(elOverlayConvite); }
    elOverlayConvite = null;
  }

  /* ---------------- monitor de inatividade ---------------- */
  function registrarAtividade(){
    if(elOverlayConvite){ fecharOverlayConvite(); }
    if(!estaAtivo()) return;
    if(timerOcioso) clearTimeout(timerOcioso);
    timerOcioso = setTimeout(abrirOverlayConvite, TEMPO_OCIOSO);
  }
  function iniciarMonitorOcioso(){
    ["mousemove","mousedown","touchstart","keydown","click","scroll"].forEach(function(ev){
      document.addEventListener(ev, registrarAtividade, {passive:true});
    });
    registrarAtividade();
  }
  function pararMonitorOcioso(){
    if(timerOcioso) clearTimeout(timerOcioso);
    timerOcioso = null;
  }

  /* ---------------- ativar / desativar Modo Público ---------------- */
  function ativarModoPublico(){
    garantirSenhaPadrao();
    localStorage.setItem(CHAVE_MODO, "1");
    document.body.classList.add("kiosk-ativo");
    pedirTelaCheia();
    criarBotaoFlutuante();
    iniciarMonitorOcioso();
  }

  function desativarModoPublico(){
    localStorage.removeItem(CHAVE_MODO);
    document.body.classList.remove("kiosk-ativo");
    sairDaTelaCheiaNativa();
    removerBotaoFlutuante();
    pararMonitorOcioso();
    fecharOverlaySair();
    fecharOverlayConvite();
    fecharOverlayReentrar();
  }

  /* Se o usuário sair da tela cheia sem usar o botão de saída (ex: tecla ESC),
     mostramos a mesma tela de senha em vez de deixar o app "solto". */
  function aoMudarTelaCheia(){
    if(!estaAtivo()) return;
    if(!estaEmTelaCheia()){
      abrirOverlaySair();
    }
  }

  document.addEventListener("fullscreenchange", aoMudarTelaCheia);
  document.addEventListener("webkitfullscreenchange", aoMudarTelaCheia);
  document.addEventListener("msfullscreenchange", aoMudarTelaCheia);

  /* Dificulta um pouco sair sem querer: avisa antes de fechar/recarregar a aba,
     e bloqueia o menu de botão direito enquanto o Modo Público está ativo. */
  window.addEventListener("beforeunload", function(e){
    if(estaAtivo()){ e.preventDefault(); e.returnValue = ""; }
  });
  document.addEventListener("contextmenu", function(e){
    if(estaAtivo()) e.preventDefault();
  });

  /* Ao carregar qualquer página que inclua este script, se o Modo Público
     já estava ativo (ex: o usuário navegou de index.htm para quizes.html),
     retomamos a tela cheia automaticamente nesta página também. */
  document.addEventListener("DOMContentLoaded", function(){
    injetarEstilos();
    if(estaAtivo()){
      document.body.classList.add("kiosk-ativo");
      criarBotaoFlutuante();
      iniciarMonitorOcioso();
      pedirTelaCheia();
    }
  });

  /* API pública usada pelos botões do HTML */
  window.RoboKiosk = {
    ativar: ativarModoPublico,
    desativar: abrirOverlaySair,
    estaAtivo: estaAtivo
  };
})();
