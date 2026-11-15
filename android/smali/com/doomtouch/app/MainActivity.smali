.class public Lcom/doomtouch/app/MainActivity;
.super Landroid/app/Activity;

.field private web:Landroid/webkit/WebView;
.field private picker:Lcom/doomtouch/app/WadPicker;

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 3
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lcom/doomtouch/app/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    const/4 v2, 0x0
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V

    new-instance v1, Lcom/doomtouch/app/AssetClient;
    invoke-virtual {p0}, Lcom/doomtouch/app/MainActivity;->getAssets()Landroid/content/res/AssetManager;
    move-result-object v2
    invoke-direct {v1, v2}, Lcom/doomtouch/app/AssetClient;-><init>(Landroid/content/res/AssetManager;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    new-instance v1, Lcom/doomtouch/app/WadPicker;
    invoke-direct {v1, p0}, Lcom/doomtouch/app/WadPicker;-><init>(Landroid/app/Activity;)V
    iput-object v1, p0, Lcom/doomtouch/app/MainActivity;->picker:Lcom/doomtouch/app/WadPicker;
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V
    invoke-virtual {p0, v0}, Lcom/doomtouch/app/MainActivity;->setContentView(Landroid/view/View;)V
    const-string v1, "https://doom.local/index.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    return-void
.end method

.method public onWindowFocusChanged(Z)V
    .locals 2
    invoke-super {p0, p1}, Landroid/app/Activity;->onWindowFocusChanged(Z)V
    if-eqz p1, :done
    invoke-virtual {p0}, Lcom/doomtouch/app/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0
    invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v0
    const/16 v1, 0x1706
    invoke-virtual {v0, v1}, Landroid/view/View;->setSystemUiVisibility(I)V
    :done
    return-void
.end method

.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 2
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V
    const/16 v0, 0x41
    if-ne p1, v0, :done
    iget-object v0, p0, Lcom/doomtouch/app/MainActivity;->picker:Lcom/doomtouch/app/WadPicker;
    invoke-virtual {v0, p2, p3}, Lcom/doomtouch/app/WadPicker;->complete(ILandroid/content/Intent;)V
    :done
    return-void
.end method

.method protected onPause()V
    .locals 3
    invoke-super {p0}, Landroid/app/Activity;->onPause()V
    iget-object v0, p0, Lcom/doomtouch/app/MainActivity;->web:Landroid/webkit/WebView;
    const-string v1, "window.doomSuspend?.()"
    const/4 v2, 0x0
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
    invoke-virtual {v0}, Landroid/webkit/WebView;->onPause()V
    return-void
.end method

.method protected onResume()V
    .locals 1
    invoke-super {p0}, Landroid/app/Activity;->onResume()V
    iget-object v0, p0, Lcom/doomtouch/app/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->onResume()V
    return-void
.end method

.method protected onDestroy()V
    .locals 1
    iget-object v0, p0, Lcom/doomtouch/app/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->destroy()V
    invoke-super {p0}, Landroid/app/Activity;->onDestroy()V
    return-void
.end method
