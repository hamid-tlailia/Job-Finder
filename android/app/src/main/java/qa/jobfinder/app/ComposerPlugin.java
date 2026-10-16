package qa.jobfinder.app;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.ArrayList;

/** Opens the email app or WhatsApp with the application text and PDF attachments already filled in. */
@CapacitorPlugin(name = "Composer")
public class ComposerPlugin extends Plugin {

    private ArrayList<Uri> toUris(JSArray files) throws Exception {
        ArrayList<Uri> uris = new ArrayList<>();
        if (files == null) return uris;
        String authority = getContext().getPackageName() + ".fileprovider";
        for (int i = 0; i < files.length(); i++) {
            String raw = files.getString(i);
            File f = new File(Uri.parse(raw).getPath());
            uris.add(FileProvider.getUriForFile(getContext(), authority, f));
        }
        return uris;
    }

    private void attach(Intent intent, ArrayList<Uri> uris) {
        if (uris.isEmpty()) return;
        if (uris.size() == 1) {
            intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        } else {
            intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        }
        ClipData clip = ClipData.newRawUri("", uris.get(0));
        for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
        intent.setClipData(clip);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }

    @PluginMethod
    public void email(PluginCall call) {
        try {
            ArrayList<Uri> uris = toUris(call.getArray("attachments"));
            Intent intent = new Intent(uris.size() > 1 ? Intent.ACTION_SEND_MULTIPLE : Intent.ACTION_SEND);
            intent.setType(uris.isEmpty() ? "message/rfc822" : "application/pdf");
            String to = call.getString("to", "");
            if (!to.isEmpty()) intent.putExtra(Intent.EXTRA_EMAIL, new String[] { to });
            intent.putExtra(Intent.EXTRA_SUBJECT, call.getString("subject", ""));
            intent.putExtra(Intent.EXTRA_TEXT, call.getString("body", ""));
            attach(intent, uris);
            // Prefer Gmail when installed, otherwise let the user pick an email app.
            Intent gmail = new Intent(intent).setPackage("com.google.android.gm");
            if (gmail.resolveActivity(getContext().getPackageManager()) != null) {
                getActivity().startActivity(gmail);
            } else {
                getActivity().startActivity(Intent.createChooser(intent, "Email"));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void whatsapp(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String phone = call.getString("phone", "").replaceAll("\\D", "");
            ArrayList<Uri> uris = toUris(call.getArray("attachments"));
            for (String pkg : new String[] { "com.whatsapp", "com.whatsapp.w4b" }) {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setPackage(pkg);
                intent.setType(uris.isEmpty() ? "text/plain" : "application/pdf");
                intent.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
                if (!phone.isEmpty()) intent.putExtra("jid", phone + "@s.whatsapp.net");
                attach(intent, uris);
                try {
                    getActivity().startActivity(intent);
                    ret.put("opened", true);
                    call.resolve(ret);
                    return;
                } catch (ActivityNotFoundException ignored) {
                    // try the next WhatsApp flavour
                }
            }
            ret.put("opened", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }

    /** Whether Android exempts the app from battery optimisation (needed for reliable background checks). */
    @PluginMethod
    public void batteryStatus(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("ignoring", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    /** Shows the system dialog that lets the user exempt this app from battery optimisation. */
    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(fallback);
        }
        call.resolve();
    }

    /**
     * Opens the phone maker's "Autostart" screen (Xiaomi, Oppo, Vivo, Huawei...), which those systems
     * require before they let the hourly background check run; falls back to the app's settings page.
     */
    @PluginMethod
    public void openAutostart(PluginCall call) {
        String[][] targets = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
            {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
            {"com.asus.mobilemanager", "com.asus.mobilemanager.MainActivity"},
        };
        JSObject ret = new JSObject();
        for (String[] t : targets) {
            Intent intent = new Intent();
            intent.setComponent(new android.content.ComponentName(t[0], t[1]));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                try {
                    getActivity().startActivity(intent);
                    ret.put("vendor", true);
                    call.resolve(ret);
                    return;
                } catch (Exception ignored) {
                    // try the next known screen
                }
            }
        }
        Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(fallback);
        ret.put("vendor", false);
        call.resolve(ret);
    }
}
