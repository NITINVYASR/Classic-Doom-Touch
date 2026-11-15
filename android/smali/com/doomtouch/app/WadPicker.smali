.class public final Lcom/doomtouch/app/WadPicker;
.super Landroid/webkit/WebChromeClient;

.field private final activity:Landroid/app/Activity;
.field private pending:Landroid/webkit/ValueCallback;

.method public constructor <init>(Landroid/app/Activity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lcom/doomtouch/app/WadPicker;->activity:Landroid/app/Activity;
    return-void
.end method

.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 3
    const/4 v0, 0x0
    invoke-virtual {p0, v0, v0}, Lcom/doomtouch/app/WadPicker;->complete(ILandroid/content/Intent;)V
    iput-object p2, p0, Lcom/doomtouch/app/WadPicker;->pending:Landroid/webkit/ValueCallback;
    new-instance v1, Landroid/content/Intent;
    const-string v2, "android.intent.action.OPEN_DOCUMENT"
    invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    const-string v2, "android.intent.category.OPENABLE"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;
    const-string v2, "*/*"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;

    :try_start
    iget-object v2, p0, Lcom/doomtouch/app/WadPicker;->activity:Landroid/app/Activity;
    const/16 v0, 0x41
    invoke-virtual {v2, v1, v0}, Landroid/app/Activity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end
    .catch Landroid/content/ActivityNotFoundException; {:try_start .. :try_end} :failed
    goto :done
    :failed
    move-exception v0
    const/4 v0, 0x0
    invoke-virtual {p0, v0, v0}, Lcom/doomtouch/app/WadPicker;->complete(ILandroid/content/Intent;)V
    :done
    const/4 v0, 0x1
    return v0
.end method

.method public complete(ILandroid/content/Intent;)V
    .locals 2
    iget-object v0, p0, Lcom/doomtouch/app/WadPicker;->pending:Landroid/webkit/ValueCallback;
    if-eqz v0, :done
    const/4 v1, 0x0
    iput-object v1, p0, Lcom/doomtouch/app/WadPicker;->pending:Landroid/webkit/ValueCallback;
    invoke-static {p1, p2}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
    move-result-object v1
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :done
    return-void
.end method
