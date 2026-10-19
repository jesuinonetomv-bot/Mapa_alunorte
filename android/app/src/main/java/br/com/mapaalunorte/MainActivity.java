package br.com.mapaalunorte;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.Handler;
import android.os.Looper;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.media.AudioManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.JsPromptResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.EditText;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    static final String HOME = "https://jesuinonetomv-bot.github.io/Mapa_alunorte/";
    static final String ORIGIN = "https://jesuinonetomv-bot.github.io";
    private WebView web;
    private LinearLayout errorPanel;
    private ProgressBar progress;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private byte[] pendingBackup;
    private TextToSpeech tts;
    private volatile boolean ttsReady, foreground, closing;
    private volatile long lastSpeechAt;
    private AudioManager audioManager;
    private AudioFocusRequest speechFocus;
    private String activeSpeechId;
    private boolean pageReady, checkingVersion;
    private String loadedRevision="", pendingRevision="";
    private long lastVersionCheck;
    private final Handler updateHandler=new Handler(Looper.getMainLooper());
    private final Runnable updatePoll=new Runnable(){public void run(){if(foreground&&!closing){checkMapVersion();updateHandler.postDelayed(this,60000);}}};
    private boolean exportBusy;
    private boolean failed;
    private static final int LOCATION_REQUEST = 10, EXPORT_REQUEST = 11;

    static boolean isAppUrl(Uri uri) {
        if (uri == null || !"https".equals(uri.getScheme()) ||
            !"jesuinonetomv-bot.github.io".equals(uri.getHost()) ||
            (uri.getPort() != -1 && uri.getPort() != 443) || uri.getUserInfo() != null) return false;
        String path = uri.getPath();
        return "/Mapa_alunorte".equals(path) || (path != null && path.startsWith("/Mapa_alunorte/"));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        audioManager=(AudioManager)getSystemService(AUDIO_SERVICE);
        AudioAttributes audio=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        speechFocus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(audio).setOnAudioFocusChangeListener(focus->{if(focus<0&&tts!=null)tts.stop();}).build();
        tts=new TextToSpeech(this,status->{
            if(closing||tts==null)return;
            if(status==TextToSpeech.SUCCESS){
                int language=tts.setLanguage(new Locale("pt","BR"));
                ttsReady=language!=TextToSpeech.LANG_MISSING_DATA&&language!=TextToSpeech.LANG_NOT_SUPPORTED;
                tts.setSpeechRate(1.0f);tts.setAudioAttributes(audio);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                    @Override public void onStart(String id){}
                    @Override public void onDone(String id){runOnUiThread(()->releaseSpeechFocus(id));}
                    @Override public void onError(String id){runOnUiThread(()->{releaseSpeechFocus(id);toast("Não foi possível reproduzir a voz. Confira a voz em português nas configurações do Android.");});}
                });
            }
            publishVoiceStatus();
        });
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(23,58,74));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(root);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.addJavascriptInterface(new ExportBridge(), "AlunorteAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isAppUrl(uri)) return false;
                if (request.isForMainFrame() && request.hasGesture() &&
                    ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (Exception e) { toast("Não foi possível abrir o link."); }
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                pageReady=false;failed = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!isAppUrl(Uri.parse(url)) || failed) return;
                pageReady=true;
                addUpdateControls();
                view.evaluateJavascript("(function(){var m=document.querySelector('meta[name=mapa-revision]');return m?m.content:'legacy';})()",value->{
                    try{loadedRevision=new org.json.JSONArray("["+value+"]").getString(0);}catch(Exception e){loadedRevision="legacy";}
                    checkMapVersion();
                });
                publishVoiceStatus();
                // Export through Android's document picker; no storage permission is needed.
                view.evaluateJavascript("(function(){var b=document.getElementById('btnExport');if(b)b.onclick=function(){try{AlunorteAndroid.saveBackup(JSON.stringify({...state,streetStudio:studioModel(),rawRoads,roadRevisions},null,2));}catch(e){alert('Não foi possível exportar o mapa.');}};})()", null);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { pageReady=false;failed = true; progress.setVisibility(View.GONE); errorPanel.setVisibility(View.VISIBLE); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value == 100 || failed ? View.GONE : View.VISIBLE);
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!(ORIGIN.equals(origin) || (ORIGIN+"/").equals(origin))) { callback.invoke(origin,false,false); return; }
                if (hasLocation()) { callback.invoke(origin,true,false); return; }
                if (locationCallback != null) locationCallback.invoke(locationOrigin,false,false);
                locationCallback=callback; locationOrigin=origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},LOCATION_REQUEST);
            }
            @Override public void onGeolocationPermissionsHidePrompt() { clearLocationPrompt(false); }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("Mapa Alunorte").setMessage(message)
                    .setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("Mapa Alunorte").setMessage(message)
                    .setPositiveButton("Confirmar",(d,w)->result.confirm()).setNegativeButton("Cancelar",(d,w)->result.cancel())
                    .setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onJsPrompt(WebView view, String url, String message, String initial, JsPromptResult result) {
                EditText input=new EditText(MainActivity.this); input.setText(initial);
                new AlertDialog.Builder(MainActivity.this).setTitle("Mapa Alunorte").setMessage(message).setView(input)
                    .setPositiveButton("OK",(d,w)->result.confirm(input.getText().toString())).setNegativeButton("Cancelar",(d,w)->result.cancel())
                    .setOnCancelListener(d->result.cancel()).show(); return true;
            }
        });
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress,new FrameLayout.LayoutParams(-1,dp(3),Gravity.TOP));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL); errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(28),dp(28),dp(28),dp(28)); errorPanel.setBackgroundColor(Color.WHITE);
        TextView message = new TextView(this);
        message.setText("Não foi possível carregar o mapa\n\nEsta versão precisa de internet. Confira sua conexão e tente novamente.");
        message.setTextSize(18); message.setGravity(Gravity.CENTER); message.setTextColor(Color.rgb(23,58,74));
        errorPanel.addView(message);
        Button retry = new Button(this); retry.setText("Tentar novamente"); retry.setOnClickListener(v->requestMapRefresh(true));
        errorPanel.addView(retry); errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel,new FrameLayout.LayoutParams(-1,-1));
        loadFreshMap();
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }
    private void clearLocationPrompt(boolean allowed) {
        if (locationCallback != null) { locationCallback.invoke(locationOrigin,allowed,false); locationCallback=null; locationOrigin=null; }
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code,permissions,grants);
        if (code==LOCATION_REQUEST) {
            clearLocationPrompt(hasLocation());
            if (!hasLocation()) toast("Localização não autorizada. Você ainda pode consultar o mapa.");
        }
    }

    private void loadFreshMap(){
        if(web==null||closing)return;
        pageReady=false;pendingRevision="";
        java.util.Map<String,String> headers=new java.util.HashMap<>();headers.put("Cache-Control","no-cache, no-store");headers.put("Pragma","no-cache");
        web.loadUrl(HOME+"?android=0.2.1&refresh="+System.currentTimeMillis(),headers);
    }
    private void addUpdateControls(){
        if(!trustedPage())return;
        web.evaluateJavascript("(function(){var a=document.querySelector('aside');if(!a)return;var c=document.getElementById('nativeAppInfo');if(!c){c=document.createElement('div');c.id='nativeAppInfo';c.className='card';var h=document.createElement('h2');h.textContent='Aplicativo Android';c.appendChild(h);var p=document.createElement('p');p.id='nativeAppVersion';p.style.fontSize='12px';c.appendChild(p);var b=document.createElement('button');b.textContent='Atualizar mapa agora';b.onclick=function(){AlunorteAndroid.refreshMap();};c.appendChild(b);a.appendChild(c);}var m=document.querySelector('header h1 span');document.getElementById('nativeAppVersion').textContent='Android 0.2.1 • '+(m?m.textContent:'Mapa Alunorte');})()",null);
    }
    private void requestMapRefresh(boolean manual){
        if(web==null||closing)return;
        if(!pageReady){if(manual)loadFreshMap();return;}
        web.evaluateJavascript("Boolean((typeof cleanNav!=='undefined'&&cleanNav.started)||(typeof recording!=='undefined'&&recording)||(typeof studio!=='undefined'&&studio.dirty)||(typeof editor!=='undefined'&&editor.active)||(typeof blockMode!=='undefined'&&blockMode))",busy->{
            if(closing||!foreground)return;
            if("true".equals(busy)){
                if(manual)new AlertDialog.Builder(this).setTitle("Atualizar o mapa?").setMessage("Isso encerra a navegação ou gravação e descarta alterações ainda não salvas. Prefere concluir antes de atualizar?")
                    .setPositiveButton("Atualizar agora",(d,w)->loadFreshMap()).setNegativeButton("Continuar como está",null).show();
                else showUpdateStatus("Nova versão disponível. Conclua a navegação/gravação e use Atualizar mapa agora.");
            }else loadFreshMap();
        });
    }
    private void showUpdateStatus(String message){
        if(!trustedPage())return;
        web.evaluateJavascript("(function(){var p=document.getElementById('nativeAppVersion');if(p)p.textContent="+JSONObject.quote("Android 0.2.1 • "+message)+";})()",null);
    }
    private void checkMapVersion(){
        if(checkingVersion||!foreground||!pageReady||loadedRevision.isEmpty()||closing)return;
        long now=SystemClock.elapsedRealtime();if(now-lastVersionCheck<15000)return;
        checkingVersion=true;lastVersionCheck=now;
        new Thread(()->{
            String revision=null;HttpURLConnection connection=null;
            try{
                connection=(HttpURLConnection)new URL(HOME+"app-version.json?check="+System.currentTimeMillis()).openConnection();
                connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setUseCaches(false);connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Cache-Control","no-cache");
                if(connection.getResponseCode()==200){try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] bytes=new byte[1024];int n;while((n=in.read(bytes))!=-1){out.write(bytes,0,n);if(out.size()>8192)throw new java.io.IOException();}
                    String candidate=new JSONObject(out.toString("UTF-8")).getString("revision");if(candidate.matches("[a-zA-Z0-9._-]{1,80}"))revision=candidate;
                }}
            }catch(Exception ignored){}finally{if(connection!=null)connection.disconnect();}
            final String latest=revision;runOnUiThread(()->{
                checkingVersion=false;if(closing||!foreground||latest==null||!pageReady)return;
                if(!latest.equals(loadedRevision)){pendingRevision=latest;requestMapRefresh(false);}
            });
        }).start();
    }
    private boolean trustedPage(){return web!=null&&isAppUrl(Uri.parse(web.getUrl()==null?"":web.getUrl()));}
    private void publishVoiceStatus(){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new CustomEvent('alunorte-voice-status',{detail:{ready:"+ttsReady+"}}))",null);}
    private void releaseSpeechFocus(String id){if(id!=null&&!id.equals(activeSpeechId))return;activeSpeechId=null;if(audioManager!=null&&speechFocus!=null)audioManager.abandonAudioFocusRequest(speechFocus);}
    private void stopSpeech(){if(tts!=null)tts.stop();releaseSpeechFocus(null);}
    public final class ExportBridge {
        @JavascriptInterface public void refreshMap(){runOnUiThread(()->{if(trustedPage())requestMapRefresh(true);});}
        @JavascriptInterface public boolean voiceReady(){return ttsReady&&foreground&&!closing;}
        @JavascriptInterface public boolean speak(String text){
            if(text==null||text.length()==0||text.length()>400||!ttsReady||!foreground||closing)return false;
            long now=SystemClock.elapsedRealtime();if(lastSpeechAt>0&&now-lastSpeechAt<7000)return false;lastSpeechAt=now;
            runOnUiThread(()->{
                if(!trustedPage()||!foreground||!ttsReady||tts==null)return;
                if(audioManager.requestAudioFocus(speechFocus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)return;
                activeSpeechId="alunorte-"+SystemClock.elapsedRealtime();
                int result=tts.speak(text,TextToSpeech.QUEUE_FLUSH,null,activeSpeechId);
                if(result==TextToSpeech.ERROR){releaseSpeechFocus(null);toast("Não foi possível reproduzir a orientação.");}
            });return true;
        }
        @JavascriptInterface public void stopVoice(){runOnUiThread(()->stopSpeech());}
        @JavascriptInterface public void saveBackup(String json) {
            if (json==null || json.length()>20*1024*1024) return;
            try { new JSONObject(json); } catch (Exception e) { return; }
            runOnUiThread(()-> {
                if (exportBusy || !isAppUrl(Uri.parse(web.getUrl()==null?"":web.getUrl()))) return;
                pendingBackup=json.getBytes(StandardCharsets.UTF_8); exportBusy=true;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,"mapa-alunorte-"+new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(new Date())+".json");
                try { startActivityForResult(intent,EXPORT_REQUEST); }
                catch (Exception e) { pendingBackup=null; exportBusy=false; toast("Não foi possível abrir o seletor de arquivos."); }
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request!=EXPORT_REQUEST) return;
        byte[] backup=pendingBackup; pendingBackup=null; exportBusy=false;
        if (result!=RESULT_OK || data==null || data.getData()==null || backup==null) return;
        Uri destination=data.getData();
        new Thread(()-> {
            try (OutputStream out=getContentResolver().openOutputStream(destination,"wt")) {
                if(out==null) throw new java.io.IOException(); out.write(backup);
                runOnUiThread(()->toast("Cópia do mapa salva."));
            } catch (Exception e) { runOnUiThread(()->toast("Não foi possível salvar a cópia.")); }
        }).start();
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){var m=document.querySelector('aside.clean-drawer');if(m&&!m.hidden){m.hidden=true;return true;}var s=document.getElementById('routeSheet');if(s&&!s.hidden){s.hidden=true;return true;}return false;})()", value->{
            if ("true".equals(value)) return;
            new AlertDialog.Builder(this).setTitle("Sair do mapa?").setMessage("A navegação e a gravação de percurso param ao fechar o aplicativo.")
                .setPositiveButton("Sair",(d,w)->finish()).setNegativeButton("Continuar",null).show();
        });
    }
    @Override protected void onPause() { foreground=false;updateHandler.removeCallbacks(updatePoll);stopSpeech();super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume();foreground=true; if(web!=null)web.onResume();updateHandler.removeCallbacks(updatePoll);updateHandler.post(updatePoll); }
    @Override protected void onDestroy() { closing=true;updateHandler.removeCallbacks(updatePoll);ttsReady=false;stopSpeech();if(tts!=null){tts.shutdown();tts=null;}clearLocationPrompt(false); if(web!=null){web.removeJavascriptInterface("AlunorteAndroid");web.destroy();} super.onDestroy(); }
    private int dp(int n) { return Math.round(n*getResources().getDisplayMetrics().density); }
    private void toast(String message) { Toast.makeText(this,message,Toast.LENGTH_LONG).show(); }
}


