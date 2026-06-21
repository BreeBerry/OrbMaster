package com.breezybee.orbmaster;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;

import com.google.android.gms.common.images.ImageManager;

import java.io.ByteArrayOutputStream;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayersClient;
import com.google.android.gms.games.Player;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadata;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;

import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "PlayGamesServices")
public class PlayGamesPlugin extends Plugin {

    private static final String TAG = "PlayGamesPlugin";

    /**
     * Sign in to Play Games Services.
     * With Play Games Services v2 + initialize(), sign-in is automatic.
     * This method checks current sign-in status and triggers sign-in if needed.
     */
    @PluginMethod()
    public void signIn(PluginCall call) {
        GamesSignInClient signInClient = PlayGames.getGamesSignInClient(getActivity());
        signInClient.isAuthenticated().addOnCompleteListener(task -> {
            boolean isAuthenticated = task.isSuccessful() && task.getResult().isAuthenticated();
            if (isAuthenticated) {
                // Already signed in, get player info
                getPlayerInfo(call);
            } else {
                // Try to sign in
                signInClient.signIn().addOnCompleteListener(signInTask -> {
                    if (signInTask.isSuccessful()) {
                        getPlayerInfo(call);
                    } else {
                        JSObject result = new JSObject();
                        result.put("isSignedIn", false);
                        result.put("error", "Sign-in failed");
                        call.resolve(result);
                    }
                });
            }
        });
    }

    /**
     * Check if the player is currently signed in.
     */
    @PluginMethod()
    public void isSignedIn(PluginCall call) {
        GamesSignInClient signInClient = PlayGames.getGamesSignInClient(getActivity());
        signInClient.isAuthenticated().addOnCompleteListener(task -> {
            JSObject result = new JSObject();
            boolean isAuth = task.isSuccessful() && task.getResult().isAuthenticated();
            result.put("isSignedIn", isAuth);
            call.resolve(result);
        });
    }

    /**
     * Get current player info (ID, display name, avatar).
     */
    @PluginMethod()
    public void getPlayer(PluginCall call) {
        getPlayerInfo(call);
    }

    /**
     * Show the Play Games friends picker UI (lets user add friends).
     */
    @PluginMethod()
    public void showFriendsPicker(PluginCall call) {
        PlayersClient playersClient = PlayGames.getPlayersClient(getActivity());
        playersClient.getCurrentPlayer().addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                playersClient.getCompareProfileIntent(task.getResult()).addOnSuccessListener(intent -> {
                    getActivity().startActivity(intent);
                    JSObject result = new JSObject();
                    result.put("success", true);
                    call.resolve(result);
                }).addOnFailureListener(e -> {
                    call.reject("Failed to show friends picker: " + e.getMessage());
                });
            } else {
                call.reject("Failed to get current player info for friends picker fallback");
            }
        });
    }

    /**
     * Load the player's friends list.
     */
    /** Max number of friend avatars converted to data URLs per load. */
    private static final int MAX_FRIEND_AVATARS = 30;

    @PluginMethod()
    public void loadFriends(PluginCall call) {
        PlayersClient playersClient = PlayGames.getPlayersClient(getActivity());
        playersClient.loadFriends(200, false).addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) {
                com.google.android.gms.games.AnnotatedData<com.google.android.gms.games.PlayerBuffer> data = task.getResult();
                com.google.android.gms.games.PlayerBuffer playerBuffer = data.get();
                org.json.JSONArray friends = new org.json.JSONArray();
                java.util.List<JSObject> friendObjs = new java.util.ArrayList<>();
                java.util.List<Uri> iconUris = new java.util.ArrayList<>();
                if (playerBuffer != null) {
                    for (int i = 0; i < playerBuffer.getCount(); i++) {
                        Player friend = playerBuffer.get(i);
                        JSObject friendObj = new JSObject();
                        friendObj.put("playerId", friend.getPlayerId());
                        friendObj.put("displayName", friend.getDisplayName());
                        friendObjs.add(friendObj);
                        iconUris.add(friend.getIconImageUri());
                        friends.put(friendObj);
                    }
                    playerBuffer.close();
                }

                Runnable finish = () -> {
                    JSObject result = new JSObject();
                    result.put("friends", friends);
                    call.resolve(result);
                };

                // Convert the first N avatars from content:// URIs to data URLs
                java.util.List<Integer> toConvert = new java.util.ArrayList<>();
                int limit = Math.min(MAX_FRIEND_AVATARS, friendObjs.size());
                for (int i = 0; i < limit; i++) {
                    if (iconUris.get(i) != null) toConvert.add(i);
                }
                if (toConvert.isEmpty()) {
                    finish.run();
                    return;
                }
                java.util.concurrent.atomic.AtomicInteger pending =
                    new java.util.concurrent.atomic.AtomicInteger(toConvert.size());
                for (int idx : toConvert) {
                    final JSObject target = friendObjs.get(idx);
                    loadImageAsDataUrl(iconUris.get(idx), dataUrl -> {
                        if (dataUrl != null) target.put("avatarUrl", dataUrl);
                        if (pending.decrementAndGet() == 0) finish.run();
                    });
                }
            } else {
                // Friends access might require consent — return empty list
                JSObject result = new JSObject();
                result.put("friends", new org.json.JSONArray());
                result.put("requiresConsent", true);
                call.resolve(result);
            }
        });
    }

    /**
     * Save game state to Play Games cloud (Saved Games / Snapshots).
     * Expects: { data: "JSON string", description: "save description" }
     */
    @PluginMethod()
    public void saveGame(PluginCall call) {
        String data = call.getString("data", "");
        String description = call.getString("description", "OrbMaster Save");
        String saveName = "orbmaster-save";

        SnapshotsClient snapshotsClient = PlayGames.getSnapshotsClient(getActivity());
        snapshotsClient.open(saveName, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful() || task.getResult() == null) {
                    Log.e(TAG, "Failed to open snapshot for saving");
                    call.reject("Failed to open snapshot");
                    return;
                }

                SnapshotsClient.DataOrConflict<Snapshot> result = task.getResult();
                Snapshot snapshot = result.getData();
                if (snapshot == null) {
                    call.reject("Snapshot conflict could not be resolved");
                    return;
                }

                // Write data
                snapshot.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));

                // Build metadata
                SnapshotMetadataChange metadataChange = new SnapshotMetadataChange.Builder()
                    .setDescription(description)
                    .build();

                // Commit
                snapshotsClient.commitAndClose(snapshot, metadataChange)
                    .addOnCompleteListener(commitTask -> {
                        JSObject res = new JSObject();
                        if (commitTask.isSuccessful()) {
                            res.put("success", true);
                            res.put("timestamp", System.currentTimeMillis());
                            Log.i(TAG, "Game saved to cloud successfully");
                        } else {
                            res.put("success", false);
                            res.put("error", "Commit failed");
                            Log.e(TAG, "Failed to commit snapshot");
                        }
                        call.resolve(res);
                    });
            });
    }

    /**
     * Load game state from Play Games cloud (Saved Games / Snapshots).
     * Returns: { success: true, data: "JSON string", timestamp: long } or { success: false }
     */
    @PluginMethod()
    public void loadGame(PluginCall call) {
        String saveName = "orbmaster-save";

        SnapshotsClient snapshotsClient = PlayGames.getSnapshotsClient(getActivity());
        snapshotsClient.open(saveName, false, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful() || task.getResult() == null) {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("error", "No save found or failed to open");
                    call.resolve(res);
                    return;
                }

                SnapshotsClient.DataOrConflict<Snapshot> result = task.getResult();
                Snapshot snapshot = result.getData();
                if (snapshot == null) {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("error", "Snapshot conflict");
                    call.resolve(res);
                    return;
                }

                try {
                    byte[] bytes = snapshot.getSnapshotContents().readFully();
                    String data = new String(bytes, StandardCharsets.UTF_8);
                    SnapshotMetadata metadata = snapshot.getMetadata();

                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("data", data);
                    res.put("timestamp", metadata.getLastModifiedTimestamp());
                    res.put("description", metadata.getDescription());
                    Log.i(TAG, "Game loaded from cloud successfully");
                    call.resolve(res);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to read snapshot data", e);
                    call.reject("Failed to read snapshot: " + e.getMessage());
                }
            });
    }

    /**
     * Internal helper to get player info and resolve the call.
     */
    private void getPlayerInfo(PluginCall call) {
        PlayersClient playersClient = PlayGames.getPlayersClient(getActivity());
        playersClient.getCurrentPlayer().addOnCompleteListener(task -> {
            JSObject result = new JSObject();
            if (task.isSuccessful() && task.getResult() != null) {
                Player player = task.getResult();
                result.put("isSignedIn", true);
                result.put("playerId", player.getPlayerId());
                result.put("displayName", player.getDisplayName());
                Uri iconUri = player.getIconImageUri();
                if (iconUri != null) {
                    // content:// URIs can't be loaded by the WebView —
                    // load natively and pass through as a base64 data URL.
                    loadImageAsDataUrl(iconUri, dataUrl -> {
                        if (dataUrl != null) result.put("avatarUrl", dataUrl);
                        call.resolve(result);
                    });
                    return;
                }
            } else {
                result.put("isSignedIn", false);
                result.put("error", "Failed to get player info");
            }
            call.resolve(result);
        });
    }

    private interface DataUrlCallback {
        void onResult(String dataUrl);
    }

    /**
     * Loads a Play Games content:// image URI via ImageManager and
     * converts it to a base64 PNG data URL usable in the WebView.
     * Must be invoked on the main thread (Task listeners already are).
     */
    private void loadImageAsDataUrl(Uri uri, DataUrlCallback callback) {
        try {
            ImageManager imageManager = ImageManager.create(getContext());
            imageManager.loadImage((loadedUri, drawable, isRequested) -> {
                try {
                    if (drawable == null) {
                        callback.onResult(null);
                        return;
                    }
                    Bitmap bitmap;
                    if (drawable instanceof BitmapDrawable && ((BitmapDrawable) drawable).getBitmap() != null) {
                        bitmap = ((BitmapDrawable) drawable).getBitmap();
                    } else {
                        int w = Math.max(1, drawable.getIntrinsicWidth());
                        int h = Math.max(1, drawable.getIntrinsicHeight());
                        bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                        Canvas canvas = new Canvas(bitmap);
                        drawable.setBounds(0, 0, w, h);
                        drawable.draw(canvas);
                    }
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.PNG, 90, baos);
                    String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                    callback.onResult("data:image/png;base64," + base64);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to convert avatar image", e);
                    callback.onResult(null);
                }
            }, uri);
        } catch (Exception e) {
            Log.e(TAG, "Failed to load avatar image", e);
            callback.onResult(null);
        }
    }
}
