package com.movebymove.android;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String APP_URL = "https://freechessanalysis.vercel.app/analysis";
    private static final String APP_HOST = "freechessanalysis.vercel.app";
    private static final int BACKGROUND = Color.rgb(35, 38, 32);
    private static final int ACCENT = Color.rgb(184, 216, 139);
    private static final int FILE_CHOOSER_REQUEST_CODE = 1017;
    private static final int CREATE_DOCUMENT_REQUEST_CODE = 1018;

    private WebView webView;
    private ProgressBar progressBar;
    private boolean threadingWarningShown;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String pendingExportContent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                android.graphics.Insets systemBars = windowInsets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                );
                android.graphics.Insets ime = windowInsets.getInsets(WindowInsets.Type.ime());
                view.setPadding(
                        systemBars.left,
                        systemBars.top,
                        systemBars.right,
                        Math.max(systemBars.bottom, ime.bottom)
                );
                return WindowInsets.CONSUMED;
            });
        }

        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.addJavascriptInterface(new NativeFileBridge(), "MoveByMoveAndroid");

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDefaultTextEncodingName("UTF-8");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setIndeterminate(false);
        progressBar.setProgressTintList(ColorStateList.valueOf(ACCENT));
        progressBar.setProgressBackgroundTintList(ColorStateList.valueOf(Color.rgb(55, 60, 51)));

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3),
                Gravity.TOP
        );
        root.addView(progressBar, progressParams);
        setContentView(root);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                progressBar.setProgress(0);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setProgress(100);
                progressBar.setVisibility(View.GONE);
                checkLocalMultithreadingSupport();
                installPgnExportBridge();
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    progressBar.setVisibility(View.GONE);
                    Toast.makeText(
                            MainActivity.this,
                            "Não foi possível carregar o Move by Move. Verifique sua conexão.",
                            Toast.LENGTH_LONG
                    ).show();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = callback;
                try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (ActivityNotFoundException ignored) {
                    fileChooserCallback = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "Não foi possível abrir o seletor de arquivos.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress >= 100) {
                    progressBar.setVisibility(View.GONE);
                } else {
                    progressBar.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            if (isWebUrl(uri)) {
                openExternal(uri);
            }
        });

        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            return;
        }
        webView.loadUrl(APP_URL);
    }

    private boolean handleNavigation(Uri uri) {
        if (isAppUrl(uri)) {
            return false;
        }

        if (isWebUrl(uri) || "mailto".equalsIgnoreCase(uri.getScheme())) {
            openExternal(uri);
        }
        return true;
    }

    private boolean isAppUrl(Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && APP_HOST.equalsIgnoreCase(uri.getHost());
    }

    private boolean isWebUrl(Uri uri) {
        if (uri == null || uri.getScheme() == null) {
            return false;
        }
        String scheme = uri.getScheme().toLowerCase();
        return "https".equals(scheme) || "http".equals(scheme);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, "Nenhum aplicativo consegue abrir este link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void installPgnExportBridge() {
        if (webView == null) {
            return;
        }
        String script = "(function(){"
                + "if(window.__moveByMoveNativePgnExport) return;"
                + "window.__moveByMoveNativePgnExport = true;"
                + "const create = URL.createObjectURL.bind(URL);"
                + "URL.createObjectURL = function(value){"
                + "const address = create(value);"
                + "if(value instanceof Blob && value.type === 'application/x-chess-pgn'){"
                + "value.text().then(text => window.MoveByMoveAndroid.savePgn('partida.pgn', text));"
                + "}"
                + "return address;"
                + "};"
                + "})();";
        webView.evaluateJavascript(script, null);
    }

    private void requestPgnExport(String fileName, String content) {
        if (pendingExportContent != null || content == null || content.length() > 5_000_000) {
            Toast.makeText(this, "O PGN está vazio, muito grande ou já está sendo salvo.", Toast.LENGTH_LONG).show();
            return;
        }

        pendingExportContent = content;
        String safeName = fileName == null ? "partida.pgn" : fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (safeName.isEmpty() || !safeName.toLowerCase(Locale.ROOT).endsWith(".pgn")) {
            safeName = "partida.pgn";
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TITLE, safeName);
        try {
            startActivityForResult(intent, CREATE_DOCUMENT_REQUEST_CODE);
        } catch (ActivityNotFoundException ignored) {
            pendingExportContent = null;
            Toast.makeText(this, "Não foi possível abrir o seletor para salvar o PGN.", Toast.LENGTH_LONG).show();
        }
    }

    private final class NativeFileBridge {
        @JavascriptInterface
        public void savePgn(String fileName, String content) {
            if (webView == null || content == null || !isAppUrl(Uri.parse(webView.getUrl()))) {
                return;
            }
            runOnUiThread(() -> requestPgnExport(fileName, content));
        }
    }

    private void checkLocalMultithreadingSupport() {
        if (threadingWarningShown || webView == null) {
            return;
        }
        webView.evaluateJavascript(
                "!!window.crossOriginIsolated && typeof window.SharedArrayBuffer !== 'undefined'",
                result -> {
                    if (!threadingWarningShown && "false".equals(result)) {
                        threadingWarningShown = true;
                        Toast.makeText(
                                MainActivity.this,
                                "O motor continua rodando no celular. Este WebView não habilitou múltiplas threads; atualize o Android System WebView para tentar ativá-las.",
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
            webView.saveState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @SuppressWarnings("deprecation")
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == CREATE_DOCUMENT_REQUEST_CODE) {
            String content = pendingExportContent;
            pendingExportContent = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && content != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (output == null) {
                        throw new IOException("Could not open selected document.");
                    }
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "PGN salvo com sucesso.", Toast.LENGTH_SHORT).show();
                } catch (IOException ignored) {
                    Toast.makeText(this, "Não foi possível salvar o arquivo PGN.", Toast.LENGTH_LONG).show();
                }
            }
            return;
        }
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileChooserCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        pendingExportContent = null;
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
