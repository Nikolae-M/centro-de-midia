const api = typeof browser !== "undefined" ? browser : chrome; // Firefox expõe "browser"; Opera/Chromium expõem "chrome"
// Clicar no ícone abre o hub em uma aba.
api.action.onClicked.addListener(() => {
  api.tabs.create({ url: api.runtime.getURL("hub.html") });
});
