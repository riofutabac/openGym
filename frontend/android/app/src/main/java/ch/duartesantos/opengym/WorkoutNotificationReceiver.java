package ch.duartesantos.opengym;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class WorkoutNotificationReceiver extends BroadcastReceiver {
    public static final String ACTION_STEP_REPS = "ch.duartesantos.opengym.ACTION_STEP_REPS";
    public static final String ACTION_STEP_WEIGHT = "ch.duartesantos.opengym.ACTION_STEP_WEIGHT";
    public static final String ACTION_COMPLETE_SET = "ch.duartesantos.opengym.ACTION_COMPLETE_SET";
    public static final String ACTION_SKIP_REST = "ch.duartesantos.opengym.ACTION_SKIP_REST";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        WorkoutNotificationPlugin.handleBroadcastAction(context, intent);
    }
}
