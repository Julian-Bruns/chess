package com.julianbruns.localstockfishchess;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

@CapacitorPlugin(name = "StockfishEngine")
public class StockfishEnginePlugin extends Plugin {
    private final ExecutorService outputExecutor = Executors.newSingleThreadExecutor();
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

    @Override
    protected void handleOnDestroy() {
        stopProcess();
        outputExecutor.shutdownNow();
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
}
