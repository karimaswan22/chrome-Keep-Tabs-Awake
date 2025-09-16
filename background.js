chrome.scripting.registerContentScripts( [{
    id: "page-script-ajaxInterceptor",
    js: ["handler.js"],
    world: "MAIN",
    allFrames: !0,
    persistAcrossSessions: !1,
    matches: ["http://*/*", "https://*/*"],
    runAt: "document_start"
}]).then((() => {
    console.log("[registerClientScript]"), chrome.scripting.getRegisteredContentScripts().then((e => console.log("[registerClientScript]", "registered content scripts", e)))
}))

