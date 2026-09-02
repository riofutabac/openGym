package ch.duartesantos.opengym;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.DecimalFormat;
import java.util.Locale;

@CapacitorPlugin(name = "WorkoutNotification")
public class WorkoutNotificationPlugin extends Plugin {
    public static final String CHANNEL_ID = "opengym_workout_active";
    public static final int NOTIFICATION_ID = 1001;

    public static class State {
        public String exerciseName = "Entrenamiento";
        public int setIndex = 1;
        public int totalSets = 1;
        public int reps = 10;
        public double weight = 0.0;
        public String weightUnit = "kg";
        public boolean isResting = false;
        public long restUntil = 0;
        public String nextExName = null;
        public boolean isBw = false;
        public boolean isCardio = false;
    }

    private static WorkoutNotificationPlugin instance = null;
    private static State currentState = null;

    @Override
    public void load() {
        super.load();
        instance = this;
        createNotificationChannel(getContext());
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Entrenamiento activo",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Controles interactivos y estado del entrenamiento en curso");
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        try {
            State s = new State();
            s.exerciseName = call.getString("exerciseName", "Entrenamiento");
            s.setIndex = call.getInt("setIndex", 1);
            s.totalSets = call.getInt("totalSets", 1);
            s.reps = call.getInt("reps", 10);
            Double w = call.getDouble("weight");
            s.weight = (w != null) ? w : 0.0;
            s.weightUnit = call.getString("weightUnit", "kg");
            s.isResting = Boolean.TRUE.equals(call.getBoolean("isResting", false));
            Long ru = call.getLong("restUntil");
            s.restUntil = (ru != null) ? ru : 0L;
            s.nextExName = call.getString("nextExName", null);
            s.isBw = Boolean.TRUE.equals(call.getBoolean("isBw", false));
            s.isCardio = Boolean.TRUE.equals(call.getBoolean("isCardio", false));

            currentState = s;
            renderNotification(getContext(), s);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            currentState = null;
            NotificationManagerCompat nm = NotificationManagerCompat.from(getContext());
            nm.cancel(NOTIFICATION_ID);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear notification: " + e.getMessage());
        }
    }

    public static void handleBroadcastAction(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        JSObject eventData = new JSObject();

        if (WorkoutNotificationReceiver.ACTION_STEP_REPS.equals(action)) {
            int delta = intent.getIntExtra("delta", 0);
            if (currentState != null) {
                currentState.reps = Math.max(0, currentState.reps + delta);
                renderNotification(context, currentState);
            }
            eventData.put("action", "stepReps");
            eventData.put("delta", delta);
            if (currentState != null) eventData.put("reps", currentState.reps);

        } else if (WorkoutNotificationReceiver.ACTION_STEP_WEIGHT.equals(action)) {
            double delta = intent.getDoubleExtra("delta", 0.0);
            if (currentState != null) {
                double newW = Math.max(0.0, currentState.weight + delta);
                currentState.weight = Math.round(newW * 100.0) / 100.0;
                renderNotification(context, currentState);
            }
            eventData.put("action", "stepWeight");
            eventData.put("delta", delta);
            if (currentState != null) eventData.put("weight", currentState.weight);

        } else if (WorkoutNotificationReceiver.ACTION_COMPLETE_SET.equals(action)) {
            eventData.put("action", "completeSet");

        } else if (WorkoutNotificationReceiver.ACTION_SKIP_REST.equals(action)) {
            eventData.put("action", "skipRest");

        } else if (WorkoutNotificationReceiver.ACTION_ADD_REST_30.equals(action)) {
            if (currentState != null && currentState.isResting) {
                currentState.restUntil = Math.max(System.currentTimeMillis(), currentState.restUntil) + 30000L;
                renderNotification(context, currentState);
            }
            eventData.put("action", "addRest30");
        }

        if (instance != null) {
            instance.notifyListeners("notificationAction", eventData);
        }
    }

    private static String capitalizeWords(String text) {
        if (text == null || text.trim().isEmpty()) return "";
        String[] words = text.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            if (words[i].length() > 0) {
                sb.append(Character.toUpperCase(words[i].charAt(0)));
                if (words[i].length() > 1) {
                    sb.append(words[i].substring(1));
                }
                if (i < words.length - 1) sb.append(" ");
            }
        }
        return sb.toString();
    }

    public static void renderNotification(Context context, State s) {
        if (s == null) return;
        createNotificationChannel(context);

        String pkg = context.getPackageName();
        DecimalFormat df = new DecimalFormat("#.##");
        String formattedName = capitalizeWords(s.exerciseName);
        long now = System.currentTimeMillis();
        long elapsedRealtimeNow = SystemClock.elapsedRealtime();

        // Small view
        RemoteViews smallViews = new RemoteViews(pkg, R.layout.notification_workout_small);
        String smallTitle = formattedName + " · Serie " + s.setIndex + "/" + s.totalSets;
        smallViews.setTextViewText(R.id.notif_small_title, smallTitle);

        if (s.isResting) {
            smallViews.setImageViewResource(R.id.notif_small_action, R.drawable.ic_notif_skip);
            smallViews.setOnClickPendingIntent(R.id.notif_small_action, createPendingAction(context, WorkoutNotificationReceiver.ACTION_SKIP_REST, 0));

            if (s.restUntil > now) {
                long millisRemaining = s.restUntil - now;
                long baseTime = elapsedRealtimeNow + millisRemaining;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    smallViews.setChronometerCountDown(R.id.notif_small_chronometer, true);
                }
                smallViews.setChronometer(R.id.notif_small_chronometer, baseTime, null, true);
                smallViews.setViewVisibility(R.id.notif_small_chronometer, View.VISIBLE);

                String restSub = (s.nextExName != null && !s.nextExName.isEmpty())
                    ? (" · Sig: " + capitalizeWords(s.nextExName))
                    : " · Descanso";
                smallViews.setTextViewText(R.id.notif_small_subtitle, restSub);
            } else {
                smallViews.setViewVisibility(R.id.notif_small_chronometer, View.GONE);
                smallViews.setTextViewText(R.id.notif_small_subtitle, "Descanso completado");
            }
        } else {
            smallViews.setViewVisibility(R.id.notif_small_chronometer, View.GONE);
            String sub = (s.weight > 0 ? (df.format(s.weight) + " " + s.weightUnit + " · ") : "") + s.reps + " reps";
            smallViews.setTextViewText(R.id.notif_small_subtitle, sub);
            smallViews.setImageViewResource(R.id.notif_small_action, R.drawable.ic_notif_check);
            smallViews.setOnClickPendingIntent(R.id.notif_small_action, createPendingAction(context, WorkoutNotificationReceiver.ACTION_COMPLETE_SET, 0));
        }

        // Expanded view
        RemoteViews bigViews = new RemoteViews(pkg, R.layout.notification_workout);

        if (s.isResting) {
            bigViews.setViewVisibility(R.id.notif_working_container, View.GONE);
            bigViews.setViewVisibility(R.id.notif_resting_container, View.VISIBLE);

            String restHeader = (s.nextExName != null && !s.nextExName.isEmpty())
                ? ("Siguiente: " + capitalizeWords(s.nextExName))
                : formattedName;
            bigViews.setTextViewText(R.id.notif_title, restHeader);
            bigViews.setTextViewText(R.id.notif_set_badge, "Descanso");

            if (s.restUntil > now) {
                long millisRemaining = s.restUntil - now;
                long baseTime = elapsedRealtimeNow + millisRemaining;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    bigViews.setChronometerCountDown(R.id.notif_chronometer, true);
                }
                bigViews.setChronometer(R.id.notif_chronometer, baseTime, null, true);
                bigViews.setViewVisibility(R.id.notif_chronometer, View.VISIBLE);

                String restSub = (s.nextExName != null && !s.nextExName.isEmpty())
                    ? ("Serie " + s.setIndex + " de " + s.totalSets + " · Próximo ejercicio")
                    : ("Serie " + s.setIndex + " de " + s.totalSets);
                bigViews.setTextViewText(R.id.notif_tv_rest_subtitle, restSub);
            } else {
                bigViews.setViewVisibility(R.id.notif_chronometer, View.GONE);
                bigViews.setTextViewText(R.id.notif_tv_rest_subtitle, "Tiempo de descanso cumplido");
            }

            bigViews.setOnClickPendingIntent(R.id.notif_btn_add_time, createPendingAction(context, WorkoutNotificationReceiver.ACTION_ADD_REST_30, 0));
            bigViews.setOnClickPendingIntent(R.id.notif_btn_skip_rest, createPendingAction(context, WorkoutNotificationReceiver.ACTION_SKIP_REST, 0));

        } else {
            bigViews.setViewVisibility(R.id.notif_working_container, View.VISIBLE);
            bigViews.setViewVisibility(R.id.notif_resting_container, View.GONE);

            bigViews.setTextViewText(R.id.notif_title, formattedName);
            bigViews.setTextViewText(R.id.notif_set_badge, "Serie " + s.setIndex + " de " + s.totalSets);

            // Reps Stepper
            bigViews.setTextViewText(R.id.notif_tv_reps, String.valueOf(s.reps));
            bigViews.setOnClickPendingIntent(R.id.notif_btn_reps_minus, createPendingStepperAction(context, WorkoutNotificationReceiver.ACTION_STEP_REPS, -1, 0, 1));
            bigViews.setOnClickPendingIntent(R.id.notif_btn_reps_plus, createPendingStepperAction(context, WorkoutNotificationReceiver.ACTION_STEP_REPS, +1, 0, 2));

            // Weight Stepper
            if (s.isBw && s.weight <= 0) {
                bigViews.setViewVisibility(R.id.notif_card_weight, View.GONE);
            } else {
                bigViews.setViewVisibility(R.id.notif_card_weight, View.VISIBLE);
                bigViews.setTextViewText(R.id.notif_lbl_weight, "PESO (" + s.weightUnit.toUpperCase(Locale.ROOT) + ")");
                bigViews.setTextViewText(R.id.notif_tv_weight, df.format(s.weight));
                bigViews.setOnClickPendingIntent(R.id.notif_btn_weight_minus, createPendingStepperAction(context, WorkoutNotificationReceiver.ACTION_STEP_WEIGHT, 0, -2.5, 3));
                bigViews.setOnClickPendingIntent(R.id.notif_btn_weight_plus, createPendingStepperAction(context, WorkoutNotificationReceiver.ACTION_STEP_WEIGHT, 0, +2.5, 4));
            }

            bigViews.setTextViewText(R.id.notif_btn_complete_set, "Completar Serie " + s.setIndex);
            bigViews.setOnClickPendingIntent(R.id.notif_btn_complete_set, createPendingAction(context, WorkoutNotificationReceiver.ACTION_COMPLETE_SET, 0));
        }

        // Tap on notification body opens main activity
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(pkg);
        PendingIntent contentIntent = null;
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            contentIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_workout)
            .setCustomContentView(smallViews)
            .setCustomBigContentView(bigViews)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false);

        if (contentIntent != null) {
            builder.setContentIntent(contentIntent);
        }

        try {
            NotificationManagerCompat nm = NotificationManagerCompat.from(context);
            nm.notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // Permission not yet granted
        }
    }

    private static PendingIntent createPendingAction(Context context, String action, int reqCode) {
        Intent intent = new Intent(context, WorkoutNotificationReceiver.class);
        intent.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, reqCode, intent, flags);
    }

    private static PendingIntent createPendingStepperAction(Context context, String action, int deltaReps, double deltaWeight, int reqCode) {
        Intent intent = new Intent(context, WorkoutNotificationReceiver.class);
        intent.setAction(action);
        if (deltaReps != 0) intent.putExtra("delta", deltaReps);
        if (deltaWeight != 0.0) intent.putExtra("delta", deltaWeight);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        return PendingIntent.getBroadcast(context, reqCode, intent, flags);
    }
}
