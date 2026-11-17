/* LIVARO онлайн: значок программы на экране телефона (подключает только сервер, в офлайн-версии файла нет).
   — регистрирует помощника /sw.js (без интернета показывает «Нет связи» вместо белого экрана);
   — Android: предлагает «Установить» (кнопка браузера beforeinstallprompt);
   — iPhone: один раз подсказывает, как добавить значок через «Поделиться». «Не сейчас» прячет подсказку на 30 дней. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }
  var KEY = 'livaro_install_hide', DAYS = 30;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var phone = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function hidden() { try { return Date.now() - (+localStorage.getItem(KEY) || 0) < DAYS * 86400000; } catch (e) { return false; } }
  function hide() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }
  if (standalone || !phone || hidden()) return;

  function bar(html) {
    var old = document.getElementById('pwa-bar'); if (old) old.remove();
    var d = document.createElement('div');
    d.id = 'pwa-bar'; d.className = 'noprint'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Значок LIVARO на телефоне');
    d.style.cssText = 'position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:90;background:#fff;color:#16191D;' +
      'border:1px solid #DDE1E6;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.22);padding:14px;display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.4';
    d.innerHTML = '<img src="/app/icons/icon-192.png" alt="" style="width:48px;height:48px;border-radius:12px;flex:none"><div style="flex:1;min-width:0">' + html + '</div>';
    document.body.appendChild(d);
    return d;
  }
  var btn = 'font:inherit;font-size:15px;font-weight:600;padding:9px 14px;border-radius:10px;cursor:pointer;';
  var later = '<button data-pwa="later" style="' + btn + 'border:1px solid #CDD3DA;background:#fff;color:#16191D">Не сейчас</button>';
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-pwa]'); if (!b) return;
    var box = document.getElementById('pwa-bar');
    if (b.dataset.pwa === 'install' && deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (r) { if (r && r.outcome !== 'accepted') hide(); }).catch(function () {});
      deferred = null;
    } else hide();
    if (box) box.remove();
  });

  // Android (Яндекс.Браузер, Chrome): браузер сам говорит, что программу можно установить
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    bar('<b>Поставить LIVARO значком на телефон?</b><div style="color:#5B636E;margin:2px 0 10px">Будет открываться как обычное приложение, без адресной строки.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button data-pwa="install" style="' + btn + 'border:0;background:#1E56B3;color:#fff">Установить</button>' + later + '</div>');
  });
  window.addEventListener('appinstalled', function () { hide(); var b = document.getElementById('pwa-bar'); if (b) b.remove(); });

  // iPhone: кнопки установки нет — подсказываем, где нажать
  if (ios) {
    var share = '<svg width="16" height="18" viewBox="0 0 16 20" style="vertical-align:-3px" aria-label="Поделиться"><path d="M8 1v12M4 5l4-4 4 4" fill="none" stroke="#1E56B3" stroke-width="2"/><path d="M3 9H1v10h14V9h-2" fill="none" stroke="#1E56B3" stroke-width="2"/></svg>';
    setTimeout(function () {
      bar('<b>Значок LIVARO на экран телефона</b><div style="color:#3A414A;margin:4px 0 10px">Нажмите внизу ' + share + ' <b>«Поделиться»</b>, затем <b>«На экран "Домой"»</b> и <b>«Добавить»</b>.</div>' +
        '<div style="display:flex;gap:8px"><button data-pwa="later" style="' + btn + 'border:0;background:#1E56B3;color:#fff">Понятно</button></div>');
    }, 1500);
  }
})();
