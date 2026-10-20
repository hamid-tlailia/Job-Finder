package qa.jobfinder.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.File;

/**
 * Opens an application page (LinkedIn, Workable, a company careers site...) inside the app. When the page asks
 * for a file, the prepared CV is offered first, so attaching it is one tap; the cover letter can be copied from
 * the top bar. The person still reviews the form and presses submit themselves.
 */
public class ApplyWebActivity extends Activity {
    private static final int PICK_OTHER = 41;
    private WebView web;
    private ValueCallback<Uri[]> pending;
    private File cv;
    private String letter;
    private boolean ar;

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private TextView pill(String text, int bg, int fg) {
        TextView b = new TextView(this);
        b.setText(text);
        b.setTextColor(fg);
        b.setTextSize(13);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(14), dp(8), dp(14), dp(8));
        android.graphics.drawable.GradientDrawable d = new android.graphics.drawable.GradientDrawable();
        d.setColor(bg);
        d.setCornerRadius(dp(18));
        b.setBackground(d);
        return b;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Intent in = getIntent();
        String url = in.getStringExtra("url");
        String path = in.getStringExtra("cvPath");
        letter = in.getStringExtra("letter");
        ar = "ar".equals(in.getStringExtra("lang"));
        cv = path != null ? new File(path) : null;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0d0a0c"));
        root.setFitsSystemWindows(true);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(10), dp(8), dp(10), dp(8));
        bar.setBackgroundColor(Color.parseColor("#17121a"));
        bar.setLayoutDirection(ar ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);

        TextView close = pill("✕", Color.parseColor("#2a2230"), Color.WHITE);
        close.setOnClickListener(v -> finish());
        bar.addView(close);

        TextView hint = new TextView(this);
        hint.setText(ar ? "سيرتك جاهزة للإرفاق" : "Your CV is ready to attach");
        hint.setTextColor(Color.parseColor("#c9bfd0"));
        hint.setTextSize(12.5f);
        hint.setPadding(dp(10), 0, dp(10), 0);
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        bar.addView(hint, hp);

        if (letter != null && !letter.isEmpty()) {
            TextView copy = pill(ar ? "نسخ الخطاب" : "Copy letter", Color.parseColor("#d9b26f"), Color.parseColor("#2a1a10"));
            copy.setOnClickListener(v -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("cover letter", letter));
                Toast.makeText(this, ar ? "نُسخ الخطاب — الصقه في خانة الرسالة" : "Letter copied — paste it into the message field", Toast.LENGTH_SHORT).show();
            });
            bar.addView(copy);
        }
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        FrameLayout frame = new FrameLayout(this);
        web = new WebView(this);
        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        frame.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        frame.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));
        root.addView(frame, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        // Sites such as LinkedIn treat embedded browsers differently; present as the regular mobile browser.
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest req) {
                String scheme = req.getUrl().getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl()));
                } catch (Exception ignored) {
                    // no app for this link
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pending != null) pending.onReceiveValue(null);
                pending = callback;
                if (cv == null || !cv.exists()) return pickOther(params);
                String[] options = ar ? new String[] { "إرفاق سيرتي: " + cv.getName(), "اختيار ملف آخر" } : new String[] { "Attach my CV: " + cv.getName(), "Choose another file" };
                new AlertDialog.Builder(ApplyWebActivity.this)
                    .setTitle(ar ? "إرفاق ملف" : "Attach a file")
                    .setItems(options, (d, which) -> {
                        if (which == 0) {
                            pending.onReceiveValue(new Uri[] { Uri.fromFile(cv) });
                            pending = null;
                            Toast.makeText(ApplyWebActivity.this, ar ? "أُرفقت سيرتك ✓" : "CV attached ✓", Toast.LENGTH_SHORT).show();
                        } else {
                            pickOther(params);
                        }
                    })
                    .setOnCancelListener(d -> {
                        if (pending != null) pending.onReceiveValue(null);
                        pending = null;
                    })
                    .show();
                return true;
            }
        });
        if (url != null) web.loadUrl(url);
    }

    private boolean pickOther(WebChromeClient.FileChooserParams params) {
        try {
            startActivityForResult(params.createIntent(), PICK_OTHER);
            return true;
        } catch (Exception e) {
            if (pending != null) pending.onReceiveValue(null);
            pending = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_OTHER && pending != null) {
            pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            pending = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
