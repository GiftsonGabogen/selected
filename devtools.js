chrome.devtools.panels.create(
  "Element Selector",
  "icons/default_icon.png",
  "panel.html",
  function (panel) {
    console.log("panel created");
  }
);

// This script runs in the context of the DevTools page, not the panel
