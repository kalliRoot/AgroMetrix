package com.agrometrix.radar;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "AgroMetrix";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissions(new String[]{
                        Manifest.permission.POST_NOTIFICATIONS,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.ACCESS_FINE_LOCATION
                }, 101);
            } else {
                requestPermissions(new String[]{
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.ACCESS_FINE_LOCATION
                }, 101);
            }
        }

        initFirebaseMessaging();
        setupNativeFeatures();
    }

    private void initFirebaseMessaging() {
        try {
            FirebaseMessaging.getInstance().subscribeToTopic("global")
                    .addOnCompleteListener(task -> {
                        if (task.isSuccessful()) Log.d(TAG, "FCM: Conectado ao canal global");
                    });
        } catch (Exception e) {
            Log.e(TAG, "Erro Firebase: " + e.getMessage());
        }
    }

    private void setupNativeFeatures() {
        final WebView webView = getBridge().getWebView();
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // USER-AGENT "MÁXIMA COMPATIBILIDADE": Versão estável do Chrome no Android
        settings.setUserAgentString("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
            cookieManager.flush();
        }

        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSaveFormData(true);

        // Suporte a janelas para o fluxo de login (Priority 1: Inside WebView)
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // WebChromeClient para gerenciar Popups de Login internamente
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                WebView popupWebView = new WebView(MainActivity.this);
                setupPopupSettings(popupWebView);

                ViewGroup container = (ViewGroup) webView.getParent();
                container.addView(popupWebView);

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        webView.addJavascriptInterface(new NativeBridge(), "NativeBridge");
    }

    private void setupPopupSettings(WebView popupView) {
        WebSettings s = popupView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // User-Agent idêntico para evitar bloqueio do Google no popup
        s.setUserAgentString("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");

        popupView.setWebViewClient(new WebViewClient());
        popupView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onCloseWindow(WebView window) {
                ViewGroup container = (ViewGroup) window.getParent();
                if (container != null) {
                    container.removeView(window);
                }
            }
        });
    }

    private class NativeBridge {
        @JavascriptInterface
        @SuppressWarnings("unused")
        public void downloadBlob(String base64Data, String fileName, String mimeType, String cityName) {
            processFileSave(base64Data, mimeType, fileName, cityName);
        }

        @JavascriptInterface
        @SuppressWarnings("unused")
        @SuppressLint("NewApi")
        public void vibrate(int duration) {
            try {
                Vibrator vibrator;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    vibrator = (vm != null) ? vm.getDefaultVibrator() : null;
                } else {
                    vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                }

                if (vibrator != null && vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        vibrator.vibrate(duration);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Erro ao vibrar: " + e.getMessage());
            }
        }
    }

    private void processFileSave(String base64Data, String mimeType, String fileName, String cityName) {
        try {
            String base64 = base64Data.contains(",") ? base64Data.split(",")[1] : base64Data;
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            String finalName = (fileName == null || fileName.isEmpty()) ?
                    "agrometrix_" + System.currentTimeMillis() + (mimeType.contains("csv") ? ".csv" : ".txt") : fileName;

            Uri fileUri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, finalName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                fileUri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (fileUri != null) {
                    try (OutputStream os = getContentResolver().openOutputStream(fileUri)) {
                        if (os != null) os.write(bytes);
                    }
                }
            } else {
                File path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File legacyFile = new File(path, finalName);
                try (FileOutputStream fos = new FileOutputStream(legacyFile)) {
                    fos.write(bytes);
                }
                MediaScannerConnection.scanFile(this, new String[]{legacyFile.getAbsolutePath()}, null, null);
                fileUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", legacyFile);
            }

            final Uri finalUri = fileUri;
            final String city = (cityName != null && !cityName.isEmpty()) ? cityName : "sua localização";
            runOnUiThread(() -> {
                new AlertDialog.Builder(this)
                        .setTitle("Download Concluído")
                        .setMessage("Baixou o relatório atual (" + city + "). Deseja abrir o arquivo agora?")
                        .setPositiveButton("Abrir Agora", (dialog, which) -> openFile(finalUri, mimeType))
                        .setNegativeButton("Abrir Depois", null)
                        .show();
            });
        } catch (Exception e) {
            Log.e(TAG, "Erro no download: " + e.getMessage());
            runOnUiThread(() -> Toast.makeText(this, "Erro ao baixar arquivo", Toast.LENGTH_SHORT).show());
        }
    }

    private void openFile(Uri uri, String mimeType) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao abrir arquivo: " + e.getMessage());
            Toast.makeText(this, "Nenhum aplicativo encontrado para abrir este arquivo", Toast.LENGTH_LONG).show();
        }
    }
}
