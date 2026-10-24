package de.julipod.app;

import android.app.Activity;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Size;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Zeigt den juliPod in einer WebView. Die Seite liegt in den Assets und wird unter
 * https://localhost/ ausgeliefert, die Musik kommt aus dem Ordner "juliPod" auf dem Handy.
 */
public class MainActivity extends Activity {
    static final String HOST = "localhost";
    static final String START = "https://localhost/index.html";
    static final int REQ_PERMS = 7;
    static volatile MainActivity current;

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        current = this;
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;

        web = new WebView(this);
        web.setBackgroundColor(night ? Color.BLACK : Color.rgb(251, 251, 253));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);

        web.addJavascriptInterface(new Bridge(), "JuliPodNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                try {
                    return serve(u.getPath(), req.getRequestHeaders());
                } catch (Exception e) {
                    return status(404, "Not Found");
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        web.loadUrl(START);
        askPermissions(false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            js("window.juliPodNative && window.juliPodNative.onLibraryChanged('resume')");
        }
    }

    // Kein web.onPause(): Die Musik soll weiterlaufen, wenn das Handy gesperrt ist.

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        PlaybackService.shutdown();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    void js(final String code) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(code, null);
            }
        });
    }

    /** Befehle aus der Benachrichtigung, vom Sperrbildschirm oder von Kopfhörern. */
    static boolean remote(String cmd, double arg) {
        MainActivity a = current;
        if (a == null) return false;
        a.js("window.juliPodNative && window.juliPodNative.remote('" + cmd + "'"
                + (Double.isNaN(arg) ? "" : ", " + arg) + ")");
        return true;
    }

    /* ───────── Berechtigungen ───────── */

    private static String audioPermission() {
        return Build.VERSION.SDK_INT >= 33
                ? "android.permission.READ_MEDIA_AUDIO"
                : "android.permission.READ_EXTERNAL_STORAGE";
    }

    boolean hasAudio() {
        return checkSelfPermission(audioPermission()) == PackageManager.PERMISSION_GRANTED;
    }

    void askPermissions(boolean fromUser) {
        List<String> need = new ArrayList<>();
        if (!hasAudio()) need.add(audioPermission());
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            need.add("android.permission.POST_NOTIFICATIONS");
        }
        if (need.isEmpty()) return;
        SharedPreferences prefs = getSharedPreferences("julipod", MODE_PRIVATE);
        if (fromUser && prefs.getBoolean("asked", false) && !hasAudio()
                && !shouldShowRequestPermissionRationale(audioPermission())) {
            // Dauerhaft abgelehnt: dann hilft nur noch die Einstellungs-Seite der App.
            try {
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", getPackageName(), null)));
            } catch (Exception ignored) {
            }
            return;
        }
        prefs.edit().putBoolean("asked", true).apply();
        requestPermissions(need.toArray(new String[0]), REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        js("window.juliPodNative && window.juliPodNative.onLibraryChanged('permission')");
    }

    /* ───────── Dateien ausliefern ───────── */

    private WebResourceResponse serve(String path, Map<String, String> headers) throws IOException {
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.startsWith("/media/")) return media(Long.parseLong(path.substring(7)), headers);
        if (path.startsWith("/cover/")) return cover(Long.parseLong(path.substring(7)));
        if (path.contains("..")) return status(404, "Not Found");
        InputStream in;
        try {
            in = getAssets().open("web" + path);
        } catch (IOException e) {
            return status(404, "Not Found");
        }
        String mime = mime(path);
        boolean text = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
        WebResourceResponse r = new WebResourceResponse(mime, text ? "utf-8" : null, in);
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-cache");
        r.setResponseHeaders(h);
        return r;
    }

    private static String mime(String p) {
        String l = p.toLowerCase(Locale.ROOT);
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static WebResourceResponse status(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason,
                new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private static String header(Map<String, String> h, String name) {
        if (h == null) return null;
        for (Map.Entry<String, String> e : h.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(name)) return e.getValue();
        }
        return null;
    }

    /** Liefert ein Lied, mit Range-Anfragen, damit Spulen funktioniert. */
    private WebResourceResponse media(long id, Map<String, String> headers) throws IOException {
        Uri uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
        ParcelFileDescriptor pfd = getContentResolver().openFileDescriptor(uri, "r");
        if (pfd == null) return status(404, "Not Found");
        long total = pfd.getStatSize();
        FileInputStream in = new ParcelFileDescriptor.AutoCloseInputStream(pfd);
        String type = getContentResolver().getType(uri);
        if (type == null) type = "audio/mpeg";
        Map<String, String> h = new HashMap<>();
        h.put("Accept-Ranges", "bytes");
        h.put("Cache-Control", "no-cache");
        String range = header(headers, "Range");
        if (range != null && range.startsWith("bytes=") && total > 0) {
            String spec = range.substring(6).split(",")[0].trim();
            int dash = spec.indexOf('-');
            long start;
            long end;
            try {
                if (dash == 0) {
                    start = Math.max(0, total - Long.parseLong(spec.substring(1)));
                    end = total - 1;
                } else {
                    start = Long.parseLong(spec.substring(0, dash));
                    String e = spec.substring(dash + 1);
                    end = e.isEmpty() ? total - 1 : Math.min(Long.parseLong(e), total - 1);
                }
            } catch (RuntimeException ex) {
                start = 0;
                end = total - 1;
            }
            if (start > end || start >= total) {
                in.close();
                h.put("Content-Range", "bytes */" + total);
                return new WebResourceResponse(type, null, 416, "Range Not Satisfiable", h,
                        new ByteArrayInputStream(new byte[0]));
            }
            in.getChannel().position(start);
            long len = end - start + 1;
            h.put("Content-Range", "bytes " + start + "-" + end + "/" + total);
            h.put("Content-Length", String.valueOf(len));
            return new WebResourceResponse(type, null, 206, "Partial Content", h, new Limited(in, len));
        }
        if (total > 0) h.put("Content-Length", String.valueOf(total));
        return new WebResourceResponse(type, null, 200, "OK", h, in);
    }

    private WebResourceResponse cover(long id) {
        Bitmap bmp = loadArt(this, id, 320);
        if (bmp == null) return status(404, "Not Found");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 86, out);
        WebResourceResponse r = new WebResourceResponse("image/jpeg", null, new ByteArrayInputStream(out.toByteArray()));
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "max-age=86400");
        r.setResponseHeaders(h);
        return r;
    }

    /** Cover eines Liedes, oder null, wenn es keins hat. */
    static Bitmap loadArt(Context ctx, long id, int size) {
        if (id < 0) return null;
        Uri uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                return ctx.getContentResolver().loadThumbnail(uri, new Size(size, size), null);
            } catch (Exception e) {
                return null;
            }
        }
        long albumId = -1;
        Cursor c = null;
        try {
            c = ctx.getContentResolver().query(uri, new String[]{MediaStore.Audio.Media.ALBUM_ID}, null, null, null);
            if (c != null && c.moveToFirst()) albumId = c.getLong(0);
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        if (albumId < 0) return null;
        Uri art = ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId);
        InputStream in = null;
        try {
            in = ctx.getContentResolver().openInputStream(art);
            return in == null ? null : BitmapFactory.decodeStream(in);
        } catch (Exception e) {
            return null;
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    static final class Limited extends FilterInputStream {
        private long left;

        Limited(InputStream in, long n) {
            super(in);
            left = n;
        }

        @Override
        public int read() throws IOException {
            if (left <= 0) return -1;
            int b = super.read();
            if (b >= 0) left--;
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int n = super.read(b, off, (int) Math.min(len, left));
            if (n > 0) left -= n;
            return n;
        }

        @Override
        public long skip(long n) throws IOException {
            long k = super.skip(Math.min(n, left));
            left -= k;
            return k;
        }

        @Override
        public int available() throws IOException {
            return (int) Math.min(super.available(), left);
        }
    }

    /* ───────── Musik auf dem Handy finden ───────── */

    String library(String folder) {
        try {
            JSONObject res = new JSONObject();
            if (!hasAudio()) {
                res.put("needPermission", true);
                res.put("tracks", new JSONArray());
                return res.toString();
            }
            List<JSONObject> list = query(folder);
            if (list.isEmpty()) list = query(null);
            JSONArray arr = new JSONArray();
            for (JSONObject o : list) arr.put(o);
            res.put("tracks", arr);
            return res.toString();
        } catch (Exception e) {
            return "{\"tracks\":[]}";
        }
    }

    /** Alle Lieder im Ordner (oder, wenn folder null ist, alle Musik auf dem Handy). */
    private List<JSONObject> query(String folder) throws Exception {
        boolean q = Build.VERSION.SDK_INT >= 29;
        List<String> proj = new ArrayList<>();
        Collections.addAll(proj, MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM, MediaStore.Audio.Media.DURATION, MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.DATA);
        if (q) proj.add("relative_path");
        String sel;
        String[] args;
        if (folder != null) {
            if (q) {
                sel = "relative_path LIKE ?";
                args = new String[]{"%" + folder + "/%"};
            } else {
                sel = MediaStore.Audio.Media.DATA + " LIKE ?";
                args = new String[]{"%/" + folder + "/%"};
            }
        } else {
            sel = MediaStore.Audio.Media.IS_MUSIC + " != 0";
            args = null;
        }
        final List<JSONObject> out = new ArrayList<>();
        final Map<JSONObject, String> sortKey = new HashMap<>();
        Cursor c = getContentResolver().query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                proj.toArray(new String[0]), sel, args, null);
        if (c == null) return out;
        try {
            int iId = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int iTitle = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
            int iArtist = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
            int iAlbum = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
            int iDur = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
            int iName = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
            int iPath = q ? c.getColumnIndexOrThrow("relative_path") : c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
            while (c.moveToNext()) {
                long id = c.getLong(iId);
                String name = c.getString(iName);
                String title = c.getString(iTitle);
                String artist = c.getString(iArtist);
                String album = c.getString(iAlbum);
                String path = c.getString(iPath);
                if (artist == null || artist.startsWith("<unknown")) artist = "";
                if (album == null || album.startsWith("<unknown")) album = "";
                if (title == null || title.trim().isEmpty()) {
                    title = name != null ? name.replaceAll("\\.[^.]+$", "") : "Unbekanntes Lied";
                }
                JSONObject o = new JSONObject();
                o.put("id", id);
                o.put("title", title);
                o.put("artist", artist);
                o.put("album", album);
                o.put("duration", c.getLong(iDur) / 1000.0);
                o.put("url", "/media/" + id);
                o.put("cover", "/cover/" + id);
                out.add(o);
                sortKey.put(o, ((path == null ? "" : path) + "/" + (name == null ? title : name)).toLowerCase(Locale.ROOT));
            }
        } finally {
            c.close();
        }
        Collections.sort(out, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                return sortKey.get(a).compareTo(sortKey.get(b));
            }
        });
        return out;
    }

    /** Wird aus JavaScript als window.JuliPodNative aufgerufen. */
    final class Bridge {
        @JavascriptInterface
        public String library(String folder) {
            String f = folder == null || folder.trim().isEmpty() ? "juliPod" : folder.trim();
            return MainActivity.this.library(f);
        }

        @JavascriptInterface
        public void requestPermission() {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    askPermissions(true);
                }
            });
        }

        @JavascriptInterface
        public void state(String json) {
            PlaybackService.update(MainActivity.this, json);
        }
    }
}
