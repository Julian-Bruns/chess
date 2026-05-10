package com.julianbruns.localstockfishchess;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

@CapacitorPlugin(name = "StockfishEngine")
public class StockfishEnginePlugin extends Plugin {
    private static final String APP_RELEASE_API = "https://api.github.com/repos/Julian-Bruns/chess/releases/tags/latest";
    private static final String USER_AGENT = "chessfish/0.1.0";
    private final ExecutorService outputExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private Process process;
    private BufferedWriter writer;
    private Future<?> outputTask;

    @PluginMethod
    public synchronized void start(PluginCall call) {
        if (isRunning()) {
            call.resolve();
            return;
        }

        File engine = stockfishBinary();
        if (!engine.exists()) {
            call.reject("Stockfish binary is missing from nativeLibraryDir");
            return;
        }

        engine.setExecutable(true);

        try {
            ProcessBuilder builder = new ProcessBuilder(engine.getAbsolutePath());
            builder.redirectErrorStream(true);
            process = builder.start();
            writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));
            listenForOutput(process);
            emitStatus("ready");
            call.resolve();
        } catch (IOException error) {
            stopProcess();
            call.reject("Could not start Stockfish", error);
        }
    }

    @PluginMethod
    public synchronized void write(PluginCall call) {
        String command = call.getString("command");
        if (command == null || command.trim().isEmpty()) {
            call.reject("Missing command");
            return;
        }

        if (!isRunning() || writer == null) {
            call.reject("Stockfish is not running");
            return;
        }

        try {
            writer.write(command);
            writer.newLine();
            writer.flush();
            call.resolve();
        } catch (IOException error) {
            call.reject("Could not write to Stockfish", error);
        }
    }

    @PluginMethod
    public synchronized void stop(PluginCall call) {
        stopProcess();
        call.resolve();
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        JSObject result = new JSObject();
        result.put("updated", false);
        result.put("message", "Android uses the Stockfish binary packaged in jniLibs. Run npm run update:stockfish before building.");
        call.resolve(result);
    }

    @PluginMethod
    public void updateEverything(PluginCall call) {
        updateExecutor.submit(() -> {
            try {
                JSONObject release = fetchJson(APP_RELEASE_API);
                JSONObject asset = findAndroidApk(release.optJSONArray("assets"));
                if (asset == null) {
                    JSObject result = new JSObject();
                    result.put("status", "unavailable");
                    result.put("releaseTag", release.optString("tag_name", null));
                    result.put("message", "No Android Chessfish APK was found in the latest release.");
                    call.resolve(result);
                    return;
                }

                File apk = downloadApk(asset);
                openApkInstaller(apk);

                JSObject engineUpdate = new JSObject();
                engineUpdate.put("updated", false);
                engineUpdate.put("message", "Android engine updates are packaged in the APK.");

                JSObject appUpdate = new JSObject();
                appUpdate.put("status", "opened");
                appUpdate.put("releaseTag", release.optString("tag_name", null));
                appUpdate.put("path", apk.getAbsolutePath());
                appUpdate.put("message", "Finish the Android installer to update Chessfish and Stockfish.");

                JSObject result = new JSObject();
                result.put("status", "opened");
                result.put("releaseTag", release.optString("tag_name", null));
                result.put("path", apk.getAbsolutePath());
                result.put("message", "Finish the Android installer to update Chessfish and Stockfish.");
                result.put("engineUpdate", engineUpdate);
                result.put("appUpdate", appUpdate);
                call.resolve(result);
            } catch (Exception error) {
                JSObject result = new JSObject();
                result.put("status", "unavailable");
                result.put("message", error.getMessage());
                call.resolve(result);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        stopProcess();
        outputExecutor.shutdownNow();
        updateExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private File stockfishBinary() {
        return new File(getContext().getApplicationInfo().nativeLibraryDir, "libstockfish.so");
    }

    private synchronized boolean isRunning() {
        return process != null && process.isAlive();
    }

    private void listenForOutput(Process activeProcess) {
        outputTask = outputExecutor.submit(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(activeProcess.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    JSObject event = new JSObject();
                    event.put("line", line);
                    notifyListeners("line", event);
                }
            } catch (IOException error) {
                emitStatus(error.getMessage());
            } finally {
                emitStatus("stopped");
            }
        });
    }

    private synchronized void stopProcess() {
        if (writer != null) {
            try {
                writer.write("quit");
                writer.newLine();
                writer.flush();
                writer.close();
            } catch (IOException ignored) {
                // The process may already be gone.
            }
            writer = null;
        }

        if (process != null) {
            process.destroy();
            process = null;
        }

        if (outputTask != null) {
            outputTask.cancel(true);
            outputTask = null;
        }
    }

    private void emitStatus(String status) {
        if (status == null || status.isEmpty()) {
            return;
        }

        JSObject event = new JSObject();
        event.put("status", status);
        notifyListeners("status", event);
    }

    private JSONObject fetchJson(String url) throws IOException, JSONException {
        HttpURLConnection connection = openConnection(url, "application/vnd.github+json");
        int status = connection.getResponseCode();
        if (status >= 400) {
            throw new IOException("GitHub returned " + status + ". Private release assets require GitHub access outside the app.");
        }

        try (InputStream stream = connection.getInputStream()) {
            return new JSONObject(readUtf8(stream));
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject findAndroidApk(JSONArray assets) throws JSONException {
        if (assets == null) {
            return null;
        }

        JSONObject fallback = null;
        for (int index = 0; index < assets.length(); index += 1) {
            JSONObject asset = assets.getJSONObject(index);
            String name = asset.optString("name", "");
            String lowerName = name.toLowerCase();
            if (!lowerName.endsWith(".apk")) {
                continue;
            }

            if (lowerName.contains("chessfish") && lowerName.contains("android")) {
                return asset;
            }

            if (fallback == null && lowerName.contains("chessfish")) {
                fallback = asset;
            }
        }

        return fallback;
    }

    private File downloadApk(JSONObject asset) throws IOException, JSONException {
        String name = safeFileName(asset.optString("name", "chessfish-android.apk"));
        String url = asset.getString("browser_download_url");
        File updateDir = new File(getContext().getCacheDir(), "updates");
        if (!updateDir.exists() && !updateDir.mkdirs()) {
            throw new IOException("Could not create update cache");
        }

        File apk = new File(updateDir, name);
        HttpURLConnection connection = openConnection(url, "application/octet-stream");
        int status = connection.getResponseCode();
        if (status >= 400) {
            throw new IOException("APK download failed with " + status);
        }

        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apk, false)) {
            byte[] buffer = new byte[1024 * 64];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        } finally {
            connection.disconnect();
        }

        return apk;
    }

    private HttpURLConnection openConnection(String url, String accept) throws IOException {
        URL current = new URL(url);
        for (int redirects = 0; redirects < 5; redirects += 1) {
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(60000);
            connection.setRequestProperty("User-Agent", USER_AGENT);
            connection.setRequestProperty("Accept", accept);

            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new IOException("Redirect without location");
                }
                current = new URL(current, location);
                continue;
            }

            return connection;
        }

        throw new IOException("Too many redirects");
    }

    private void openApkInstaller(File apk) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(intent);
    }

    private String readUtf8(InputStream stream) throws IOException {
        StringBuilder builder = new StringBuilder();
        char[] buffer = new char[8192];
        try (InputStreamReader reader = new InputStreamReader(stream)) {
            int read;
            while ((read = reader.read(buffer)) != -1) {
                builder.append(buffer, 0, read);
            }
        }
        return builder.toString();
    }

    private String safeFileName(String name) {
        return name.replaceAll("[/:\\\\]", "-");
    }
}
