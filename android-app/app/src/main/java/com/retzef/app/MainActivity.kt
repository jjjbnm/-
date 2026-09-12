package com.retzef.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val siteUrl = "https://chi-liart-74.vercel.app/"
    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = result.data?.data
        fileCallback?.onReceiveValue(uri?.let { arrayOf(it) })
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = ContextCompat.getColor(this, R.color.retzef_blue)
        createNotificationChannel()
        requestNotificationPermission()
        webView = WebView(this).apply {
            setBackgroundColor(ContextCompat.getColor(context, android.R.color.white))
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                userAgentString = "$userAgentString RetzefAndroid/1.0"
                builtInZoomControls = false
                displayZoomControls = false
                javaScriptCanOpenWindowsAutomatically = true
            }
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(NativeBridge(), "RetzefNative")
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = handleUrl(request.url)
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) Toast.makeText(this@MainActivity, "אין חיבור לאינטרנט", Toast.LENGTH_SHORT).show()
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val intent = params.createIntent().apply { type = "*/*"; putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false) }
                    return try { filePicker.launch(intent); true } catch (_: ActivityNotFoundException) { fileCallback = null; false }
                }
                override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) { callback?.invoke(origin, true, false) }
            }
        }
        setContentView(webView)
        if (savedInstanceState == null) webView.loadUrl(siteUrl) else webView.restoreState(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (webView.canGoBack()) webView.goBack() else finish() }
        })
    }

    private fun handleUrl(uri: Uri): Boolean {
        val host = uri.host.orEmpty()
        val internal = host == "chi-liart-74.vercel.app"
        if (internal) return false
        // Keep TikTok Login Kit inside the app so Android browser tabs and
        // browser navigation controls do not cover the login flow.
        if (host == "www.tiktok.com" && uri.path.orEmpty().startsWith("/v2/auth/authorize")) return false
        if (uri.scheme == "http" || uri.scheme == "https" || uri.scheme == "tiktok") {
            return try { startActivity(Intent(Intent.ACTION_VIEW, uri)); true } catch (_: ActivityNotFoundException) { false }
        }
        return false
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 50)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("retzef_chat", "התראות רצף", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "בקשות והודעות בצ׳אט של רצף" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    inner class NativeBridge {
        @JavascriptInterface fun isAndroidApp(): Boolean = true
        @JavascriptInterface fun requestNotifications() { requestNotificationPermission() }
    }

    override fun onSaveInstanceState(outState: Bundle) { webView.saveState(outState); super.onSaveInstanceState(outState) }
    override fun onDestroy() { fileCallback?.onReceiveValue(null); webView.destroy(); super.onDestroy() }
}
