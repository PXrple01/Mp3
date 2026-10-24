package de.julipod.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import org.json.JSONObject;

/**
 * Hält die App wach, solange Musik läuft, und zeigt die Steuerung in der
 * Benachrichtigung und auf dem Sperrbildschirm.
 */
public class PlaybackService extends Service {
    static final String CHANNEL = "playback";
    static final int NOTIFICATION_ID = 42;
    static final long DETACH_AFTER_MS = 10 * 60 * 1000L;
    static volatile PlaybackService instance;
    private static final Handler main = new Handler(Looper.getMainLooper());

    private MediaSession session;
    private PowerManager.WakeLock wakeLock;
    private boolean receiverOn;
    private String title = "juliPod";
    private String artist = "";
    private boolean playing;
    private long posMs;
    private long durMs;
    private long trackId = -2;
    private Bitmap art;
    private Bitmap julian;

    private final Runnable detach = new Runnable() {
        @Override
        public void run() {
            if (!playing) stopFg(false);
        }
    };

    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            // Kopfhörer abgezogen: pausieren statt laut weiterspielen
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(i.getAction())) MainActivity.remote("pause", Double.NaN);
        }
    };

    /** Neuer Zustand aus JavaScript (kommt auf dem JavaBridge-Thread an). */
    static void update(final Context ctx, final String json) {
        main.post(new Runnable() {
            @Override
            public void run() {
                PlaybackService s = instance;
                if (s != null) {
                    s.apply(json);
                    return;
                }
                boolean nowPlaying = false;
                try {
                    nowPlaying = new JSONObject(json).optBoolean("playing");
                } catch (Exception ignored) {
                }
                if (!nowPlaying) return;
                Intent i = new Intent(ctx, PlaybackService.class).setAction("STATE").putExtra("json", json);
                try {
                    if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
                    else ctx.startService(i);
                } catch (Exception ignored) {
                }
            }
        });
    }

    static void shutdown() {
        PlaybackService s = instance;
        if (s != null) {
            s.stopFg(true);
            s.stopSelf();
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Musik", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Steuerung für den juliPod");
            ch.setShowBadge(false);
            nm().createNotificationChannel(ch);
        }
        julian = BitmapFactory.decodeResource(getResources(), R.drawable.julian_art);
        session = new MediaSession(this, "juliPod");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                MainActivity.remote("play", Double.NaN);
            }

            @Override
            public void onPause() {
                MainActivity.remote("pause", Double.NaN);
            }

            @Override
            public void onSkipToNext() {
                MainActivity.remote("next", Double.NaN);
            }

            @Override
            public void onSkipToPrevious() {
                MainActivity.remote("prev", Double.NaN);
            }

            @Override
            public void onStop() {
                MainActivity.remote("pause", Double.NaN);
            }

            @Override
            public void onSeekTo(long pos) {
                MainActivity.remote("seek", pos / 1000.0);
            }
        });
        session.setSessionActivity(openApp());
        session.setActive(true);
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "juliPod:playback");
        wakeLock.setReferenceCounted(false);
        IntentFilter f = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy, f);
        receiverOn = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startFg(); // muss sofort passieren, sonst beendet Android den Dienst
        if (MainActivity.current == null) {
            // Die App ist weg, ohne sie gibt es nichts abzuspielen.
            stopFg(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        String a = intent != null ? intent.getAction() : null;
        if ("STATE".equals(a)) apply(intent.getStringExtra("json"));
        else if ("PREV".equals(a)) MainActivity.remote("prev", Double.NaN);
        else if ("NEXT".equals(a)) MainActivity.remote("next", Double.NaN);
        else if ("TOGGLE".equals(a)) MainActivity.remote(playing ? "pause" : "play", Double.NaN);
        if (!playing) scheduleDetach();
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopFg(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        main.removeCallbacks(detach);
        if (receiverOn) {
            try {
                unregisterReceiver(noisy);
            } catch (Exception ignored) {
            }
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (session != null) session.release();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    private void apply(String json) {
        if (json == null) return;
        try {
            JSONObject o = new JSONObject(json);
            title = o.optString("title", "juliPod");
            artist = o.optString("artist", "");
            playing = o.optBoolean("playing");
            posMs = (long) (o.optDouble("pos", 0) * 1000);
            durMs = (long) (o.optDouble("dur", 0) * 1000);
            long id = o.optLong("id", -1);
            if (id != trackId) {
                trackId = id;
                loadArtAsync(id);
            }
        } catch (Exception e) {
            return;
        }
        updateSession();
        if (playing) {
            main.removeCallbacks(detach);
            if (!wakeLock.isHeld()) wakeLock.acquire(6 * 60 * 60 * 1000L);
            startFg();
        } else {
            if (wakeLock.isHeld()) wakeLock.release();
            notifyNow();
            scheduleDetach();
        }
    }

    private void loadArtAsync(final long id) {
        art = null;
        if (id < 0) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                final Bitmap b = MainActivity.loadArt(PlaybackService.this, id, 512);
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        if (trackId != id || instance == null) return;
                        art = b;
                        updateSession();
                        notifyNow();
                    }
                });
            }
        }).start();
    }

    private void updateSession() {
        MediaMetadata.Builder m = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, "juliPod")
                .putLong(MediaMetadata.METADATA_KEY_DURATION, durMs);
        Bitmap b = art != null ? art : julian;
        if (b != null) m.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, b);
        session.setMetadata(m.build());
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_STOP;
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(actions)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                        posMs, playing ? 1f : 0f, SystemClock.elapsedRealtime())
                .build());
    }

    private NotificationManager nm() {
        return (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    }

    private Notification build() {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL)
                : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(artist)
                .setLargeIcon(art != null ? art : julian)
                .setContentIntent(openApp())
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setOngoing(playing)
                .addAction(action(R.drawable.ic_prev, "Zurück", "PREV"))
                .addAction(playing
                        ? action(R.drawable.ic_pause, "Pause", "TOGGLE")
                        : action(R.drawable.ic_play, "Abspielen", "TOGGLE"))
                .addAction(action(R.drawable.ic_next, "Weiter", "NEXT"))
                .setStyle(new Notification.MediaStyle()
                        .setMediaSession(session.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2));
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_LOW);
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }

    private Notification.Action action(int icon, String label, String act) {
        Intent i = new Intent(this, PlaybackService.class).setAction(act);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = Build.VERSION.SDK_INT >= 26
                ? PendingIntent.getForegroundService(this, act.hashCode(), i, flags)
                : PendingIntent.getService(this, act.hashCode(), i, flags);
        return new Notification.Action.Builder(Icon.createWithResource(this, icon), label, pi).build();
    }

    private PendingIntent openApp() {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i == null) i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void startFg() {
        Notification n = build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTIFICATION_ID, n);
        } catch (Exception e) {
            // Aus dem Hintergrund darf Android den Dienst manchmal nicht nach vorne holen: dann nur anzeigen.
            notifyNow();
        }
    }

    private void notifyNow() {
        try {
            nm().notify(NOTIFICATION_ID, build());
        } catch (Exception ignored) {
        }
    }

    private void stopFg(boolean remove) {
        try {
            stopForeground(remove ? STOP_FOREGROUND_REMOVE : STOP_FOREGROUND_DETACH);
        } catch (Exception ignored) {
        }
        if (remove) {
            try {
                nm().cancel(NOTIFICATION_ID);
            } catch (Exception ignored) {
            }
        }
    }

    private void scheduleDetach() {
        main.removeCallbacks(detach);
        main.postDelayed(detach, DETACH_AFTER_MS);
    }
}
