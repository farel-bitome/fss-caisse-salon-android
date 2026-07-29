package com.fallservices.fsscaissesalon;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView mainWebView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mainWebView = new WebView(this);
        mainWebView.getSettings().setJavaScriptEnabled(true);
        mainWebView.getSettings().setDomStorageEnabled(true); // nécessaire pour localStorage
        mainWebView.setWebViewClient(new WebViewClient());
        mainWebView.addJavascriptInterface(new PrintBridge(this), "AndroidPrint");
        mainWebView.loadUrl("file:///android_asset/index.html");

        setContentView(mainWebView);
    }

    @Override
    public void onBackPressed() {
        if (mainWebView.canGoBack()) {
            mainWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /**
     * Pont JavaScript <-> Android pour imprimer un ticket via le système
     * d'impression natif d'Android (compatible avec la plupart des
     * imprimantes Bluetooth/USB via leur application constructeur, ou
     * export PDF si aucune imprimante n'est configurée).
     */
    public static class PrintBridge {
        private final Activity activity;

        PrintBridge(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void printHtml(final String html) {
            activity.runOnUiThread(() -> {
                WebView printWebView = new WebView(activity);
                printWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);

                        // Format suggéré : rouleau ~58mm de large (1 mil = 1/1000 pouce ; 58mm ≈ 2283 mils),
                        // hauteur généreuse pour un rouleau continu. L'imprimante/son pilote peut
                        // proposer d'autres tailles si elle ne supporte pas ce format précis.
                        PrintAttributes.MediaSize ticket58mm = new PrintAttributes.MediaSize(
                            "fss_ticket_58mm", "Ticket 58mm", 2283, 12000
                        );
                        PrintAttributes attributes = new PrintAttributes.Builder()
                            .setMediaSize(ticket58mm)
                            .setResolution(new PrintAttributes.Resolution("fss_res", "FSS", 203, 203))
                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            .build();

                        android.print.PrintDocumentAdapter adapter = view.createPrintDocumentAdapter("Ticket FSS-CAISSE-SALON");
                        printManager.print("Ticket FSS-CAISSE-SALON", adapter, attributes);
                    }
                });
                printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            });
        }
    }
}
