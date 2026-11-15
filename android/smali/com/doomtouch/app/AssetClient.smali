.class public final Lcom/doomtouch/app/AssetClient;
.super Landroid/webkit/WebViewClient;

.field private final assets:Landroid/content/res/AssetManager;

.method public constructor <init>(Landroid/content/res/AssetManager;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V
    iput-object p1, p0, Lcom/doomtouch/app/AssetClient;->assets:Landroid/content/res/AssetManager;
    return-void
.end method

.method public shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
    .locals 5
    invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;
    move-result-object v0
    invoke-virtual {v0}, Landroid/net/Uri;->getAuthority()Ljava/lang/String;
    move-result-object v1
    const-string v2, "doom.local"
    invoke-virtual {v2, v1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-eqz v1, :missing

    invoke-virtual {v0}, Landroid/net/Uri;->getPath()Ljava/lang/String;
    move-result-object v0
    if-eqz v0, :missing
    const-string v1, "/(vendor/)?[a-z0-9_-]+\\.(html|js|css|wasm|wad)"
    invoke-virtual {v0, v1}, Ljava/lang/String;->matches(Ljava/lang/String;)Z
    move-result v1
    if-eqz v1, :missing

    const/4 v1, 0x1
    invoke-virtual {v0, v1}, Ljava/lang/String;->substring(I)Ljava/lang/String;
    move-result-object v0
    const-string v1, ".js"
    invoke-virtual {v0, v1}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v1
    if-nez v1, :javascript
    const-string v1, ".css"
    invoke-virtual {v0, v1}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v1
    if-nez v1, :stylesheet
    const-string v1, ".html"
    invoke-virtual {v0, v1}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v1
    if-nez v1, :html
    const-string v1, ".wasm"
    invoke-virtual {v0, v1}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v1
    if-nez v1, :wasm
    const-string v2, "application/octet-stream"
    goto :open

    :javascript
    const-string v2, "text/javascript"
    goto :open
    :stylesheet
    const-string v2, "text/css"
    goto :open
    :html
    const-string v2, "text/html"
    goto :open
    :wasm
    const-string v2, "application/wasm"

    :open
    :try_start
    iget-object v1, p0, Lcom/doomtouch/app/AssetClient;->assets:Landroid/content/res/AssetManager;
    const/4 v3, 0x2
    invoke-virtual {v1, v0, v3}, Landroid/content/res/AssetManager;->open(Ljava/lang/String;I)Ljava/io/InputStream;
    move-result-object v1
    new-instance v0, Landroid/webkit/WebResourceResponse;
    const/4 v3, 0x0
    invoke-direct {v0, v2, v3, v1}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V
    :try_end
    .catch Ljava/io/IOException; {:try_start .. :try_end} :failed
    return-object v0
    :failed
    move-exception v0
    :missing
    const/4 v0, 0x0
    return-object v0
.end method
